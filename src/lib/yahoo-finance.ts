// Yahoo Finance — uses v8 chart API (no API key required, v7 quote restricted)
import https from "node:https";

const YF_BASE = "https://query1.finance.yahoo.com";
const YF_ALT  = "https://query2.finance.yahoo.com";

// finance.yahoo.com returns too many Set-Cookie headers for Node.js fetch (Headers Overflow).
// Use the raw https module with a larger maxHeaderSize instead.
function httpsGet(url: string, headers: Record<string, string>): Promise<{ status: number; cookies: string[]; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path:     u.pathname + u.search,
        method:   "GET",
        headers,
        maxHeaderSize: 81_920,
        timeout:       12_000,
      },
      (res) => {
        let body = "";
        res.on("data", (d: Buffer) => { body += d.toString(); });
        res.on("end", () => resolve({
          status:  res.statusCode ?? 0,
          cookies: (res.headers["set-cookie"] as string[] | undefined) ?? [],
          body,
        }));
      },
    );
    req.on("error",   reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.end();
  });
}

export const YF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept":          "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "Referer":         "https://finance.yahoo.com/",
  "Origin":          "https://finance.yahoo.com",
};

// ── In-memory cache ──────────────────────────────────────────────────────────
const _cache = new Map<string, { data: unknown; ts: number }>();

// ── Crumb (required for v10 quoteSummary) ────────────────────────────────────
let _crumb    = "";
let _yfCookie = "";
let _crumbTs  = 0;

async function refreshCrumb(): Promise<void> {
  try {
    // finance.yahoo.com sends too many Set-Cookie headers → Node.js fetch throws Headers Overflow.
    // Use raw https module with enlarged maxHeaderSize instead.
    const r1 = await httpsGet("https://finance.yahoo.com/", {
      "User-Agent":      YF_HEADERS["User-Agent"],
      "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": YF_HEADERS["Accept-Language"],
    });
    _yfCookie = r1.cookies.map(c => c.split(";")[0].trim()).join("; ");

    // Try extracting crumb from the HTML embed (faster path, no extra round-trip)
    if (r1.body) {
      for (const pat of [
        /"crumb"\s*:\s*"([^"]{8,25})"/,
        /\\"crumb\\"\s*:\s*\\"([^"]{8,25})\\"/,
      ]) {
        const m = r1.body.match(pat);
        if (m?.[1]) {
          _crumb   = m[1];
          _crumbTs = Date.now();
          return;
        }
      }
    }

    // Fallback: dedicated getcrumb endpoint (needs the session cookies above)
    if (_yfCookie) {
      for (const base of [YF_ALT, YF_BASE]) {
        const r2 = await httpsGet(`${base}/v1/test/getcrumb`, {
          "User-Agent":      YF_HEADERS["User-Agent"],
          "Accept":          "*/*",
          "Referer":         "https://finance.yahoo.com/",
          "Accept-Language": YF_HEADERS["Accept-Language"],
          "Cookie":          _yfCookie,
        });
        if (r2.status === 200) {
          const text = r2.body.trim();
          if (text && text.length < 60 && !text.includes("<") && !text.startsWith("{")) {
            _crumb   = text;
            _crumbTs = Date.now();
            return;
          }
        }
      }
    }
  } catch {
    // ignore — v10 calls will fall back to mock data
  }
}

async function getCrumb(): Promise<{ crumb: string; cookie: string }> {
  if (_crumb && Date.now() - _crumbTs < 55 * 60_000) return { crumb: _crumb, cookie: _yfCookie };
  await refreshCrumb();
  return { crumb: _crumb, cookie: _yfCookie };
}

