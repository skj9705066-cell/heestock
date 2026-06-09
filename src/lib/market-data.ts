// Higher-level market data using KIS (Korean) + Yahoo Finance (US/International).

import { fetchKisIndexPrice } from "./kis";
import { getQuotes } from "./quote";
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

// 지수 캐시 (일시 빈 응답 대비)
const _indexCache = new Map<string, { data: MarketIndex; ts: number }>();
const INDEX_STALE_OK_TTL = 6 * 60 * 60_000; // 6시간

export async function getMarketIndices(): Promise<MarketIndex[]> {
  try {
    const result: MarketIndex[] = [];

    // 1. 한국 지수: KIS API (코스피, 코스닥)
    const [kospiRes, kosdaqRes] = await Promise.allSettled([
      fetchKisIndexPrice("0001"), // 코스피
      fetchKisIndexPrice("1001"), // 코스닥
    ]);

    if (kospiRes.status === "fulfilled" && kospiRes.value) {
      const k = kospiRes.value;
      const indexData: MarketIndex = {
        symbol: "^KS11",
        name: "코스피",
        value: Math.round(k.price * 100) / 100,
        change: Math.round(k.change * 100) / 100,
        changePercent: Math.round(k.changePercent * 100) / 100,
        market: "KR",
      };
      result.push(indexData);
      _indexCache.set("^KS11", { data: indexData, ts: Date.now() });
      console.log(`[market-data] 코스피 (KIS): ${k.price.toFixed(2)} / ${k.changePercent.toFixed(2)}%`);
    } else {
      // 일시 실패: stale cache 시도
      const cached = _indexCache.get("^KS11");
      if (cached && Date.now() - cached.ts < INDEX_STALE_OK_TTL) {
        const cacheAge = Math.round((Date.now() - cached.ts) / 60000);
        console.warn(`[market-data] 코스피 KIS 조회 실패 - using stale cache (${cacheAge}min)`);
        result.push(cached.data);
      } else {
        console.error("[market-data] 코스피 KIS 조회 실패 - no stale cache available");
      }
    }

    if (kosdaqRes.status === "fulfilled" && kosdaqRes.value) {
      const k = kosdaqRes.value;
      const indexData: MarketIndex = {
        symbol: "^KQ11",
        name: "코스닥",
        value: Math.round(k.price * 100) / 100,
        change: Math.round(k.change * 100) / 100,
        changePercent: Math.round(k.changePercent * 100) / 100,
        market: "KR",
      };
      result.push(indexData);
      _indexCache.set("^KQ11", { data: indexData, ts: Date.now() });
      console.log(`[market-data] 코스닥 (KIS): ${k.price.toFixed(2)} / ${k.changePercent.toFixed(2)}%`);
    } else {
      // 일시 실패: stale cache 시도
      const cached = _indexCache.get("^KQ11");
      if (cached && Date.now() - cached.ts < INDEX_STALE_OK_TTL) {
        const cacheAge = Math.round((Date.now() - cached.ts) / 60000);
        console.warn(`[market-data] 코스닥 KIS 조회 실패 - using stale cache (${cacheAge}min)`);
        result.push(cached.data);
      } else {
        console.error("[market-data] 코스닥 KIS 조회 실패 - no stale cache available");
      }
    }

    // 2. 미국 지수: Yahoo Finance (나스닥, S&P500)
    const usSymbols = ["^IXIC", "^GSPC"];
    const historyPromises = usSymbols.map(sym => fetchYFPriceHistory(sym, "5d"));
    const historyResults = await Promise.allSettled(historyPromises);

    usSymbols.forEach((sym, i) => {
      const histRes = historyResults[i];

      if (histRes.status === "rejected" || !histRes.value || histRes.value.length < 2) {
        console.warn(`[market-data] ${sym}: 히스토리 데이터 부족, 건너뜀`);
        return;
      }

      const history = histRes.value;
      // 최근 2일: [n-1] = 전일, [n] = 당일
      const todayPoint = history[history.length - 1];
      const yesterdayPoint = history[history.length - 2];

      const price = todayPoint.close;
      const prev = yesterdayPoint.close;

      if (!price || !prev || price <= 0 || prev <= 0) {
        console.warn(`[market-data] ${sym}: 잘못된 가격 데이터`);
        return;
      }

      const change = price - prev;
      const changePercent = (change / prev) * 100;

      console.log(`[market-data] ${sym} (${INDEX_SYMBOLS[sym].name}):`);
      console.log(`  - 당일 close: ${price.toFixed(2)}`);
      console.log(`  - 전일 close: ${prev.toFixed(2)}`);
      console.log(`  - change: ${change.toFixed(2)}`);
      console.log(`  - changePercent: ${changePercent.toFixed(2)}%`);

      result.push({
        symbol: sym,
        name: INDEX_SYMBOLS[sym].name,
        value: Math.round(price * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        market: INDEX_SYMBOLS[sym].market,
      });
    });

    return result.slice(0, 4);
  } catch (err) {
    console.error("[market-data] getMarketIndices error:", err);
    return [];
  }
}

// ── KR 종목 등락률 KIS 보정 ────────────────────────────────────────────────
// Yahoo는 KR 전일종가를 잘못 줄 때가 있어(반등/폭락 다음날 등) 등락률이 틀린다.
// 한국 종목 등락률·가격은 KIS(앱 전체의 정답 소스)로 덮어쓴다. TopStocks/Sectors가
// 공유하며 60초 캐시 → KIS 토큰 공유와 함께 호출 폭증을 막는다.
type KrQuoteMap = Map<string, { price: number; changePercent: number }>;
let _krQuoteCache: { map: KrQuoteMap; ts: number } | null = null;
let _krQuotePromise: Promise<KrQuoteMap> | null = null;
const KR_QUOTE_TTL = 60_000;

async function getKrQuoteMap(): Promise<KrQuoteMap> {
  if (_krQuoteCache && Date.now() - _krQuoteCache.ts < KR_QUOTE_TTL) return _krQuoteCache.map;
  // 동시 호출(TopStocks+Sectors)이 각자 안 부르도록 진행 중 Promise를 공유.
  if (_krQuotePromise) return _krQuotePromise;

  _krQuotePromise = (async () => {
    const symbols = Object.keys(KR_POOL).map(s => s.replace(/\.(KS|KQ)$/, ""));
    const map: KrQuoteMap = new Map();
    // 전 종목을 한꺼번에 병렬로 부르면 KIS 초당 제한에 일부가 드롭된다.
    // 배치(6)로 나눠 간격을 두고 호출해 누락 없이 받는다.
    const BATCH = 6;
    for (let i = 0; i < symbols.length; i += BATCH) {
      const chunk = symbols.slice(i, i + BATCH);
      const quotes = await getQuotes(chunk.map(symbol => ({ symbol, market: "KR" as const })));
      for (const [sym, q] of quotes) map.set(sym, { price: q.price, changePercent: q.changePercent });
      if (i + BATCH < symbols.length) await new Promise(r => setTimeout(r, 250));
    }
    // 대부분 받았을 때만 캐시(부분 실패한 빈약한 결과를 60초간 고정하지 않도록).
    if (map.size >= symbols.length * 0.7) _krQuoteCache = { map, ts: Date.now() };
    return map;
  })().finally(() => { _krQuotePromise = null; });

  return _krQuotePromise;
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

        // 등락률 검증 및 재계산
        let changePercent = q.regularMarketChangePercent ?? 0;
        const price = q.regularMarketPrice!;
        const prev = q.regularMarketPreviousClose;

        // 한국 주식 ±30% 제한 검증
        if (isKR && Math.abs(changePercent) > 30 && price > 0 && prev && prev > 0) {
          const recalcPct = ((price - prev) / prev) * 100;
          console.warn(
            `[market-data] ${q.symbol}: changePercent=${changePercent.toFixed(2)}% suspicious, ` +
            `recalc → ${recalcPct.toFixed(2)}%`
          );
          changePercent = recalcPct;
        }

        return {
          rank:          i + 1,
          symbol:        rawSym,
          name,
          price,
          changePercent,
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

    // 한국 종목 등락률·가격은 KIS 값으로 보정 (Yahoo 전일종가 오류 방지)
    const krMap = await getKrQuoteMap();
    const fixed = stocks.map(s => {
      if (s.market !== "KR") return s;
      const k = krMap.get(s.symbol);
      return k ? { ...s, price: k.price, changePercent: k.changePercent } : s;
    });

    return fixed;
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
    const [quotes, krMap] = await Promise.all([fetchYFQuotes(symbols), getKrQuoteMap()]);

    // Group by sector, calculate avg changePercent and total volume
    // 등락률은 KIS 보정값 우선 사용(없으면 Yahoo 폴백). 거래량/시총은 Yahoo.
    const sectorMap = new Map<string, { changes: number[]; volume: number; cap: number }>();
    for (const q of quotes) {
      if (!q.regularMarketPrice || !q.symbol) continue;
      const meta = KR_POOL[q.symbol];
      if (!meta) continue;
      const bucket = sectorMap.get(meta.sector) ?? { changes: [], volume: 0, cap: 0 };
      const kisPct = krMap.get(q.symbol.replace(/\.(KS|KQ)$/, ""))?.changePercent;
      const chPct  = kisPct ?? q.regularMarketChangePercent;
      if (chPct !== undefined) bucket.changes.push(chPct);
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
