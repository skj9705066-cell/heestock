// Higher-level market data using Yahoo Finance only.

import { fetchYFQuotes, fetchYFPriceHistory, type YFQuote } from "./yahoo-finance";
import type { MarketIndex, SectorData, MarketVolumePoint } from "@/types/market";
import type { TopStock } from "@/types/stock";

// ── Symbol pools ──────────────────────────────────────────────────────────────

const INDEX_SYMBOLS: Record<string, { name: string; market: "KR" | "US" }> = {
  "^KS11": { name: "코스피",  market: "KR" },
  "^KQ11": { name: "코스닥",  market: "KR" },
  "^IXIC": { name: "나스닥",  market: "US" },
  "^GSPC": { name: "S&P500",  market: "US" },
};

// Major KR stocks for top-stocks + sector data
const KR_POOL: Record<string, { name: string; sector: string }> = {
  "005930.KS": { name: "삼성전자",         sector: "반도체"      },
  "000660.KS": { name: "SK하이닉스",        sector: "반도체"      },
  "042700.KS": { name: "한미반도체",        sector: "반도체"      },
  "000990.KS": { name: "DB하이텍",          sector: "반도체"      },
  "373220.KS": { name: "LG에너지솔루션",    sector: "이차전지"    },
  "006400.KS": { name: "삼성SDI",           sector: "이차전지"    },
  "247540.KQ": { name: "에코프로비엠",      sector: "이차전지"    },
  "096770.KS": { name: "SK이노베이션",      sector: "이차전지"    },
  "005380.KS": { name: "현대차",            sector: "자동차"      },
  "000270.KS": { name: "기아",              sector: "자동차"      },
  "012330.KS": { name: "현대모비스",        sector: "자동차"      },
  "035420.KS": { name: "NAVER",             sector: "인터넷/IT"   },
  "035720.KS": { name: "카카오",            sector: "인터넷/IT"   },
  "259960.KS": { name: "크래프톤",          sector: "게임"        },
  "036570.KQ": { name: "NCsoft",            sector: "게임"        },
  "263750.KQ": { name: "펄어비스",          sector: "게임"        },
  "041510.KQ": { name: "에스엠",            sector: "엔터"        },
  "035900.KQ": { name: "JYP엔터",           sector: "엔터"        },
  "068270.KS": { name: "셀트리온",          sector: "바이오"      },
  "207940.KS": { name: "삼성바이오로직스",  sector: "바이오"      },
  "326030.KS": { name: "SK바이오팜",        sector: "바이오"      },
  "105560.KS": { name: "KB금융",            sector: "금융"        },
  "055550.KS": { name: "신한지주",          sector: "금융"        },
  "086790.KS": { name: "하나금융지주",      sector: "금융"        },
  "051910.KS": { name: "LG화학",            sector: "화학/소재"   },
  "011170.KS": { name: "롯데케미칼",        sector: "화학/소재"   },
  "009830.KS": { name: "한화솔루션",        sector: "화학/소재"   },
  "000720.KS": { name: "현대건설",          sector: "건설"        },
  "028260.KS": { name: "삼성물산",          sector: "건설"        },
  "005490.KS": { name: "POSCO홀딩스",       sector: "철강"        },
  "004020.KS": { name: "현대제철",          sector: "철강"        },
};

const US_POOL: Record<string, string> = {
  "NVDA":  "엔비디아",
  "AAPL":  "애플",
  "MSFT":  "마이크로소프트",
  "META":  "메타",
  "TSLA":  "테슬라",
  "AMZN":  "아마존",
  "GOOGL": "알파벳",
  "AMD":   "AMD",
};

// ── Market Indices ────────────────────────────────────────────────────────────

export async function getMarketIndices(): Promise<MarketIndex[]> {
  try {
    const symbols = Object.keys(INDEX_SYMBOLS);
    const quotes  = await fetchYFQuotes(symbols);

    const result: MarketIndex[] = [];
    // Keep order: KOSPI, KOSDAQ, NASDAQ, S&P500
    for (const sym of symbols) {
      const q = quotes.find(r => r.symbol === sym);
      if (!q?.regularMarketPrice) continue;
      result.push({
        symbol:        sym,
        name:          INDEX_SYMBOLS[sym].name,
        value:         q.regularMarketPrice,
        change:        q.regularMarketChange ?? 0,
        changePercent: q.regularMarketChangePercent ?? 0,
        market:        INDEX_SYMBOLS[sym].market,
      });
    }

    return result.slice(0, 4);
  } catch {
    return [];
  }
}

// ── Top Stocks ────────────────────────────────────────────────────────────────

export async function getTopStocks(): Promise<TopStock[]> {
  try {
    const krSymbols = Object.keys(KR_POOL);
    const usSymbols = Object.keys(US_POOL);
    const quotes    = await fetchYFQuotes([...krSymbols, ...usSymbols]);

    const stocks: TopStock[] = quotes
      .filter(q => q.regularMarketPrice && q.regularMarketVolume)
      .map((q, i) => {
        const isKR  = q.symbol.endsWith(".KS") || q.symbol.endsWith(".KQ");
        const rawSym = q.symbol.replace(/\.(KS|KQ)$/, "");
        const meta   = isKR ? KR_POOL[q.symbol] : null;
        const name   = meta?.name ?? q.shortName ?? q.symbol;
        return {
          rank:          i + 1,
          symbol:        rawSym,
          name,
          price:         q.regularMarketPrice!,
          changePercent: q.regularMarketChangePercent ?? 0,
          volume:        q.regularMarketVolume!,
          market:        isKR ? ("KR" as const) : ("US" as const),
        };
      })
      // Sort by volume DESC, but favor KR stocks in ranking
      .sort((a, b) => {
        const volA = a.market === "KR" ? a.volume : a.volume / 1000;
        const volB = b.market === "KR" ? b.volume : b.volume / 1000;
        return volB - volA;
      })
      .slice(0, 10)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    return stocks;
  } catch {
    return [];
  }
}

