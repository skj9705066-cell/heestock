// Aggregates real-time stock data for the AI analysis page.
// Used by both /api/stock-snapshot (UI display) and /api/ai-chat (prompt injection).

import {
  fetchYFKeyStats,
  fetchYFPriceHistory,
  fetchYFFinancials,
  resolveKrYahooSymbol,
  type YFQuote,
  type YFKeyStats,
  type PricePoint,
  type YFIncomeRow,
} from "@/lib/yahoo-finance";
import { fetchDartKrFinancials } from "@/lib/dart";
import { fetchKisInvestorFlow, type KisInvestorDay } from "@/lib/kis";
import { getQuote, type Quote } from "@/lib/quote";

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

// Per-stock investor flow (수급) — 외국인/기관/개인 net buy in 억원, sourced
// from KIS Open API's inquire-investor endpoint. KR stocks only.
export interface SnapshotInvestorDay {
  date:        string; // YYYY-MM-DD
  foreign:     number; // 억원 (positive = net buy)
  institution: number;
  individual:  number;
}

export interface SnapshotInvestorFlow {
  source: "KIS";
  days:   SnapshotInvestorDay[];
  // Cumulative net buy across the window — handy summary for the AI prompt.
  totals: { foreign: number; institution: number; individual: number };
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
  investorFlow?: SnapshotInvestorFlow;
  errors: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function detectMarket(symbol: string, hint?: Market): Market {
  if (hint) return hint;
  if (/\.(KS|KQ)$/.test(symbol)) return "KR";
  if (/^\d{6}$/.test(symbol)) return "KR";
  return "US";
}

async function yfSymbol(symbol: string, market: Market): Promise<string> {
  if (market === "KR" && /^\d{6}$/.test(symbol)) return resolveKrYahooSymbol(symbol);
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
  let changePercent = q.regularMarketChangePercent ?? (prev ? (change / prev) * 100 : 0);

  // 한국 주식 ±30% 제한 검증 + 부호 일치 검증
  if (market === "KR" && price > 0 && prev > 0) {
    const recalcPct = ((price - prev) / prev) * 100;

    // 30% 초과 또는 change/changePercent 부호 불일치 시 재계산
    const signMismatch = (change > 0 && changePercent < -0.01) || (change < 0 && changePercent > 0.01);

    if (Math.abs(changePercent) > 30 || signMismatch) {
      console.warn(
        `[yahoo] ${q.symbol}: ` +
        (Math.abs(changePercent) > 30
          ? `changePercent=${changePercent.toFixed(2)}% exceeds ±30% limit`
          : `sign mismatch (change=${change.toFixed(2)}, changePct=${changePercent.toFixed(2)}%)`) +
        `, recalc → ${recalcPct.toFixed(2)}%`
      );
      changePercent = recalcPct;
    }
  }

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

// ── Investor flow builder ───────────────────────────────────────────────────

function buildInvestorFlow(days: KisInvestorDay[]): SnapshotInvestorFlow | undefined {
  if (!days.length) return undefined;
  const cleaned: SnapshotInvestorDay[] = days.map(d => ({
    date:        d.date,
    foreign:     d.foreign,
    institution: d.institution,
    individual:  d.individual,
  }));
  const totals = cleaned.reduce(
    (acc, d) => ({
      foreign:     acc.foreign     + d.foreign,
      institution: acc.institution + d.institution,
      individual:  acc.individual  + d.individual,
    }),
    { foreign: 0, institution: 0, individual: 0 },
  );
  return { source: "KIS", days: cleaned, totals };
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
// 장중 신선도를 위해 짧게(30초). TTL 내 동일 종목 요청은 KIS를 다시 부르지 않고
// 캐시값을 반환 → 여러 사용자가 동시 접속해도 KIS 호출이 종목당 30초에 1회로 수렴.
const SNAPSHOT_TTL = 30_000;
const STALE_OK_TTL = 6 * 60 * 60_000; // 6시간 (일시 빈 응답 시 오래된 캐시 허용)

// 진행 중 조회를 종목별로 공유해 캐시 스탬피드를 막는다(같은 종목 동시요청 → KIS 1회).
const _inflight = new Map<string, Promise<StockSnapshot>>();

export async function buildStockSnapshot(
  symbol: string,
  name: string,
  marketHint?: Market,
): Promise<StockSnapshot> {
  const market = detectMarket(symbol, marketHint);
  const cacheKey = `${symbol}|${market}`;

  // 1) 신선한 캐시(TTL 내)면 즉시 반환 — KIS 재호출 없음.
  const hit = _snapshotCache.get(cacheKey);
  if (hit && Date.now() - hit.ts < SNAPSHOT_TTL) return hit.data;

  // 2) 같은 종목이 이미 조회 중이면 그 Promise를 공유(스탬피드 방지).
  const pending = _inflight.get(cacheKey);
  if (pending) return pending;

  // 3) 신규 조회 시작 — 진행 중 Promise를 등록하고 끝나면 정리.
  const job = buildSnapshotUncached(symbol, name, market, cacheKey, hit);
  _inflight.set(cacheKey, job);
  try {
    return await job;
  } finally {
    _inflight.delete(cacheKey);
  }
}

async function buildSnapshotUncached(
  symbol: string,
  name: string,
  market: Market,
  cacheKey: string,
  hit: { data: StockSnapshot; ts: number } | undefined,
): Promise<StockSnapshot> {

  const now = new Date();
  const asOfDate = now.toISOString().slice(0, 10);
  const asOfDateKr = fmtDateKr(now);
  const errors: string[] = [];

  // 종목코드 정규화: .KS/.KQ 제거, 한국 종목은 6자리로 패딩
  let stockCode = String(symbol).replace(/\.(KS|KQ)$/, "");
  const isKr = market === "KR";

  // 한국 종목: 숫자로 변환되었거나 앞자리 0이 떨어진 경우 복구
  if (isKr && /^\d+$/.test(stockCode)) {
    const padded = stockCode.padStart(6, "0");
    if (padded !== stockCode) {
      console.warn(`[stock-snapshot] ${stockCode} → ${padded} (6자리 패딩)`);
      stockCode = padded;
    }
  }

  // ── 1. Quote: 단일 getQuote() 함수 사용 (KeyStats 포함) ───────────────────
  const quotePromise = getQuote(stockCode, market);

  // ── 2. 기타 데이터: 병렬 조회 ──────────────────────────────────────────────
  const kisFlowPromise = isKr ? fetchKisInvestorFlow(stockCode, 5) : Promise.resolve([]);

  const [quoteRes, ksRes, histRes, finRes, flowRes] = await Promise.allSettled([
    quotePromise,
    fetchYFKeyStats(stockCode),
    fetchYFPriceHistory(stockCode, "1y"),
    isKr ? buildKrFinancials(stockCode) : buildUsFinancials(stockCode),
    kisFlowPromise,
  ]);

  // Quote 결과
  console.log(`[stock-snapshot] ${stockCode}: quoteRes.status=${quoteRes.status}`);
  if (quoteRes.status === "rejected") {
    console.error(`[stock-snapshot] ${stockCode}: quoteRes REJECTED:`, quoteRes.reason);
  }

  const quoteData = quoteRes.status === "fulfilled" ? quoteRes.value : null;
  console.log(`[stock-snapshot] ${stockCode}: quoteData=${quoteData ? 'EXISTS' : 'NULL'}, price=${quoteData?.price ?? 'N/A'}`);

  let quote: SnapshotQuote | undefined;

  if (quoteData) {
    quote = {
      price: quoteData.price,
      change: quoteData.change,
      changePercent: quoteData.changePercent,
      volume: quoteData.volume,
      dayHigh: quoteData.dayHigh,
      dayLow: quoteData.dayLow,
      previousClose: quoteData.previousClose,
      fiftyTwoWeekHigh: quoteData.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: quoteData.fiftyTwoWeekLow,
      pricePosition52w: quoteData.fiftyTwoWeekHigh && quoteData.fiftyTwoWeekLow
        ? pct(((quoteData.price - quoteData.fiftyTwoWeekLow) / (quoteData.fiftyTwoWeekHigh - quoteData.fiftyTwoWeekLow)) * 100)
        : undefined,
      marketCap: quoteData.marketCap,
      currency: quoteData.currency,
    };
    console.log(`[stock-snapshot] ${stockCode}: ✓ quote 생성 성공 - ${quoteData.source} - price=${quote.price}, change=${quote.changePercent.toFixed(2)}%`);
  } else {
    // 시세 조회 실패: 일시적 빈 응답일 수 있음
    console.error(`[stock-snapshot] ${stockCode}: ✗ getQuote() failed - checking stale cache`);

    // 한국 종목이고 6시간 이내 stale cache가 있으면 유지
    if (isKr && hit && Date.now() - hit.ts < STALE_OK_TTL && hit.data.quote) {
      const cacheAge = Math.round((Date.now() - hit.ts) / 60000);
      console.log(`[stock-snapshot] ${stockCode}: Using stale quote (age: ${cacheAge}min)`);
      quote = hit.data.quote;
      errors.push(`시세 조회 일시 실패 (${cacheAge}분 전 데이터)`);
    } else {
      errors.push("실시간 시세 조회 실패");
    }
  }

  // Key stats: getQuote() 결과에서 추출 (한국), Yahoo fallback (미국)
  const yfStats = ksRes.status === "fulfilled" ? ksRes.value : null;
  let keyStats: SnapshotKeyStats | undefined;

  if (isKr && quoteData && (quoteData.per || quoteData.pbr)) {
    // KIS Quote에 KeyStats 포함됨 (중복 조회 제거)
    const roe = (quoteData.eps !== undefined && quoteData.bps !== undefined && quoteData.bps > 0)
      ? pct((quoteData.eps / quoteData.bps) * 100)
      : undefined;
    keyStats = {
      trailingPE: quoteData.per,
      priceToBook: quoteData.pbr,
      returnOnEquity: roe,
      trailingEps: quoteData.eps,
    };
  } else if (yfStats) {
    keyStats = buildKeyStats(yfStats);
  }

  if (!keyStats) errors.push("재무비율(PER/PBR/ROE) 조회 실패");

  const priceHistory = histRes.status === "fulfilled" ? buildPriceHistory(histRes.value) : undefined;
  if (!priceHistory) errors.push("1년 주가 추이 조회 실패");

  const financials = finRes.status === "fulfilled" ? finRes.value : undefined;
  if (!financials) {
    errors.push(isKr ? "DART 재무제표 조회 실패" : "Yahoo 재무제표 조회 실패");
  }

  // Investor flow (KR only)
  const kisFlow = flowRes.status === "fulfilled" ? flowRes.value : [];
  const investorFlow = isKr ? buildInvestorFlow(kisFlow) : undefined;
  if (isKr && !investorFlow) errors.push("수급(외/기/개) 조회 실패");

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
    investorFlow,
    errors,
  };

  // 캐시 업데이트: quote가 있으면 (신규 또는 stale) 항상 캐시
  if (quote) {
    _snapshotCache.set(cacheKey, { data: snapshot, ts: Date.now() });
  }
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

  // ── 수급 (Investor flow, KIS) ─────────────────────────────────────────────
  if (snap.investorFlow && snap.investorFlow.days.length) {
    const inv = snap.investorFlow;
    const flowSign = (n: number) => `${n >= 0 ? "+" : ""}${n.toLocaleString("ko-KR")}억원`;
    lines.push(`## 수급 (출처: ${inv.source}, 단위: 억원)`);
    lines.push(`### 최근 ${inv.days.length}거래일 순매수 합계`);
    lines.push(`- 외국인: ${flowSign(inv.totals.foreign)}`);
    lines.push(`- 기관:   ${flowSign(inv.totals.institution)}`);
    lines.push(`- 개인:   ${flowSign(inv.totals.individual)}`);
    lines.push("### 일별 순매수");
    for (const d of inv.days) {
      lines.push(`- ${d.date}: 외 ${flowSign(d.foreign)} / 기 ${flowSign(d.institution)} / 개 ${flowSign(d.individual)}`);
    }
    lines.push("");
  }

  if (snap.errors.length) {
    lines.push(`> 일부 데이터 조회 실패: ${snap.errors.join(", ")}`);
  }

  return lines.join("\n");
}
