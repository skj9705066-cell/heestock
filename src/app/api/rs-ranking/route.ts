import { fetchYFPriceHistory, fetchYFQuotes } from "@/lib/yahoo-finance";
import type { RSRankingEntry } from "@/types/stock";

export const runtime = "nodejs";

const POOL: Record<string, { name: string; sector: string; market: "KR" | "US" }> = {
  "005930.KS": { name: "삼성전자",        sector: "반도체",     market: "KR" },
  "000660.KS": { name: "SK하이닉스",      sector: "반도체",     market: "KR" },
  "042700.KS": { name: "한미반도체",      sector: "반도체",     market: "KR" },
  "000990.KS": { name: "DB하이텍",        sector: "반도체",     market: "KR" },
  "373220.KS": { name: "LG에너지솔루션",  sector: "이차전지",   market: "KR" },
  "006400.KS": { name: "삼성SDI",         sector: "이차전지",   market: "KR" },
  "247540.KQ": { name: "에코프로비엠",    sector: "이차전지",   market: "KR" },
  "096770.KS": { name: "SK이노베이션",    sector: "이차전지",   market: "KR" },
  "005380.KS": { name: "현대차",          sector: "자동차",     market: "KR" },
  "000270.KS": { name: "기아",            sector: "자동차",     market: "KR" },
  "012330.KS": { name: "현대모비스",      sector: "자동차",     market: "KR" },
  "035420.KS": { name: "NAVER",          sector: "인터넷/IT",  market: "KR" },
  "035720.KS": { name: "카카오",          sector: "인터넷/IT",  market: "KR" },
  "259960.KS": { name: "크래프톤",        sector: "게임",       market: "KR" },
  "036570.KQ": { name: "NCsoft",         sector: "게임",       market: "KR" },
  "263750.KQ": { name: "펄어비스",        sector: "게임",       market: "KR" },
  "041510.KQ": { name: "에스엠",          sector: "엔터",       market: "KR" },
  "068270.KS": { name: "셀트리온",        sector: "바이오",     market: "KR" },
  "207940.KS": { name: "삼성바이오로직스",sector: "바이오",     market: "KR" },
  "105560.KS": { name: "KB금융",          sector: "금융",       market: "KR" },
  "055550.KS": { name: "신한지주",        sector: "금융",       market: "KR" },
  "051910.KS": { name: "LG화학",          sector: "화학/소재",  market: "KR" },
  "009830.KS": { name: "한화솔루션",      sector: "화학/소재",  market: "KR" },
  "005490.KS": { name: "POSCO홀딩스",    sector: "철강",       market: "KR" },
  "004020.KS": { name: "현대제철",        sector: "철강",       market: "KR" },
  "NVDA":  { name: "엔비디아",    sector: "반도체/AI",  market: "US" },
  "AAPL":  { name: "애플",        sector: "하드웨어",   market: "US" },
  "MSFT":  { name: "마이크로소프트", sector: "소프트웨어", market: "US" },
  "META":  { name: "메타",        sector: "소셜미디어", market: "US" },
  "TSLA":  { name: "테슬라",      sector: "전기차",     market: "US" },
  "AMZN":  { name: "아마존",      sector: "클라우드",   market: "US" },
  "GOOGL": { name: "알파벳",      sector: "인터넷",     market: "US" },
  "AMD":   { name: "AMD",         sector: "반도체",     market: "US" },
  "AVGO":  { name: "브로드컴",    sector: "반도체",     market: "US" },
};

const _cache = new Map<string, { data: RSRankingEntry[]; ts: number }>();

function getMA(closes: number[], period: number): number {
  const n = Math.min(period, closes.length);
  if (n === 0) return 0;
  const slice = closes.slice(closes.length - n);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function getPeriodReturn(closes: number[], daysAgo: number): number {
  if (closes.length < 2) return 0;
  const idx = Math.max(0, closes.length - 1 - daysAgo);
  const past = closes[idx];
  const current = closes[closes.length - 1];
  return past > 0 ? ((current - past) / past) * 100 : 0;
}

function percentileRank(allValues: number[], value: number): number {
  const below = allValues.filter(v => v < value).length;
  return Math.max(1, Math.min(99, Math.round((below / allValues.length) * 98) + 1));
}

async function batchFetch<T>(
  items: string[],
  fn: (s: string) => Promise<T>,
  batchSize = 6,
): Promise<Map<string, T>> {
  const result = new Map<string, T>();
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(chunk.map(s => fn(s).then(r => [s, r] as const)));
    for (const r of settled) {
      if (r.status === "fulfilled") result.set(r.value[0], r.value[1]);
    }
  }
  return result;
}