async function fetchV10(symbol: string, modules: string): Promise<unknown> {
  const { crumb, cookie } = await getCrumb();
  const crumbParam = crumb ? `&crumb=${encodeURIComponent(crumb)}` : "";
  const cookieHeader: Record<string, string> = cookie ? { "Cookie": cookie } : {};
  const url = `${YF_BASE}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}${crumbParam}`;
  const res = await fetch(url, {
    headers: { ...YF_HEADERS, ...cookieHeader },
    signal:  AbortSignal.timeout(15_000),
    cache:   "no-store",
  });
  if (res.status === 401 || res.status === 403) {
    // Crumb expired — force refresh and retry once
    _crumb = ""; _crumbTs = 0;
    const { crumb: c2, cookie: ck2 } = await getCrumb();
    const url2 = `${YF_BASE}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}` +
      (c2 ? `&crumb=${encodeURIComponent(c2)}` : "");
    const res2 = await fetch(url2, {
      headers: { ...YF_HEADERS, ...(ck2 ? { "Cookie": ck2 } : {}) },
      signal:  AbortSignal.timeout(15_000),
      cache:   "no-store",
    });
    if (!res2.ok) return null;
    return await res2.json();
  }
  if (!res.ok) return null;
  return await res.json();
}

// ── YFQuote ──────────────────────────────────────────────────────────────────
export interface YFQuote {
  symbol:                      string;
  shortName?:                  string;
  longName?:                   string;
  regularMarketPrice?:         number;
  regularMarketChange?:        number;
  regularMarketChangePercent?: number;
  regularMarketVolume?:        number;
  regularMarketDayHigh?:       number;
  regularMarketDayLow?:        number;
  regularMarketPreviousClose?: number;
  fiftyTwoWeekHigh?:           number;
  fiftyTwoWeekLow?:            number;
  marketCap?:                  number;
}

async function fetchV8Chart(symbol: string, base = YF_BASE): Promise<YFQuote | null> {
  const key = `v8_${symbol}`;
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.ts < 60_000) return hit.data as YFQuote;

  try {
    const url = `${base}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d&includePrePost=false`;
    const res = await fetch(url, {
      headers: YF_HEADERS,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });

    if (res.status === 429) {
      // Try alt host
      if (base === YF_BASE) return fetchV8Chart(symbol, YF_ALT);
      return null;
    }
    if (!res.ok) return null;

    const json = await res.json() as {
      chart: { result: Array<{
        meta: {
          symbol: string; shortName?: string; longName?: string;
          regularMarketPrice: number;
          chartPreviousClose?: number; previousClose?: number;
          regularMarketVolume?: number;
          regularMarketDayHigh?: number; regularMarketDayLow?: number;
          fiftyTwoWeekHigh?: number;    fiftyTwoWeekLow?: number;
          marketCap?: number;
        };
      }> | null };
    };

    const result = json.chart?.result?.[0];
    if (!result) return null;

    const meta      = result.meta;
    const price     = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change    = price - prevClose;

    const q: YFQuote = {
      symbol:                      symbol,
      shortName:                   meta.shortName,
      longName:                    meta.longName,
      regularMarketPrice:          price,
      regularMarketChange:         change,
      regularMarketChangePercent:  prevClose ? (change / prevClose) * 100 : 0,
      regularMarketVolume:         meta.regularMarketVolume,
      regularMarketDayHigh:        meta.regularMarketDayHigh,
      regularMarketDayLow:         meta.regularMarketDayLow,
      regularMarketPreviousClose:  prevClose,
      fiftyTwoWeekHigh:            meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow:             meta.fiftyTwoWeekLow,
      marketCap:                   meta.marketCap,
    };

    _cache.set(key, { data: q, ts: Date.now() });
    return q;
  } catch {
    return null;
  }
}

// Fetch multiple symbols — batched to avoid rate limits
export async function fetchYFQuotes(symbols: string[]): Promise<YFQuote[]> {
  if (!symbols.length) return [];

  const BATCH = 6; // fetch 6 at a time in parallel
  const results: YFQuote[] = [];

  for (let i = 0; i < symbols.length; i += BATCH) {
    const chunk = symbols.slice(i, i + BATCH);
    const batch = await Promise.allSettled(chunk.map(s => fetchV8Chart(s)));
    for (const r of batch) {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    }
  }
  return results;
}

// ── Price history (for RS calculation) ───────────────────────────────────────
export interface PricePoint {
  ts: number;    // Unix timestamp in seconds
  close: number;
}

