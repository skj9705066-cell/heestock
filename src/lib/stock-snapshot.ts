// Aggregates real-time stock data for the AI analysis page.
// Used by both /api/stock-snapshot (UI display) and /api/ai-chat (prompt injection).

import {
  fetchYFQuotes,
  fetchYFKeyStats,
  fetchYFPriceHistory,
  fetchYFFinancials,
  type YFQuote,
  type YFKeyStats,
  type PricePoint,
  type YFIncomeRow,
} from "@/lib/yahoo-finance";
import { fetchDartKrFinancials } from "@/lib/dart";

export type Market = "KR" | "US";

export interface SnapshotQuote {
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  dayHigh?: number;
  dayLow?: number;
  previousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  pricePosition52w?: number; // 0-100, % position between low and high
  marketCap?: number;
  currency: string;
}

export interface SnapshotKeyStats {
  trailingPE?: number;
  forwardPE?: number;
  priceToBook?: number;
  returnOnEquity?: number; // percent
  priceToSales?: number;
  enterpriseToEbitda?: number;
  trailingEps?: number;
}

export interface SnapshotPriceHistoryPoint {
  date: string;
  close: number;
}

export interface SnapshotPriceHistory {
  startDate: string;
  endDate: string;
  startPrice: number;
  endPrice: number;
  high: number;
  low: number;
  return1y?: number; // percent
  return3m?: number;
  return1m?: number;
  avgVolume30d?: number;
  points: SnapshotPriceHistoryPoint[];
}

export interface SnapshotFinancialRow {
  period: string;
  revenue?: number;
  operatingIncome?: number;
  netIncome?: number;
  operatingMargin?: number;
  netMargin?: number;
  revenueYoY?: number;
  operatingIncomeYoY?: number;
  netIncomeYoY?: number;
}

export interface SnapshotFinancials {
  source: "DART" | "Yahoo";
  unit: string;
  currency: string;
  latestQuarter?: SnapshotFinancialRow;
  latestAnnual?: SnapshotFinancialRow;
  annualHistory?: SnapshotFinancialRow[];
  quarterlyHistory?: SnapshotFinancialRow[];
}

