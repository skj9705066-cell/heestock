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

  // 3) No real data available — return empty array; UI renders an empty-state message.
  if (!data || data.length < 5) {
    return Response.json([], { headers: { "X-No-Data": "true" } });
  }

  cache.set(cacheKey, { data, ts: Date.now() });
  return Response.json(data);
}
