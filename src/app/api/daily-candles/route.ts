import { NextRequest } from "next/server";
import { fetchKisDailyCandles } from "@/lib/kis";
import type { OHLCVPoint } from "@/lib/support-levels";

export const runtime = "nodejs";

const cache = new Map<string, { data: OHLCVPoint[]; ts: number }>();
const CACHE_TTL = 15 * 60_000; // 15분
const STALE_OK_TTL = 24 * 60 * 60_000; // 24시간 (일시 빈 응답 시 오래된 캐시 허용)

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
      } else if (kisData.length === 0) {
        // 빈 응답: 장 마감 직후 일시적 공백일 수 있음
        console.warn(`[daily-candles] KIS returned empty array for ${symbol} - checking stale cache`);

        // 24시간 이내 오래된 캐시가 있으면 유지
        if (cached && Date.now() - cached.ts < STALE_OK_TTL) {
          console.log(`[daily-candles] Using stale cache for ${symbol} (age: ${Math.round((Date.now() - cached.ts) / 60000)}min)`);
          return Response.json(cached.data, {
            headers: {
              "X-Cache": "STALE",
              "X-Cache-Age": String(Math.round((Date.now() - cached.ts) / 1000)),
            },
          });
        }

        // 캐시 없으면 빈 배열 + 안내 헤더
        console.warn(`[daily-candles] No stale cache available for ${symbol} - returning empty with notice`);
        return Response.json([], {
          headers: {
            "X-No-Data": "true",
            "X-Notice": "장 마감 후 데이터 준비 중",
          },
        });
      } else {
        console.warn(`[daily-candles] KIS returned insufficient data: ${kisData.length} candles (need 20+)`);
      }
    } catch (e) {
      console.error("[daily-candles] KIS failed:", (e as Error).message);

      // API 에러 시에도 stale cache 시도
      if (cached && Date.now() - cached.ts < STALE_OK_TTL) {
        console.log(`[daily-candles] Using stale cache after error for ${symbol}`);
        return Response.json(cached.data, {
          headers: {
            "X-Cache": "STALE-ERROR",
            "X-Cache-Age": String(Math.round((Date.now() - cached.ts) / 1000)),
          },
        });
      }
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