export interface StockSnapshot {
  symbol: string;
  name: string;
  market: Market;
  asOfDate: string;          // YYYY-MM-DD
  asOfDateKr: string;         // 2026년 5월 27일
  quote?: SnapshotQuote;
  keyStats?: SnapshotKeyStats;
  priceHistory?: SnapshotPriceHistory;
  financials?: SnapshotFinancials;
  errors: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function detectMarket(symbol: string, hint?: Market): Market {
  if (hint) return hint;
  if (/\.(KS|KQ)$/.test(symbol)) return "KR";
  if (/^\d{6}$/.test(symbol)) return "KR";
  return "US";
}

function yfSymbol(symbol: string, market: Market): string {
  if (market === "KR" && /^\d{6}$/.test(symbol)) return `${symbol}.KS`;
  return symbol;
}

function fmtDateKr(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function pct(n: number): number {
  return Math.round(n * 100) / 100;
}

// Margin helper (percent, 1 decimal)
function margin(part?: number, total?: number): number | undefined {
  if (part === undefined || !total) return undefined;
  return Math.round((part / total) * 1000) / 10;
}

function yoy(curr?: number, prev?: number): number | undefined {
  if (curr === undefined || prev === undefined || prev === 0) return undefined;
  // Use absolute value of prev to handle sign correctly when both numbers can be negative.
  return Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10;
}

// Compare two quarter labels like "25Q3" and "24Q3" — true if same quarter, prior year.
function isPriorYearQuarter(curr: string, prev: string): boolean {
  const m1 = /^(\d{2})Q([1-4])$/.exec(curr);
  const m2 = /^(\d{2})Q([1-4])$/.exec(prev);
  if (!m1 || !m2) return false;
  return m1[2] === m2[2] && parseInt(m1[1], 10) === parseInt(m2[1], 10) + 1;
}

// ── Price history summarization ─────────────────────────────────────────────

function buildPriceHistory(points: PricePoint[]): SnapshotPriceHistory | undefined {
  if (!points.length) return undefined;
  const sorted = [...points].sort((a, b) => a.ts - b.ts);
  const closes = sorted.map(p => p.close);
  const high = Math.max(...closes);
  const low = Math.min(...closes);
  const startPrice = sorted[0].close;
  const endPrice = sorted[sorted.length - 1].close;
  const startDate = new Date(sorted[0].ts * 1000).toISOString().slice(0, 10);
  const endDate = new Date(sorted[sorted.length - 1].ts * 1000).toISOString().slice(0, 10);

  const return1y = pct(((endPrice - startPrice) / startPrice) * 100);
  // 3m ~= 63 trading days back, 1m ~= 21
  const ref3m = sorted[Math.max(0, sorted.length - 1 - 63)]?.close;
  const ref1m = sorted[Math.max(0, sorted.length - 1 - 21)]?.close;
  const return3m = ref3m ? pct(((endPrice - ref3m) / ref3m) * 100) : undefined;
  const return1m = ref1m ? pct(((endPrice - ref1m) / ref1m) * 100) : undefined;

  // Trim to ~52 weekly samples for the UI/prompt
  const stride = Math.max(1, Math.floor(sorted.length / 52));
  const trimmed: SnapshotPriceHistoryPoint[] = [];
  for (let i = 0; i < sorted.length; i += stride) {
    trimmed.push({
      date: new Date(sorted[i].ts * 1000).toISOString().slice(0, 10),
      close: Math.round(sorted[i].close * 100) / 100,
    });
  }
  if (trimmed[trimmed.length - 1]?.date !== endDate) {
    trimmed.push({ date: endDate, close: Math.round(endPrice * 100) / 100 });
  }

  return {
    startDate,
    endDate,
    startPrice: Math.round(startPrice * 100) / 100,
    endPrice: Math.round(endPrice * 100) / 100,
    high: Math.round(high * 100) / 100,
    low: Math.round(low * 100) / 100,
    return1y,
    return3m,
    return1m,
    points: trimmed,
  };
}

function buildQuote(q: YFQuote | null, market: Market): SnapshotQuote | undefined {
  if (!q || q.regularMarketPrice === undefined) return undefined;
  const price = q.regularMarketPrice;
  const prev = q.regularMarketPreviousClose ?? price;
  const change = q.regularMarketChange ?? price - prev;
  const changePercent = q.regularMarketChangePercent ?? (prev ? (change / prev) * 100 : 0);

  let pricePosition52w: number | undefined;
  if (q.fiftyTwoWeekHigh && q.fiftyTwoWeekLow && q.fiftyTwoWeekHigh > q.fiftyTwoWeekLow) {
    pricePosition52w = pct(((price - q.fiftyTwoWeekLow) / (q.fiftyTwoWeekHigh - q.fiftyTwoWeekLow)) * 100);
  }

  return {
    price,
    change: Math.round(change * 100) / 100,
    changePercent: pct(changePercent),
    volume: q.regularMarketVolume,
    dayHigh: q.regularMarketDayHigh,
    dayLow: q.regularMarketDayLow,
    previousClose: prev,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow,
    pricePosition52w,
    marketCap: q.marketCap,
    currency: market === "KR" ? "KRW" : "USD",
  };
}

function buildKeyStats(stats: YFKeyStats | null): SnapshotKeyStats | undefined {
  if (!stats) return undefined;
  return {
    trailingPE: stats.trailingPE,
    forwardPE: stats.forwardPE,
    priceToBook: stats.priceToBook,
    returnOnEquity: stats.returnOnEquity !== undefined ? pct(stats.returnOnEquity * 100) : undefined,
    priceToSales: stats.priceToSalesTrailing12Months,
    enterpriseToEbitda: stats.enterpriseToEbitda,
    trailingEps: stats.trailingEps,
  };
}

// ── DART financials → snapshot rows ─────────────────────────────────────────

async function buildKrFinancials(stockCode: string): Promise<SnapshotFinancials | undefined> {
  try {
    const fin = await fetchDartKrFinancials(stockCode);

    const annualHistory: SnapshotFinancialRow[] = fin.annual.map(r => ({
      period: r.period,
      revenue: r.revenue,
      operatingIncome: r.operatingIncome,
      netIncome: r.netIncome,
      operatingMargin: margin(r.operatingIncome, r.revenue),
      netMargin: margin(r.netIncome, r.revenue),
    }));
    // Add YoY to annual
    for (let i = 1; i < annualHistory.length; i++) {
      const curr = annualHistory[i];
      const prev = annualHistory[i - 1];
      curr.revenueYoY = yoy(curr.revenue, prev.revenue);
      curr.operatingIncomeYoY = yoy(curr.operatingIncome, prev.operatingIncome);
      curr.netIncomeYoY = yoy(curr.netIncome, prev.netIncome);
    }

    // Quarterly — keep only quarters that actually reported (revenue defined)
    const quarterlyHistory: SnapshotFinancialRow[] = fin.quarterly
      .filter(r => r.revenue !== undefined && r.revenue !== 0)
      .map(r => ({
        period: r.period,
        revenue: r.revenue,
        operatingIncome: r.operatingIncome,
        netIncome: r.netIncome,
        operatingMargin: margin(r.operatingIncome, r.revenue),
        netMargin: margin(r.netIncome, r.revenue),
      }));

    // YoY for the latest quarter — find same quarter in prior year if we have it.
    // DART path returns only current FY quarters, so YoY for quarter requires prior year fetch.
    // We add YoY-vs-prior-quarter (QoQ) here instead, which is more achievable with available data.
    for (let i = 1; i < quarterlyHistory.length; i++) {
      const curr = quarterlyHistory[i];
      const prev = quarterlyHistory[i - 1];
      curr.revenueYoY = yoy(curr.revenue, prev.revenue); // QoQ actually
      curr.operatingIncomeYoY = yoy(curr.operatingIncome, prev.operatingIncome);
      curr.netIncomeYoY = yoy(curr.netIncome, prev.netIncome);
    }

    const latestAnnual = annualHistory[annualHistory.length - 1];
    const latestQuarter = quarterlyHistory[quarterlyHistory.length - 1];

    return {
      source: "DART",
      unit: "억원",
      currency: "KRW",
      latestQuarter,
      latestAnnual,
      annualHistory,
      quarterlyHistory,
    };
  } catch {
    return undefined;
  }
}

// ── Yahoo financials → snapshot rows (for US stocks) ────────────────────────

async function buildUsFinancials(symbol: string): Promise<SnapshotFinancials | undefined> {
  try {
    const fin = await fetchYFFinancials(symbol);
    if (!fin) return undefined;

    const incA = fin.incomeStatementHistory?.incomeStatementHistory ?? [];
    const incQ = fin.incomeStatementHistoryQuarterly?.incomeStatementHistory ?? [];
    if (!incA.length && !incQ.length) return undefined;

    const toMil = (v?: number) => (v !== undefined ? Math.round(v / 1_000_000) : undefined);
    const toRow = (inc: YFIncomeRow, period: string): SnapshotFinancialRow => {
      const rev = toMil(inc.totalRevenue?.raw);
      const op = toMil(inc.operatingIncome?.raw);
      const ni = toMil(inc.netIncome?.raw);
      return {
        period,
        revenue: rev,
        operatingIncome: op,
        netIncome: ni,
        operatingMargin: margin(op, rev),
        netMargin: margin(ni, rev),
      };
    };

    const annualHistory: SnapshotFinancialRow[] = [...incA]
      .slice(0, 4)
      .reverse()
      .map(inc => toRow(inc, new Date(inc.endDate.fmt).getFullYear().toString()));

    for (let i = 1; i < annualHistory.length; i++) {
      const curr = annualHistory[i];
      const prev = annualHistory[i - 1];
      curr.revenueYoY = yoy(curr.revenue, prev.revenue);
      curr.operatingIncomeYoY = yoy(curr.operatingIncome, prev.operatingIncome);
      curr.netIncomeYoY = yoy(curr.netIncome, prev.netIncome);
    }

    const qLabel = (dateStr: string): string => {
      const d = new Date(dateStr);
      return `${String(d.getFullYear()).slice(2)}Q${Math.ceil((d.getMonth() + 1) / 3)}`;
    };
    const quarterlyHistory: SnapshotFinancialRow[] = [...incQ]
      .slice(0, 8)
      .reverse()
      .map(inc => toRow(inc, qLabel(inc.endDate.fmt)));

    // Quarter YoY — match same Qn from prior year
    for (let i = 0; i < quarterlyHistory.length; i++) {
      const curr = quarterlyHistory[i];
      const priorYear = quarterlyHistory.find(p => isPriorYearQuarter(curr.period, p.period));
      if (priorYear) {
        curr.revenueYoY = yoy(curr.revenue, priorYear.revenue);
        curr.operatingIncomeYoY = yoy(curr.operatingIncome, priorYear.operatingIncome);
        curr.netIncomeYoY = yoy(curr.netIncome, priorYear.netIncome);
      }
    }

    return {
      source: "Yahoo",
      unit: "백만달러",
      currency: "USD",
      latestAnnual: annualHistory[annualHistory.length - 1],
      latestQuarter: quarterlyHistory[quarterlyHistory.length - 1],
      annualHistory,
      quarterlyHistory: quarterlyHistory.slice(-4),
    };
  } catch {
    return undefined;
  }
}

// ── Main entry ──────────────────────────────────────────────────────────────

const _snapshotCache = new Map<string, { data: StockSnapshot; ts: number }>();
const SNAPSHOT_TTL = 5 * 60_000;

export async function buildStockSnapshot(
  symbol: string,
  name: string,
  marketHint?: Market,
): Promise<StockSnapshot> {
  const market = detectMarket(symbol, marketHint);
  const cacheKey = `${symbol}|${market}`;
  const hit = _snapshotCache.get(cacheKey);
  if (hit && Date.now() - hit.ts < SNAPSHOT_TTL) return hit.data;

  const now = new Date();
  const asOfDate = now.toISOString().slice(0, 10);
  const asOfDateKr = fmtDateKr(now);
  const errors: string[] = [];

  const yfSym = yfSymbol(symbol, market);
  const stockCode = symbol.replace(/\.(KS|KQ)$/, "");

  // Run all fetches in parallel.
  const [qRes, ksRes, histRes, finRes] = await Promise.allSettled([
    fetchYFQuotes([yfSym]).then(arr => arr[0] ?? null),
    fetchYFKeyStats(yfSym),
    fetchYFPriceHistory(yfSym, "1y"),
    market === "KR" ? buildKrFinancials(stockCode) : buildUsFinancials(yfSym),
  ]);

  const quote = qRes.status === "fulfilled" ? buildQuote(qRes.value, market) : undefined;
  if (qRes.status === "rejected" || !quote) errors.push("실시간 시세 조회 실패");

  const keyStats = ksRes.status === "fulfilled" ? buildKeyStats(ksRes.value) : undefined;
  if (ksRes.status === "rejected") errors.push("재무비율(PER/PBR/ROE) 조회 실패");

  const priceHistory = histRes.status === "fulfilled" ? buildPriceHistory(histRes.value) : undefined;
  if (histRes.status === "rejected" || !priceHistory) errors.push("1년 주가 추이 조회 실패");

  const financials = finRes.status === "fulfilled" ? finRes.value : undefined;
  if (finRes.status === "rejected" || !financials) {
    errors.push(market === "KR" ? "DART 재무제표 조회 실패" : "Yahoo 재무제표 조회 실패");
  }

  const snapshot: StockSnapshot = {
    symbol: stockCode,
    name,
    market,
    asOfDate,
    asOfDateKr,
    quote,
    keyStats,
    priceHistory,
    financials,
    errors,
  };

  _snapshotCache.set(cacheKey, { data: snapshot, ts: Date.now() });
  return snapshot;
}

// ── Prompt formatting ───────────────────────────────────────────────────────

function fmtNum(n: number | undefined, unit = "", digits = 0): string {
  if (n === undefined || Number.isNaN(n)) return "N/A";
  return `${n.toLocaleString("ko-KR", { maximumFractionDigits: digits })}${unit}`;
}

function fmtPct(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return "N/A";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function fmtMarketCap(n: number | undefined, currency: string): string {
  if (!n) return "N/A";
  if (currency === "KRW") {
    if (n >= 1e12) return `${(n / 1e12).toFixed(2)}조원`;
    if (n >= 1e8) return `${Math.round(n / 1e8).toLocaleString("ko-KR")}억원`;
    return `${n.toLocaleString("ko-KR")}원`;
  }
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

export function formatSnapshotForPrompt(snap: StockSnapshot): string {
  const lines: string[] = [];
  const cur = snap.quote?.currency ?? (snap.market === "KR" ? "KRW" : "USD");
  const currencySym = cur === "KRW" ? "원" : "$";
  const priceFmt = (n?: number, digits = cur === "KRW" ? 0 : 2) =>
    n === undefined ? "N/A" : `${cur === "KRW" ? "" : "$"}${n.toLocaleString("ko-KR", { maximumFractionDigits: digits })}${cur === "KRW" ? "원" : ""}`;

  lines.push(`# ${snap.name} (${snap.symbol}) 실시간 데이터`);
  lines.push(`**기준일: ${snap.asOfDateKr}** · 시장: ${snap.market === "KR" ? "한국" : "미국"}`);
  lines.push("");

  if (snap.quote) {
    const q = snap.quote;
    lines.push("## 현재 시세");
    lines.push(`- 현재가: ${priceFmt(q.price)} (${q.change >= 0 ? "+" : ""}${q.change.toLocaleString("ko-KR")}${currencySym}, ${fmtPct(q.changePercent)})`);
    lines.push(`- 전일종가: ${priceFmt(q.previousClose)}`);
    if (q.dayHigh !== undefined && q.dayLow !== undefined) {
      lines.push(`- 당일 고가/저가: ${priceFmt(q.dayHigh)} / ${priceFmt(q.dayLow)}`);
    }
    if (q.volume !== undefined) lines.push(`- 거래량: ${q.volume.toLocaleString("ko-KR")}주`);
    if (q.fiftyTwoWeekHigh && q.fiftyTwoWeekLow) {
      lines.push(`- 52주 최고/최저: ${priceFmt(q.fiftyTwoWeekHigh)} / ${priceFmt(q.fiftyTwoWeekLow)}`);
      if (q.pricePosition52w !== undefined) {
        lines.push(`- 52주 밴드 내 위치: ${q.pricePosition52w.toFixed(1)}% (0%=최저, 100%=최고)`);
      }
    }
    if (q.marketCap) lines.push(`- 시가총액: ${fmtMarketCap(q.marketCap, cur)}`);
    lines.push("");
  }

  if (snap.keyStats) {
    const k = snap.keyStats;
    const hasAny = [k.trailingPE, k.forwardPE, k.priceToBook, k.returnOnEquity, k.priceToSales].some(v => v !== undefined);
    if (hasAny) {
      lines.push("## 밸류에이션 지표");
      if (k.trailingPE !== undefined) lines.push(`- PER (TTM): ${k.trailingPE.toFixed(2)}배`);
      if (k.forwardPE !== undefined) lines.push(`- Forward PER: ${k.forwardPE.toFixed(2)}배`);
      if (k.priceToBook !== undefined) lines.push(`- PBR: ${k.priceToBook.toFixed(2)}배`);
      if (k.returnOnEquity !== undefined) lines.push(`- ROE: ${k.returnOnEquity.toFixed(2)}%`);
      if (k.priceToSales !== undefined) lines.push(`- PSR (TTM): ${k.priceToSales.toFixed(2)}배`);
      if (k.enterpriseToEbitda !== undefined) lines.push(`- EV/EBITDA: ${k.enterpriseToEbitda.toFixed(2)}배`);
      if (k.trailingEps !== undefined) lines.push(`- EPS (TTM): ${priceFmt(k.trailingEps, 2)}`);
      lines.push("");
    }
  }

  if (snap.priceHistory) {
    const h = snap.priceHistory;
    lines.push("## 최근 1년 주가 추이");
    lines.push(`- 기간: ${h.startDate} ~ ${h.endDate}`);
    lines.push(`- 시작가/현재가: ${priceFmt(h.startPrice)} → ${priceFmt(h.endPrice)}`);
    lines.push(`- 1년 고점/저점: ${priceFmt(h.high)} / ${priceFmt(h.low)}`);
    if (h.return1y !== undefined) lines.push(`- 1년 수익률: ${fmtPct(h.return1y)}`);
    if (h.return3m !== undefined) lines.push(`- 최근 3개월 수익률: ${fmtPct(h.return3m)}`);
    if (h.return1m !== undefined) lines.push(`- 최근 1개월 수익률: ${fmtPct(h.return1m)}`);
    lines.push("");
  }

  if (snap.financials) {
    const f = snap.financials;
    lines.push(`## 최신 재무 (출처: ${f.source}, 단위: ${f.unit})`);

    // DART quarterly comparisons are QoQ (same-FY only); Yahoo quarterly comparisons are true YoY.
    const qoqLabel = f.source === "DART" ? "전분기" : "전년동기";

    if (f.latestQuarter) {
      const q = f.latestQuarter;
      lines.push(`### 최신 분기 (${q.period})`);
      lines.push(`- 매출액: ${fmtNum(q.revenue, " " + f.unit)}${q.revenueYoY !== undefined ? ` (${qoqLabel} ${fmtPct(q.revenueYoY)})` : ""}`);
      lines.push(`- 영업이익: ${fmtNum(q.operatingIncome, " " + f.unit)}${q.operatingIncomeYoY !== undefined ? ` (${qoqLabel} ${fmtPct(q.operatingIncomeYoY)})` : ""}${q.operatingMargin !== undefined ? `, 영업이익률 ${q.operatingMargin.toFixed(1)}%` : ""}`);
      lines.push(`- 순이익: ${fmtNum(q.netIncome, " " + f.unit)}${q.netIncomeYoY !== undefined ? ` (${qoqLabel} ${fmtPct(q.netIncomeYoY)})` : ""}${q.netMargin !== undefined ? `, 순이익률 ${q.netMargin.toFixed(1)}%` : ""}`);
    }

    if (f.latestAnnual) {
      const a = f.latestAnnual;
      lines.push(`### 최신 연간 (${a.period})`);
      lines.push(`- 매출액: ${fmtNum(a.revenue, " " + f.unit)}${a.revenueYoY !== undefined ? ` (YoY ${fmtPct(a.revenueYoY)})` : ""}`);
      lines.push(`- 영업이익: ${fmtNum(a.operatingIncome, " " + f.unit)}${a.operatingIncomeYoY !== undefined ? ` (YoY ${fmtPct(a.operatingIncomeYoY)})` : ""}${a.operatingMargin !== undefined ? `, 영업이익률 ${a.operatingMargin.toFixed(1)}%` : ""}`);
      lines.push(`- 순이익: ${fmtNum(a.netIncome, " " + f.unit)}${a.netIncomeYoY !== undefined ? ` (YoY ${fmtPct(a.netIncomeYoY)})` : ""}${a.netMargin !== undefined ? `, 순이익률 ${a.netMargin.toFixed(1)}%` : ""}`);
    }

    if (f.annualHistory && f.annualHistory.length > 1) {
      lines.push("### 연간 추이");
      for (const row of f.annualHistory) {
        lines.push(`- ${row.period}: 매출 ${fmtNum(row.revenue)} / 영업이익 ${fmtNum(row.operatingIncome)} / 순이익 ${fmtNum(row.netIncome)}`);
      }
    }
    lines.push("");
  }

  if (snap.errors.length) {
    lines.push(`> 일부 데이터 조회 실패: ${snap.errors.join(", ")}`);
  }

  return lines.join("\n");
}
