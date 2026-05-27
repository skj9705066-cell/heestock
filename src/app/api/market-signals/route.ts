import { fetchYFQuotes, fetchYFPriceHistory } from "@/lib/yahoo-finance";
import type { MarketSignal, ADRData } from "@/types/market";

export const runtime    = "nodejs";
export const dynamic    = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const KR_POOL = [
  "005930.KS","000660.KS","042700.KS","000990.KS",
  "373220.KS","006400.KS","247540.KQ","096770.KS",
  "005380.KS","000270.KS","012330.KS",
  "035420.KS","035720.KS",
  "259960.KS","036570.KQ","263750.KQ",
  "041510.KQ","035900.KQ",
  "068270.KS","207940.KS","326030.KS",
  "105560.KS","055550.KS","086790.KS",
  "051910.KS","011170.KS","009830.KS",
  "000720.KS","028260.KS",
  "005490.KS","004020.KS",
];

const SECTOR_MAP: Record<string, string> = {
  "005930.KS":"반도체","000660.KS":"반도체","042700.KS":"반도체","000990.KS":"반도체",
  "373220.KS":"이차전지","006400.KS":"이차전지","247540.KQ":"이차전지","096770.KS":"이차전지",
  "005380.KS":"자동차","000270.KS":"자동차","012330.KS":"자동차",
  "035420.KS":"인터넷/IT","035720.KS":"인터넷/IT",
  "259960.KS":"게임","036570.KQ":"게임","263750.KQ":"게임",
  "041510.KQ":"엔터","035900.KQ":"엔터",
  "068270.KS":"바이오","207940.KS":"바이오","326030.KS":"바이오",
  "105560.KS":"금융","055550.KS":"금융","086790.KS":"금융",
  "051910.KS":"화학/소재","011170.KS":"화학/소재","009830.KS":"화학/소재",
  "000720.KS":"건설","028260.KS":"건설",
  "005490.KS":"철강","004020.KS":"철강",
};

const NAME_MAP: Record<string, string> = {
  "005930.KS":"삼성전자","000660.KS":"SK하이닉스","042700.KS":"한미반도체","000990.KS":"DB하이텍",
  "373220.KS":"LG에너지솔루션","006400.KS":"삼성SDI","247540.KQ":"에코프로비엠","096770.KS":"SK이노베이션",
  "005380.KS":"현대차","000270.KS":"기아","012330.KS":"현대모비스",
  "035420.KS":"NAVER","035720.KS":"카카오",
  "259960.KS":"크래프톤","036570.KQ":"NCsoft","263750.KQ":"펄어비스",
  "041510.KQ":"에스엠","035900.KQ":"JYP엔터",
  "068270.KS":"셀트리온","207940.KS":"삼성바이오로직스","326030.KS":"SK바이오팜",
  "105560.KS":"KB금융","055550.KS":"신한지주","086790.KS":"하나금융지주",
  "051910.KS":"LG화학","011170.KS":"롯데케미칼","009830.KS":"한화솔루션",
  "000720.KS":"현대건설","028260.KS":"삼성물산",
  "005490.KS":"POSCO홀딩스","004020.KS":"현대제철",
};

const _cache = new Map<string, { data: unknown; ts: number }>();

