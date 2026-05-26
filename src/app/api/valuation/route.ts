import { NextRequest } from "next/server";
import { fetchYFQuotes, fetchYFKeyStats } from "@/lib/yahoo-finance";
import type { ValuationData, PeerStock } from "@/types/stock";

export const runtime = "nodejs";

// Default symbols shown on load
const DEFAULT_SYMBOLS = ["005930.KS", "000660.KS", "NVDA", "035720.KS", "005380.KS", "MSFT"];

// Peer group definitions
const PEERS: Record<string, string[]> = {
  "005930.KS": ["000660.KS", "NVDA", "MU"],
  "000660.KS": ["005930.KS", "MU", "WDC"],
  "NVDA":      ["AMD", "AVGO", "INTC"],
  "035720.KS": ["035420.KS", "META"],
  "035420.KS": ["035720.KS", "GOOGL"],
  "005380.KS": ["000270.KS", "TSLA"],
  "000270.KS": ["005380.KS", "TSLA"],
  "MSFT":      ["AAPL", "GOOGL"],
  "AAPL":      ["MSFT", "GOOGL"],
  "META":      ["GOOGL", "SNAP"],
  "TSLA":      ["005380.KS", "NIO"],
};

const NAME_MAP: Record<string, string> = {
  "005930.KS":"삼성전자","000660.KS":"SK하이닉스","035720.KS":"카카오","035420.KS":"NAVER",
  "005380.KS":"현대차","000270.KS":"기아","207940.KS":"삼성바이오로직스",
  "NVDA":"엔비디아","AAPL":"애플","MSFT":"마이크로소프트","META":"메타",
  "TSLA":"테슬라","AMZN":"아마존","GOOGL":"알파벳","AMD":"AMD","AVGO":"브로드컴",
  "MU":"마이크론","WDC":"웨스턴디지털","INTC":"인텔","SNAP":"스냅","NIO":"니오",
};

const SECTOR_MAP: Record<string, string> = {
  "005930.KS":"반도체","000660.KS":"반도체","NVDA":"반도체/AI","AMD":"반도체","AVGO":"반도체","MU":"반도체",
  "035720.KS":"IT서비스","035420.KS":"IT서비스","META":"소셜미디어","GOOGL":"인터넷",
  "005380.KS":"자동차","000270.KS":"자동차","TSLA":"전기차","NIO":"전기차",
  "207940.KS":"바이오","MSFT":"소프트웨어","AAPL":"하드웨어","AMZN":"클라우드",
  "WDC":"스토리지","INTC":"반도체","SNAP":"소셜미디어",
};

const _cache = new Map<string, { data: unknown; ts: number }>();

async function buildValuation(symbol: string): Promise<ValuationData | null> {
  const [quotes, stats] = await Promise.allSettled([
    fetchYFQuotes([symbol]),
    fetchYFKeyStats(symbol),
  ]);

  const quote = quotes.status === "fulfilled" ? quotes.value[0] : null;
  if (!quote?.regularMarketPrice) return null;

  const ks = stats.status === "fulfilled" ? stats.value : null;

  // Fetch peer data
  const peerSymbols = PEERS[symbol] ?? [];
  const peerData: PeerStock[] = [];
  if (peerSymbols.length) {
    const [peerQuotes, ...peerStats] = await Promise.allSettled([
      fetchYFQuotes(peerSymbols),
      ...peerSymbols.map(ps => fetchYFKeyStats(ps)),
    ]);
    const pQuotes = peerQuotes.status === "fulfilled" ? peerQuotes.value : [];
    for (let i = 0; i < peerSymbols.length; i++) {
      const ps      = peerSymbols[i];
      const pq      = pQuotes.find(q => q.symbol === ps);
      const pks     = peerStats[i]?.status === "fulfilled" ? (peerStats[i] as PromiseFulfilledResult<typeof ks>).value : null;
      const rawSym  = ps.replace(/\.(KS|KQ)$/, "");
      peerData.push({
        symbol:    rawSym,
        name:      NAME_MAP[ps] ?? pq?.shortName ?? rawSym,
        per:       pks?.trailingPE,
        pbr:       pks?.priceToBook,
        roe:       pks?.returnOnEquity !== undefined ? pks.returnOnEquity * 100 : undefined,
        marketCap: pks?.marketCap
          ? (ps.endsWith(".KS") || ps.endsWith(".KQ"))
            ? Math.round(pks.marketCap / 1e8)   // KRW → 억원
            : Math.round(pks.marketCap / 1e6)   // USD → 백만달러
          : 0,
      });
    }
  }

  const isKR    = symbol.endsWith(".KS") || symbol.endsWith(".KQ");
  const rawSym  = symbol.replace(/\.(KS|KQ)$/, "");
  const mcap    = ks?.marketCap;

  // Forward PE estimation: use forward PE from YF; estimate yr2/yr3 from growth trend
  const trailingPE = ks?.trailingPE;
  const forwardPE  = ks?.forwardPE;
  let year2: number | undefined;
  let year3: number | undefined;
  if (forwardPE && trailingPE) {
    const growthFactor = trailingPE / forwardPE; // implied EPS growth
    year2 = parseFloat((forwardPE / growthFactor).toFixed(1));
    year3 = parseFloat((year2     / growthFactor).toFixed(1));
  }

  return {
    symbol:    rawSym,
    name:      NAME_MAP[symbol] ?? quote.shortName ?? rawSym,
    sector:    SECTOR_MAP[symbol] ?? "",
    market:    isKR ? "KR" : "US",
    price:     quote.regularMarketPrice,
    per:       ks?.trailingPE,
    pbr:       ks?.priceToBook,
    roe:       ks?.returnOnEquity !== undefined ? parseFloat((ks.returnOnEquity * 100).toFixed(1)) : undefined,
    psr:       ks?.priceToSalesTrailing12Months,
    evEbitda:  ks?.enterpriseToEbitda,
    marketCap: mcap ? (isKR ? Math.round(mcap / 1e8) : Math.round(mcap / 1e6)) : undefined,
    forwardPer: {
      year1:       forwardPE,
      year2,
      year3,
      isAIEstimate: !forwardPE,
    },
    peers: peerData,
  } as ValuationData & { market: "KR" | "US"; price: number; marketCap?: number };
}

export async function GET(req: NextRequest) {
  const symbolParam = req.nextUrl.searchParams.get("symbols");
  const symbols = symbolParam
    ? symbolParam.split(",").map(s => s.trim()).filter(Boolean)
    : DEFAULT_SYMBOLS;

  // Add .KS suffix for 6-digit Korean codes
  const resolved = symbols.map(s => {
    if (/^\d{6}$/.test(s)) return `${s}.KS`;
    return s;
  });

  const cacheKey = resolved.sort().join(",");
  const cached   = _cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 60 * 60_000) {
    return Response.json(cached.data);
  }

  const settled = await Promise.allSettled(resolved.map(s => buildValuation(s)));
  const data    = settled
    .filter((r): r is PromiseFulfilledResult<ValuationData | null> => r.status === "fulfilled")
    .map(r => r.value)
    .filter((v): v is ValuationData => v !== null);

  _cache.set(cacheKey, { data, ts: Date.now() });
  return Response.json(data);
}
