import { NextRequest } from "next/server";
import { searchYFSymbols } from "@/lib/yahoo-finance";
import { searchDartCorps } from "@/lib/dart";

export const runtime = "nodejs";

// Curated sector labels for major Korean tickers — used to enrich both
// YF/Dart search results with Korean sector text (YF returns English industries).
const KR_SECTOR_INDEX: ReadonlyArray<{ symbol: string; name: string; sector: string }> = [
  { symbol: "005930", name: "삼성전자",         sector: "반도체"      },
  { symbol: "000660", name: "SK하이닉스",       sector: "반도체"      },
  { symbol: "042700", name: "한미반도체",       sector: "반도체장비"   },
  { symbol: "000990", name: "DB하이텍",          sector: "반도체"      },
  { symbol: "035420", name: "NAVER",              sector: "IT서비스"    },
  { symbol: "035720", name: "카카오",            sector: "IT서비스"    },
  { symbol: "207940", name: "삼성바이오로직스", sector: "바이오"      },
  { symbol: "068270", name: "셀트리온",          sector: "바이오"      },
  { symbol: "373220", name: "LG에너지솔루션",  sector: "이차전지"    },
  { symbol: "006400", name: "삼성SDI",           sector: "이차전지"    },
  { symbol: "247540", name: "에코프로비엠",     sector: "이차전지"    },
  { symbol: "051910", name: "LG화학",             sector: "화학"        },
  { symbol: "005380", name: "현대차",            sector: "자동차"      },
  { symbol: "000270", name: "기아",                sector: "자동차"      },
  { symbol: "012330", name: "현대모비스",        sector: "자동차부품"   },
  { symbol: "259960", name: "크래프톤",          sector: "게임"        },
  { symbol: "036570", name: "NCsoft",             sector: "게임"        },
  { symbol: "263750", name: "펄어비스",          sector: "게임"        },
  { symbol: "041510", name: "에스엠",            sector: "엔터"        },
  { symbol: "035900", name: "JYP엔터",           sector: "엔터"        },
  { symbol: "105560", name: "KB금융",             sector: "금융"        },
  { symbol: "055550", name: "신한지주",          sector: "금융"        },
  { symbol: "086790", name: "하나금융지주",    sector: "금융"        },
  { symbol: "005490", name: "POSCO홀딩스",     sector: "철강"        },
  { symbol: "004020", name: "현대제철",          sector: "철강"        },
  { symbol: "028260", name: "삼성물산",          sector: "건설"        },
  { symbol: "326030", name: "SK바이오팜",       sector: "바이오"      },
  { symbol: "096770", name: "SK이노베이션",    sector: "에너지"      },
  { symbol: "000720", name: "현대건설",          sector: "건설"        },
  { symbol: "011170", name: "롯데케미칼",        sector: "화학"        },
  { symbol: "009830", name: "한화솔루션",        sector: "화학"        },
];

const SECTOR_BY_SYMBOL = new Map<string, string>(
  KR_SECTOR_INDEX.map(s => [s.symbol, s.sector]),
);

const HANGUL_RE = /[ㄱ-힝]/;

interface SearchResult {
  symbol: string;
  name:   string;
  market: "KR" | "US";
  sector: string;
}

export async function GET(req: NextRequest) {
  const query  = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const market = req.nextUrl.searchParams.get("market");
  const filterMarket = market === "KR" || market === "US" ? market : null;

  if (!query) return Response.json([]);

  const isHangul = HANGUL_RE.test(query);
  const isKrCode = /^\d{1,6}$/.test(query);

  // Run YF + DART searches in parallel. DART is the authoritative source for
  // Korean smallcaps (KOSDAQ etc.) since YF search doesn't index Hangul well.
  const wantsYahoo = filterMarket !== "KR" || (!isHangul && !isKrCode);
  const wantsDart  = filterMarket !== "US" && (isHangul || isKrCode);

  const [yfRaw, dartHits] = await Promise.allSettled([
    wantsYahoo ? searchYFSymbols(query) : Promise.resolve([]),
    wantsDart  ? searchDartCorps(query, 15) : Promise.resolve([]),
  ]);

  const results: SearchResult[] = [];
  const seenSymbols = new Set<string>();

  // 1. DART hits first (most relevant for Korean queries)
  if (dartHits.status === "fulfilled") {
    for (const hit of dartHits.value) {
      if (filterMarket === "US") break;
      if (seenSymbols.has(hit.stockCode)) continue;
      seenSymbols.add(hit.stockCode);
      results.push({
        symbol: hit.stockCode,
        name:   hit.corpName,
        market: "KR",
        sector: SECTOR_BY_SYMBOL.get(hit.stockCode) ?? "",
      });
    }
  }

  // 2. Yahoo Finance hits (US stocks + Korean tickers YF can index)
  if (yfRaw.status === "fulfilled") {
    for (const r of yfRaw.value) {
      if (r.market === "OTHER") continue;
      if (filterMarket && r.market !== filterMarket) continue;
      const bareSymbol = r.symbol.replace(/\.(KS|KQ)$/, "");
      if (seenSymbols.has(bareSymbol)) continue;
      seenSymbols.add(bareSymbol);
      results.push({
        symbol: bareSymbol,
        name:   r.name,
        market: r.market as "KR" | "US",
        sector: r.market === "KR" ? (SECTOR_BY_SYMBOL.get(bareSymbol) ?? "") : "",
      });
    }
  }

  // 3. Curated KR sector index as final safety net for partial-name typing
  if (filterMarket !== "US") {
    const lq = query.toLowerCase();
    for (const s of KR_SECTOR_INDEX) {
      if (seenSymbols.has(s.symbol)) continue;
      if (s.symbol.includes(query) || s.name.toLowerCase().includes(lq)) {
        seenSymbols.add(s.symbol);
        results.push({ symbol: s.symbol, name: s.name, market: "KR", sector: s.sector });
      }
    }
  }

  return Response.json(results.slice(0, 10));
}