export async function GET() {
  const cached = _cache.get("signals");
  if (cached && Date.now() - cached.ts < 5 * 60_000) {
    return Response.json(cached.data, {
      headers: { "Cache-Control": "no-store, must-revalidate" },
    });
  }

  // Fetch current quotes + per-symbol 5-day history (used to compute REAL
  // daily ADR from each day's close-vs-prev-close, instead of estimating).
  const [quotesRes, ...histResults] = await Promise.allSettled([
    fetchYFQuotes(KR_POOL),
    ...KR_POOL.map(sym => fetchYFPriceHistory(sym, "5d")),
  ]);

  const quotes  = quotesRes.status === "fulfilled" ? quotesRes.value : [];
  const symHist: Record<string, { ts: number; close: number }[]> = {};
  KR_POOL.forEach((sym, i) => {
    const r = histResults[i];
    if (r?.status === "fulfilled") symHist[sym] = r.value;
  });

  // ── ADR (today from pool) ────────────────────────────────────────────────
  let advancers = 0, decliners = 0, unchanged = 0;
  for (const q of quotes) {
    const chg = q.regularMarketChangePercent ?? 0;
    if (chg > 0.05)       advancers++;
    else if (chg < -0.05) decliners++;
    else                  unchanged++;
  }
  const totalADR  = advancers + decliners + (unchanged / 2);
  const todayADR  = totalADR > 0 ? parseFloat((advancers / Math.max(decliners, 1)).toFixed(2)) : 1.0;

  // ── Historical ADR chart from per-symbol close-vs-prev-close ─────────────
  // Build a map: trading-day-ts → { adv, dec } using REAL pool member moves.
  const dayBuckets = new Map<number, { adv: number; dec: number }>();
  for (const sym of KR_POOL) {
    const series = symHist[sym];
    if (!series || series.length < 2) continue;
    for (let i = 1; i < series.length; i++) {
      const prev = series[i - 1].close;
      const curr = series[i].close;
      if (!prev || !curr) continue;
      const chgPct = ((curr - prev) / prev) * 100;
      const ts = series[i].ts;
      const bucket = dayBuckets.get(ts) ?? { adv: 0, dec: 0 };
      if      (chgPct >  0.05) bucket.adv++;
      else if (chgPct < -0.05) bucket.dec++;
      dayBuckets.set(ts, bucket);
    }
  }

  const adrHistory: ADRData[] = [...dayBuckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(-5)
    .map(([ts, b]) => {
      const date = new Date(ts * 1000);
      const mm   = String(date.getMonth() + 1).padStart(2, "0");
      const dd   = String(date.getDate()).padStart(2, "0");
      const adr  = parseFloat((b.adv / Math.max(b.dec, 1)).toFixed(2));
      return { date: `${mm}/${dd}`, adr, advancers: b.adv, decliners: b.dec };
    });

  // Stamp today's row with the live ADR from quotes (more accurate than
  // close-vs-prev-close for an in-progress day).
  if (adrHistory.length > 0) {
    const todayDD = String(new Date().getDate()).padStart(2, "0");
    const last    = adrHistory[adrHistory.length - 1];
    if (last.date.endsWith(todayDD) && quotes.length > 0) {
      last.adr        = todayADR;
      last.advancers  = advancers;
      last.decliners  = decliners;
    }
  } else if (quotes.length > 0) {
    // No history available — show a single real data point for today only.
    const date = new Date();
    const mm   = String(date.getMonth() + 1).padStart(2, "0");
    const dd   = String(date.getDate()).padStart(2, "0");
    adrHistory.push({ date: `${mm}/${dd}`, adr: todayADR, advancers, decliners });
  }

  // ── % stocks near 52-week high ────────────────────────────────────────────
  let nearHigh52 = 0;
  for (const q of quotes) {
    const p = q.regularMarketPrice ?? 0;
    const h = q.fiftyTwoWeekHigh  ?? 0;
    if (h > 0 && p >= h * 0.8) nearHigh52++;
  }
  const pctNearHigh = quotes.length > 0 ? Math.round((nearHigh52 / quotes.length) * 100) : 50;

  // ── Signals ───────────────────────────────────────────────────────────────
  const signals: MarketSignal[] = [
    {
      type:   "short",
      signal: todayADR >= 1.3 ? "green" : todayADR >= 0.8 ? "yellow" : "red",
      label:  todayADR >= 1.3 ? "단기 매수 우위" : todayADR >= 0.8 ? "단기 중립" : "단기 매도 우위",
      description: `ADR ${todayADR} · 상승 ${advancers}개 / 하락 ${decliners}개`,
      value:  todayADR,
    },
    {
      type:   "long",
      signal: pctNearHigh >= 60 ? "green" : pctNearHigh >= 35 ? "yellow" : "red",
      label:  pctNearHigh >= 60 ? "장기 강세" : pctNearHigh >= 35 ? "장기 관찰" : "장기 약세",
      description: `52주 고가 80% 이상 종목 ${pctNearHigh}%`,
      value:  pctNearHigh,
    },
  ];

  // ── Sector leaders (sorted by changePercent) ───────────────────────────────
  const sectorMap = new Map<string, { changes: number[]; leader: string; leaderChg: number }>();
  for (const q of quotes) {
    const sector = SECTOR_MAP[q.symbol] ?? "";
    const name   = NAME_MAP[q.symbol]   ?? q.symbol;
    const chg    = q.regularMarketChangePercent ?? 0;
    if (!sector) continue;
    const bucket = sectorMap.get(sector) ?? { changes: [], leader: name, leaderChg: chg };
    bucket.changes.push(chg);
    if (chg > bucket.leaderChg) { bucket.leader = name; bucket.leaderChg = chg; }
    sectorMap.set(sector, bucket);
  }
  const leaderSectors = [...sectorMap.entries()]
    .map(([name, b]) => ({
      name,
      leader: b.leader,
      change: parseFloat((b.changes.reduce((a, c) => a + c, 0) / b.changes.length).toFixed(2)),
    }))
    .sort((a, b) => b.change - a.change)
    .slice(0, 6);

  // ── 52-week highs ─────────────────────────────────────────────────────────
  const fiftyTwoWeekHighs = quotes
    .filter(q => {
      const p = q.regularMarketPrice ?? 0;
      const h = q.fiftyTwoWeekHigh   ?? 0;
      return h > 0 && p >= h * 0.97;
    })
    .map(q => ({
      symbol:        q.symbol.replace(/\.(KS|KQ)$/, ""),
      name:          NAME_MAP[q.symbol] ?? q.shortName ?? q.symbol,
      price:         q.regularMarketPrice ?? 0,
      market:        "KR" as const,
      changePercent: q.regularMarketChangePercent ?? 0,
    }))
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 6);

  // ── Breakthrough list (big moves with high volume) ────────────────────────
  const breakthroughList = quotes
    .filter(q => {
      const chg = q.regularMarketChangePercent ?? 0;
      return Math.abs(chg) >= 3;
    })
    .map(q => ({
      symbol:        q.symbol.replace(/\.(KS|KQ)$/, ""),
      name:          NAME_MAP[q.symbol] ?? q.shortName ?? q.symbol,
      price:         q.regularMarketPrice ?? 0,
      changePercent: q.regularMarketChangePercent ?? 0,
      volume:        q.regularMarketVolume ?? 0,
      market:        "KR" as const,
      action: (q.regularMarketChangePercent ?? 0) > 0 ? "강세 돌파" : "지지선 이탈",
    }))
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
    .slice(0, 5);

  const result = { signals, adrHistory, leaderSectors, fiftyTwoWeekHighs, breakthroughList };
  _cache.set("signals", { data: result, ts: Date.now() });
  return Response.json(result, {
    headers: { "Cache-Control": "no-store, must-revalidate" },
  });
}