// ── Sector Heatmap ────────────────────────────────────────────────────────────

const SECTOR_ORDER = [
  "반도체", "이차전지", "자동차", "인터넷/IT", "금융",
  "바이오", "화학/소재", "게임", "엔터", "건설", "철강",
];

export async function getSectors(): Promise<SectorData[]> {
  try {
    const symbols = Object.keys(KR_POOL);
    const quotes  = await fetchYFQuotes(symbols);

    // Group by sector, calculate avg changePercent and total volume
    const sectorMap = new Map<string, { changes: number[]; volume: number; cap: number }>();
    for (const q of quotes) {
      if (!q.regularMarketPrice || !q.symbol) continue;
      const meta = KR_POOL[q.symbol];
      if (!meta) continue;
      const bucket = sectorMap.get(meta.sector) ?? { changes: [], volume: 0, cap: 0 };
      if (q.regularMarketChangePercent !== undefined) bucket.changes.push(q.regularMarketChangePercent);
      bucket.volume += q.regularMarketVolume ?? 0;
      bucket.cap    += q.marketCap ?? 0;
      sectorMap.set(meta.sector, bucket);
    }

    const sectors: SectorData[] = [];
    for (const name of SECTOR_ORDER) {
      const b = sectorMap.get(name);
      if (!b || !b.changes.length) continue;
      sectors.push({
        name,
        changePercent: parseFloat(
          (b.changes.reduce((a, c) => a + c, 0) / b.changes.length).toFixed(2),
        ),
        volume:    b.volume,
        marketCap: b.cap,
      });
    }

    return sectors;
  } catch {
    return [];
  }
}

// ── KOSPI 거래대금 추이 (Yahoo-based, no Naver scrape) ───────────────────────
// Aggregates daily 거래대금 = close × volume across the KR_POOL constituents.
// More stable than scraping Naver's investor-flow page (which was returning
// EUC-KR HTML that frequently failed to parse).

export async function getMarketVolumeTrend(): Promise<MarketVolumePoint[]> {
  try {
    const symbols  = Object.keys(KR_POOL);
    const histories = await Promise.allSettled(
      symbols.map(s => fetchYFPriceHistory(s, "5d")),
    );

    // ts → 거래대금 in raw KRW
    const dayMap = new Map<number, number>();
    for (const r of histories) {
      if (r.status !== "fulfilled") continue;
      for (const pt of r.value) {
        if (!pt.close || !pt.volume) continue;
        dayMap.set(pt.ts, (dayMap.get(pt.ts) ?? 0) + pt.close * pt.volume);
      }
    }

    const points: MarketVolumePoint[] = [...dayMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .slice(-5)
      .map(([ts, krw]) => {
        const d  = new Date(ts * 1000);
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return {
          date:  `${mm}.${dd}`,
          value: Math.round(krw / 100_000_000), // 억원
        };
      });

    return points;
  } catch {
    return [];
  }
}

// ── Commodities & Bonds ───────────────────────────────────────────────────────

export interface CommodityItem {
  price:         number;
  changePercent: number;
}

export interface CommodityData {
  wti:   CommodityItem | null;
  brent: CommodityItem | null;
  tnx:   CommodityItem | null;
}

export async function getCommoditiesAndBonds(): Promise<CommodityData> {
  try {
    const quotes = await fetchYFQuotes(["CL=F", "BZ=F", "^TNX"]);
    const find = (sym: string) => quotes.find(q => q.symbol === sym);
    const toItem = (q: YFQuote | undefined): CommodityItem | null =>
      q?.regularMarketPrice
        ? { price: q.regularMarketPrice, changePercent: q.regularMarketChangePercent ?? 0 }
        : null;
    return {
      wti:   toItem(find("CL=F")),
      brent: toItem(find("BZ=F")),
      tnx:   toItem(find("^TNX")),
    };
  } catch {
    return { wti: null, brent: null, tnx: null };
  }
}

// ── YF symbol helper ──────────────────────────────────────────────────────────

// Guess Yahoo Finance symbol from a bare Korean stock code
export function toYFSymbol(code: string, preferKS = true): string {
  if (code.includes(".")) return code; // already has suffix
  const num = parseInt(code, 10);
  // 6-digit numeric codes: KOSDAQ companies often start with 0
  // Use .KS for KOSPI (generally 6-digit, specific ranges)
  // Use .KQ for KOSDAQ
  // Heuristic: codes < 030000 and > 300000 tend to be KOSPI; but this is imprecise
  // Better: default to KS unless caller passes preferKS=false
  return `${code}.${preferKS ? "KS" : "KQ"}`;
}

// Try both .KS and .KQ to see which returns data
export async function resolveKrSymbol(code: string): Promise<string> {
  const [ks, kq] = await Promise.allSettled([
    fetchYFQuotes([`${code}.KS`]),
    fetchYFQuotes([`${code}.KQ`]),
  ]);
  if (ks.status === "fulfilled" && ks.value[0]?.regularMarketPrice) return `${code}.KS`;
  if (kq.status === "fulfilled" && kq.value[0]?.regularMarketPrice) return `${code}.KQ`;
  return `${code}.KS`; // default
}