export async function GET() {
  const cached = _cache.get("rs");
  if (cached && Date.now() - cached.ts < 15 * 60_000) {
    return Response.json(cached.data);
  }

  const symbols = Object.keys(POOL);

  const [histRes, quotesRes] = await Promise.allSettled([
    batchFetch(symbols, s => fetchYFPriceHistory(s, "1y")),
    fetchYFQuotes(symbols),
  ]);

  if (histRes.status === "rejected") {
    return Response.json({ error: "history fetch failed" }, { status: 500 });
  }

  const histories = histRes.value;
  const quoteMap  = new Map(
    (quotesRes.status === "fulfilled" ? quotesRes.value : []).map(q => [q.symbol, q]),
  );

  // Build per-stock return data
  const stockData: Array<{
    symbol: string; r1m: number; r3m: number; r6m: number; r12m: number; closes: number[];
  }> = [];

  for (const sym of symbols) {
    const pts = histories.get(sym) ?? [];
    if (pts.length < 20) continue;
    const closes = pts.map(p => p.close);
    stockData.push({
      symbol: sym,
      r1m:  getPeriodReturn(closes, 21),
      r3m:  getPeriodReturn(closes, 63),
      r6m:  getPeriodReturn(closes, 126),
      r12m: getPeriodReturn(closes, Math.min(251, closes.length - 2)),
      closes,
    });
  }

  if (!stockData.length) {
    return Response.json([]);
  }

  const r1ms  = stockData.map(s => s.r1m);
  const r3ms  = stockData.map(s => s.r3m);
  const r6ms  = stockData.map(s => s.r6m);
  const r12ms = stockData.map(s => s.r12m);

  const entries: RSRankingEntry[] = stockData.map(s => {
    const quote = quoteMap.get(s.symbol);
    const meta  = POOL[s.symbol];
    const closes = s.closes;
    const price  = quote?.regularMarketPrice ?? closes[closes.length - 1];

    const rs1m  = percentileRank(r1ms,  s.r1m);
    const rs3m  = percentileRank(r3ms,  s.r3m);
    const rs6m  = percentileRank(r6ms,  s.r6m);
    const rs12m = percentileRank(r12ms, s.r12m);
    // Minervini weighting: 12m × 2, 6m × 1, 3m × 1, 1m × 1
    const rsComposite = Math.round((rs12m * 2 + rs6m + rs3m + rs1m) / 5);

    // MTT moving averages
    const ma50  = getMA(closes, 50);
    const ma150 = getMA(closes, 150);
    const ma200 = getMA(closes, 200);
    // MA200 trend: compare current MA200 vs MA200 from ~1 month ago
    const ma200_1mAgo = closes.length >= 221
      ? closes.slice(closes.length - 221, closes.length - 21).reduce((a, b) => a + b, 0) / 200
      : ma200;

    const aboveMa50       = price > ma50;
    const aboveMa150      = price > ma150;
    const aboveMa200      = price > ma200;
    const ma50AboveMa150  = ma50  > ma150;
    const ma150AboveMa200 = ma150 > ma200;
    const ma200Trending   = ma200 > ma200_1mAgo;

    const low52w  = quote?.fiftyTwoWeekLow  ?? Math.min(...closes);
    const high52w = quote?.fiftyTwoWeekHigh ?? Math.max(...closes);
    const above30OfLow   = low52w  > 0 && price > low52w * 1.3;
    const within25OfHigh = high52w > 0 && price >= high52w * 0.75;
    const rs52wHigh      = rsComposite >= 70;
    const priceAbove10   = price > 10;

    const conditions = [
      aboveMa50, aboveMa150, aboveMa200,
      ma50AboveMa150, ma150AboveMa200, ma200Trending,
      above30OfLow, within25OfHigh, rs52wHigh, priceAbove10,
    ];
    const mttScore  = conditions.filter(Boolean).length;
    const mttMeets  = mttScore >= 8;
    const stage     = mttMeets ? 2 : mttScore >= 5 ? 1 : 0;

    const sym = s.symbol.replace(/\.(KS|KQ)$/, "");
    return {
      rank:          0,
      symbol:        sym,
      name:          meta?.name  ?? quote?.shortName ?? sym,
      market:        meta?.market ?? "US",
      sector:        meta?.sector ?? "",
      price,
      change:        quote?.regularMarketChange ?? 0,
      changePercent: quote?.regularMarketChangePercent ?? 0,
      rs1m, rs3m, rs6m, rs12m, rsComposite,
      mttMeets,
      stage,
    };
  });

  const ranked = entries
    .sort((a, b) => b.rsComposite - a.rsComposite)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  _cache.set("rs", { data: ranked, ts: Date.now() });
  return Response.json(ranked);
}
