import { NextRequest } from "next/server";

export const runtime = "nodejs";

export interface OHLCVPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// In-memory cache (lives for the process lifetime)
const cache = new Map<string, { data: OHLCVPoint[]; ts: number }>();
const CACHE_TTL = 60_000;

// ── Mock fallback ────────────────────────────────────────────────────────────

function generateMockData(symbol: string, count: number): OHLCVPoint[] {
  const base =
    symbol.includes("KS11") ? 2620 :
    symbol.includes("KQ11") ? 868  :
    symbol.includes("IXIC") ? 19100 : 5280;

  const data: OHLCVPoint[] = [];
  let price = base;
  const now = new Date();

  for (let i = count; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const drift  = (Math.random() - 0.47) * price * 0.018;
    const open   = price;
    const close  = Math.max(price + drift, 1);
    const hi     = Math.max(open, close) * (1 + Math.random() * 0.006);
    const lo     = Math.min(open, close) * (1 - Math.random() * 0.006);
    const volume = Math.floor(Math.random() * 12_000_000 + 800_000);

    const round2 = (n: number) => Math.round(n * 100) / 100;
    data.push({
      date: d.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }),
      open:   round2(open),
      high:   round2(hi),
      low:    round2(lo),
      close:  round2(close),
      volume,
    });
    price = close;
  }
  return data;
}

// ── Yahoo Finance ────────────────────────────────────────────────────────────

async function fetchYahoo(
  symbol: string,
  interval: string,
  range: string,
): Promise<OHLCVPoint[]> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/` +
    `${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&events=history`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      Referer: "https://finance.yahoo.com/",
    },
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: 60 },
  });

  if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result?.timestamp) throw new Error("Empty Yahoo response");

  const timestamps = result.timestamp as number[];
  const q = result.indicators.quote[0] as {
    open:   (number | null)[];
    high:   (number | null)[];
    low:    (number | null)[];
    close:  (number | null)[];
    volume: (number | null)[];
  };

  return timestamps
    .map((ts, i) => ({
      date:   new Date(ts * 1000).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }),
      open:   q.open[i]   ?? 0,
      high:   q.high[i]   ?? 0,
      low:    q.low[i]    ?? 0,
      close:  q.close[i]  ?? 0,
      volume: q.volume[i] ?? 0,
    }))
    .filter(d => d.open > 0 && d.close > 0 && d.high > 0 && d.low > 0);
}

// ── Alpha Vantage (optional – US only) ──────────────────────────────────────

const AV_SYMBOL_MAP: Record<string, string> = {
  "^GSPC": "SPY",
  "^IXIC": "QQQ",
};

async function fetchAlphaVantage(
  symbol: string,
  interval: string,
): Promise<OHLCVPoint[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) throw new Error("No AV key");

  const avSymbol = AV_SYMBOL_MAP[symbol];
  if (!avSymbol) throw new Error("Symbol not in AV map");

  const fn =
    interval === "1mo" ? "TIME_SERIES_MONTHLY_ADJUSTED" :
    interval === "1wk" ? "TIME_SERIES_WEEKLY_ADJUSTED"  :
                          "TIME_SERIES_DAILY_ADJUSTED";

  const url =
    `https://www.alphavantage.co/query?function=${fn}&symbol=${avSymbol}` +
    `&outputsize=full&apikey=${apiKey}`;

  const res  = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const json = await res.json() as Record<string, unknown>;

  const seriesKey = Object.keys(json).find(k => k.startsWith("Time Series")) ?? "";
  const series = json[seriesKey] as Record<string, Record<string, string>> | undefined;
  if (!series) throw new Error("AV: no series key");

  return Object.entries(series)
    .slice(0, 250)
    .map(([dateStr, v]) => ({
      date:   new Date(dateStr).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }),
      open:   parseFloat(v["1. open"]),
      high:   parseFloat(v["2. high"]),
      low:    parseFloat(v["3. low"]),
      close:  parseFloat(v["5. adjusted close"] ?? v["4. close"]),
      volume: parseInt(v["6. volume"] ?? v["5. volume"] ?? "0"),
    }))
    .reverse();
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const symbol   = req.nextUrl.searchParams.get("symbol")   ?? "^GSPC";
  const interval = req.nextUrl.searchParams.get("interval") ?? "1d";
  const range    = req.nextUrl.searchParams.get("range")    ?? "6mo";

  const cacheKey = `${symbol}|${interval}|${range}`;
  const cached   = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return Response.json(cached.data, { headers: { "X-Cache": "HIT" } });
  }

  let data: OHLCVPoint[] | null = null;

  // 1) Try Yahoo Finance
  try {
    data = await fetchYahoo(symbol, interval, range);
  } catch (e) {
    console.warn("[chart-data] Yahoo failed:", (e as Error).message);
  }

  // 2) Try Alpha Vantage for US indices if Yahoo failed and key is available
  if (!data && process.env.ALPHA_VANTAGE_API_KEY) {
    try {
      data = await fetchAlphaVantage(symbol, interval);
    } catch (e) {
      console.warn("[chart-data] AV failed:", (e as Error).message);
    }
  }

  // 3) Fallback to mock
  if (!data || data.length < 5) {
    const count = range === "6mo" ? 120 : range === "2y" ? 104 : 60;
    data = generateMockData(symbol, count);
    console.warn("[chart-data] Using mock data for", symbol);
    return Response.json(data, { headers: { "X-Fallback": "mock" } });
  }

  cache.set(cacheKey, { data, ts: Date.now() });
  return Response.json(data);
}