export async function fetchYFPriceHistory(
  symbol: string,
  range = "1y",
): Promise<PricePoint[]> {
  const key = `hist_${symbol}_${range}`;
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.ts < 15 * 60_000) return hit.data as PricePoint[];

  try {
    const url = `${YF_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?interval=1d&range=${range}&includePrePost=false`;
    const res = await fetch(url, {
      headers: YF_HEADERS,
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (res.status === 429) {
      const url2 = url.replace(YF_BASE, YF_ALT);
      const res2 = await fetch(url2, { headers: YF_HEADERS, signal: AbortSignal.timeout(12_000), cache: "no-store" });
      if (!res2.ok) return [];
      const json2 = await res2.json() as { chart: { result: Array<{ timestamp: number[]; indicators: { quote: Array<{ close: (number | null)[] }> } }> | null } };
      const r2 = json2.chart?.result?.[0];
      if (!r2?.timestamp) return [];
      const c2 = r2.indicators.quote[0]?.close ?? [];
      const pts2 = r2.timestamp.map((ts, i) => ({ ts, close: c2[i] ?? 0 })).filter(p => p.close > 0);
      _cache.set(key, { data: pts2, ts: Date.now() });
      return pts2;
    }
    if (!res.ok) return [];
    const json = await res.json() as {
      chart: { result: Array<{
        timestamp: number[];
        indicators: { quote: Array<{ close: (number | null)[] }> };
      }> | null };
    };
    const result = json.chart?.result?.[0];
    if (!result?.timestamp) return [];
    const closes = result.indicators.quote[0]?.close ?? [];
    const points: PricePoint[] = result.timestamp
      .map((ts, i) => ({ ts, close: closes[i] ?? 0 }))
      .filter(p => p.close > 0);
    _cache.set(key, { data: points, ts: Date.now() });
    return points;
  } catch {
    return [];
  }
}

// ── Key statistics (PER / PBR / ROE etc.) ────────────────────────────────────
export interface YFKeyStats {
  symbol:                         string;
  trailingPE?:                    number;
  forwardPE?:                     number;
  priceToBook?:                   number;
  returnOnEquity?:                number;  // decimal: 0.12 = 12 %
  priceToSalesTrailing12Months?:  number;
  enterpriseToEbitda?:            number;
  marketCap?:                     number;
  trailingEps?:                   number;
}

export async function fetchYFKeyStats(symbol: string): Promise<YFKeyStats | null> {
  const key = `ks_${symbol}`;
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.ts < 60 * 60_000) return hit.data as YFKeyStats;

  try {
    const modules = "defaultKeyStatistics,summaryDetail,financialData";
    type RV = { raw?: number };
    const json = await fetchV10(symbol, modules) as {
      quoteSummary: {
        result: Array<{
          defaultKeyStatistics?: {
            trailingPE?: RV; forwardPE?: RV; priceToBook?: RV;
            enterpriseToEbitda?: RV; trailingEps?: RV;
          };
          summaryDetail?: {
            trailingPE?: RV; forwardPE?: RV; marketCap?: RV;
            priceToSalesTrailing12Months?: RV;
          };
          financialData?: { returnOnEquity?: RV };
        }> | null;
        error?: unknown;
      };
    } | null;
    if (!json || json.quoteSummary?.error || !json.quoteSummary?.result?.length) return null;
    const r  = json.quoteSummary.result[0];
    const ks = r.defaultKeyStatistics ?? {};
    const sd = r.summaryDetail ?? {};
    const fd = r.financialData ?? {};

    const stats: YFKeyStats = {
      symbol,
      trailingPE:                   ks.trailingPE?.raw ?? sd.trailingPE?.raw,
      forwardPE:                    ks.forwardPE?.raw  ?? sd.forwardPE?.raw,
      priceToBook:                  ks.priceToBook?.raw,
      returnOnEquity:               fd.returnOnEquity?.raw,
      priceToSalesTrailing12Months: sd.priceToSalesTrailing12Months?.raw,
      enterpriseToEbitda:           ks.enterpriseToEbitda?.raw,
      marketCap:                    sd.marketCap?.raw,
      trailingEps:                  ks.trailingEps?.raw,
    };
    _cache.set(key, { data: stats, ts: Date.now() });
    return stats;
  } catch {
    return null;
  }
}

