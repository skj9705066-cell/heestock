// Higher-level market data using Yahoo Finance + Naver Finance

import { fetchYFQuotes, type YFQuote } from "./yahoo-finance";
import type { MarketIndex, SectorData, InvestorFlow } from "@/types/market";
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

// ── Investor Flow (Naver Finance) ─────────────────────────────────────────────

const NAVER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9",
  "Referer":         "https://finance.naver.com/",
};

function parseNaverFlow(html: string): InvestorFlow[] | null {
  try {
    // Extract date headers: 12.20 format
    const dateMatches = [...html.matchAll(/class="date">(\d{2}\.\d{2})/g)];
    const dates = dateMatches.map(m => m[1]).slice(0, 5);
    if (!dates.length) return null;

    // Extract net buy values for investor types
    // Naver returns EUC-KR decoded HTML; looks for rows with investor labels
    function extractNetBuy(label: string): number[] {
      const re = new RegExp(label + "[\\s\\S]*?</tr>", "g");
      const row = html.match(re)?.[0] ?? "";
      const numRe = />([\+\-]?[\d,]+)</g;
      const vals: number[] = [];
      let m: RegExpExecArray | null;
      while ((m = numRe.exec(row)) !== null) {
        const n = parseInt(m[1].replace(/,/g, ""), 10);
        if (!isNaN(n)) vals.push(n);
      }
      // Each date has sell/buy/net — take every 3rd starting at offset 2
      const nets: number[] = [];
      for (let i = 2; i < vals.length; i += 3) nets.push(vals[i]);
      return nets.slice(0, dates.length);
    }

    const foreign     = extractNetBuy("외국인");
    const institution = extractNetBuy("기관계");
    const individual  = extractNetBuy("개인");

    if (!foreign.length) return null;

    return dates.map((date, i) => ({
      date,
      foreign:     foreign[i]     ?? 0,
      institution: institution[i] ?? 0,
      individual:  individual[i]  ?? 0,
    })).reverse();
  } catch {
    return null;
  }
}

export async function getInvestorFlow(): Promise<InvestorFlow[]> {
  // Real net-buy data from Naver Finance HTML scraping.
  try {
    const res = await fetch(
      "https://finance.naver.com/sise/investorDealTrend.naver",
      { headers: NAVER_HEADERS, signal: AbortSignal.timeout(8_000), cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Naver HTTP ${res.status}`);
    const buffer = await res.arrayBuffer();
    const html   = new TextDecoder("euc-kr").decode(buffer);
    if (html.includes("error_content")) throw new Error("Naver error page");
    const parsed = parseNaverFlow(html);
    if (parsed && parsed.length >= 3) return parsed;
  } catch {
    // fall through
  }

  // No real data available — caller renders empty state.
  return [];
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
