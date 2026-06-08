import { NextRequest } from "next/server";
import { fetchKisDailyCandles } from "@/lib/kis";
import type { OHLCVPoint } from "@/lib/support-levels";

export const runtime = "nodejs";

const cache = new Map<string, { data: OHLCVPoint[]; ts: number }>();
const CACHE_TTL = 15 * 60_000; // 15분

// Yahoo Finance fallback for US stocks
async function fetchYahooCandles(symbol: string, days: number): Promise<OHLCVPoint[]> {
  const range    = days > 60 ? "6mo" : "3mo";
  const interval = "1d";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&events=history`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      "Referer": "https://finance.yahoo.com/",
    },
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result?.timestamp) throw new Error("Empty Yahoo response");
  const timestamps = result.timestamp as number[];
  const q = result.indicators.quote[0] as {
    open:   (number|null)[];
    high:   (number|null)[];
    low:    (number|null)[];
    close:  (number|null)[];
    volume: (number|null)[];
  };
  return timestamps
    .map((ts, i) => ({
      date:   new Date(ts * 1000).toISOString().slice(0, 10),
      open:   q.open[i]   ?? 0,
      high:   q.high[i]   ?? 0,
      low:    q.low[i]    ?? 0,
      close:  q.close[i]  ?? 0,
      volume: q.volume[i] ?? 0,
    }))
    .filter(d => d.open > 0 && d.close > 0)
    .slice(-days);
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") ?? "";
  const market = req.nextUrl.searchParams.get("market") ?? "KR";
  const days   = parseInt(req.nextUrl.searchParams.get("days") ?? "130", 10);

  if (!symbol) return Response.json([], { status: 400 });

  const cacheKey = `${symbol}|${market}|${days}`;
  const cached   = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return Response.json(cached.data, { headers: { "X-Cache": "HIT" } });
  }

  let data: OHLCVPoint[] = [];

  if (market === "KR") {
    // KIS API 단일 소스 (Yahoo fallback 제거)
    try {
      const kisData = await fetchKisDailyCandles(symbol, days);
      if (kisData.length >= 20) {
        data = kisData;
      } else {
        console.warn(`[daily-candles] KIS returned insufficient data: ${kisData.length} candles (need 20+)`);
      }
    } catch (e) {
      console.error("[daily-candles] KIS failed:", (e as Error).message);
    }
  } else {
    // US stocks: Yahoo Finance
    try {
      data = await fetchYahooCandles(symbol, days);
    } catch (e) {
      console.warn("[daily-candles] Yahoo US failed:", (e as Error).message);
    }
  }

  if (data.length < 5) {
    return Response.json([], { headers: { "X-No-Data": "true" } });
  }

  cache.set(cacheKey, { data, ts: Date.now() });
  return Response.json(data);
}