// ── Symbol search ─────────────────────────────────────────────────────────────
export interface YFSearchResult {
  symbol: string;
  name:   string;
  typeDisp?: string;
  exchDisp?: string;
  market: "KR" | "US" | "OTHER";
}

export async function searchYFSymbols(query: string): Promise<YFSearchResult[]> {
  if (!query.trim()) return [];
  try {
    const url = `${YF_BASE}/v1/finance/search` +
      `?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0&enableFuzzyQuery=false`;
    const res = await fetch(url, {
      headers: YF_HEADERS,
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json() as {
      quotes?: Array<{
        symbol: string; shortname?: string; longname?: string;
        typeDisp?: string; exchDisp?: string; exchange?: string;
      }>;
    };
    return (json.quotes ?? [])
      .filter(q => q.typeDisp === "Equity" || q.typeDisp === "ETF")
      .slice(0, 8)
      .map(q => {
        const ex = q.exchange ?? "";
        const isKR = q.symbol.endsWith(".KS") || q.symbol.endsWith(".KQ") || ["KSC","KOE"].includes(ex);
        const isUS = ["NMS","NYQ","NGM","PCX","NCM"].includes(ex);
        return {
          symbol:   q.symbol,
          name:     q.shortname ?? q.longname ?? q.symbol,
          typeDisp: q.typeDisp,
          exchDisp: q.exchDisp,
          market:   isKR ? "KR" as const : isUS ? "US" as const : "OTHER" as const,
        };
      });
  } catch {
    return [];
  }
}

// ── Financial summary ────────────────────────────────────────────────────────
type RV = { raw?: number; fmt?: string };

export interface YFIncomeRow {
  endDate: RV & { fmt: string };
  totalRevenue?:     RV;
  grossProfit?:      RV;
  operatingIncome?:  RV;
  ebitda?:           RV;
  netIncome?:        RV;
}

export interface YFBalanceRow {
  endDate: RV & { fmt: string };
  totalAssets?:            RV;
  totalLiabilities?:       RV;
  totalStockholderEquity?: RV;
}

export interface YFCashFlowRow {
  endDate: RV & { fmt: string };
  totalCashFromOperatingActivities?: RV;
  capitalExpenditures?:              RV;
  freeCashFlow?:                     RV;
}

export interface YFFinancialsSummary {
  incomeStatementHistory?:            { incomeStatementHistory:   YFIncomeRow[] };
  balanceSheetHistory?:               { balanceSheetStatements:   YFBalanceRow[] };
  cashflowStatementHistory?:          { cashflowStatements:        YFCashFlowRow[] };
  incomeStatementHistoryQuarterly?:   { incomeStatementHistory:   YFIncomeRow[] };
  balanceSheetHistoryQuarterly?:      { balanceSheetStatements:   YFBalanceRow[] };
  cashflowStatementHistoryQuarterly?: { cashflowStatements:        YFCashFlowRow[] };
}

export async function fetchYFFinancials(symbol: string): Promise<YFFinancialsSummary | null> {
  const key = `fin_${symbol}`;
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.ts < 24 * 60 * 60_000) return hit.data as YFFinancialsSummary;

  const modules = [
    "incomeStatementHistory",
    "balanceSheetHistory",
    "cashflowStatementHistory",
    "incomeStatementHistoryQuarterly",
    "balanceSheetHistoryQuarterly",
    "cashflowStatementHistoryQuarterly",
  ].join(",");

  try {
    const json = await fetchV10(symbol, modules) as {
      quoteSummary: { result: YFFinancialsSummary[] | null; error?: unknown };
    } | null;
    if (!json || json.quoteSummary?.error || !json.quoteSummary?.result?.length) return null;
    const data = json.quoteSummary.result[0];
    _cache.set(key, { data, ts: Date.now() });
    return data;
  } catch {
    return null;
  }
}
