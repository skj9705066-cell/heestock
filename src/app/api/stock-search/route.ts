import { NextRequest } from "next/server";
import { searchYFSymbols } from "@/lib/yahoo-finance";

// Hangul → ticker lookup (Korean Hangul is not supported by Yahoo Finance search).
// Also used to enrich YF results with curated sector labels in Korean.
// Treated as a LOOKUP table (metadata mapping), not as a real-data fallback.
const KR_INDEX: ReadonlyArray<{ symbol: string; name: string; market: "KR"; sector: string }> = [
  { symbol: "005930", name: "삼성전자",         market: "KR", sector: "반도체"      },
  { symbol: "000660", name: "SK하이닉스",       market: "KR", sector: "반도체"      },
  { symbol: "042700", name: "한미반도체",       market: "KR", sector: "반도체장비"   },
  { symbol: "000990", name: "DB하이텍",          market: "KR", sector: "반도체"      },
  { symbol: "035420", name: "NAVER",              market: "KR", sector: "IT서비스"    },
  { symbol: "035720", name: "카카오",            market: "KR", sector: "IT서비스"    },
  { symbol: "207940", name: "삼성바이오로직스", market: "KR", sector: "바이오"      },
  { symbol: "068270", name: "셀트리온",          market: "KR", sector: "바이오"      },
  { symbol: "373220", name: "LG에너지솔루션",  market: "KR", sector: "이차전지"    },
  { symbol: "006400", name: "삼성SDI",           market: "KR", sector: "이차전지"    },
  { symbol: "247540", name: "에코프로비엠",     market: "KR", sector: "이차전지"    },
  { symbol: "051910", name: "LG화학",             market: "KR", sector: "화학"        },
  { symbol: "005380", name: "현대차",            market: "KR", sector: "자동차"      },
  { symbol: "000270", name: "기아",                market: "KR", sector: "자동차"      },
  { symbol: "012330", name: "현대모비스",        market: "KR", sector: "자동차부품"   },
  { symbol: "259960", name: "크래프톤",          market: "KR", sector: "게임"        },
  { symbol: "036570", name: "NCsoft",             market: "KR", sector: "게임"        },
  { symbol: "263750", name: "펄어비스",          market: "KR", sector: "게임"        },
  { symbol: "041510", name: "에스엠",            market: "KR", sector: "엔터"        },
  { symbol: "035900", name: "JYP엔터",           market: "KR", sector: "엔터"        },
  { symbol: "105560", name: "KB금융",             market: "KR", sector: "금융"        },
  { symbol: "055550", name: "신한지주",          market: "KR", sector: "금융"        },
  { symbol: "086790", name: "하나금융지주",    market: "KR", sector: "금융"        },
  { symbol: "005490", name: "POSCO홀딩스",     market: "KR", sector: "철강"        },
  { symbol: "004020", name: "현대제철",          market: "KR", sector: "철강"        },
  { symbol: "028260", name: "삼성물산",          market: "KR", sector: "건설"        },
  { symbol: "326030", name: "SK바이오팜",       market: "KR", sector: "바이오"      },
  { symbol: "096770", name: "SK이노베이션",    market: "KR", sector: "에너지"      },
  { symbol: "000720", name: "현대건설",          market: "KR", sector: "건설"        },
  { symbol: "011170", name: "롯데케미칼",        market: "KR", sector: "화학"        },
  { symbol: "009830", name: "한화솔루션",        market: "KR", sector: "화학"        },
];

// Symbol → curated Korean sector label (overrides YF's English industry).
const SECTOR_BY_SYMBOL = new Map<string, string>(
  KR_INDEX.map(s => [s.symbol, s.sector]),
);

const HANGUL_RE = /[ㄱ-힝]/;

export async function GET(req: NextRequest) {
  const query  = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const market = req.nextUrl.searchParams.get("market");
  const filterMarket = market === "KR" || market === "US" ? market : null;

  if (!query) return Response.json([]);

  const lq = query.toLowerCase();

  // Hangul query path: YF does not support Hangul (returns 400). Use the local index.
  if (HANGUL_RE.test(query)) {
    const matches = KR_INDEX
      .filter(s => s.name.toLowerCase().includes(lq))
      .filter(s => !filterMarket || s.market === filterMarket)
      .slice(0, 10);
    return Response.json(matches);
  }

  // English / ticker path: Yahoo Finance search is primary.
  let yfResults: Array<{ symbol: string; name: string; market: "KR" | "US"; sector: string }> = [];
  try {
    const yfRaw = await searchYFSymbols(query);
    yfResults = yfRaw
      .filter(r => r.market !== "OTHER")
      .filter(r => !filterMarket || r.market === filterMarket)
      .map(r => {
        const bareSymbol = r.symbol.replace(/\.(KS|KQ)$/, "");
        const sector = SECTOR_BY_SYMBOL.get(bareSymbol) ?? "";
        return {
          symbol: bareSymbol,
          name: r.name,
          market: r.market as "KR" | "US",
          sector,
        };
      });
  } catch {
    // fall through to local KR index match for Korean codes (e.g., "005930")
  }

  // Always add KR_INDEX matches by symbol/name for English-letter searches that hit Korean tickers
  // (e.g., user typed "005930" and YF returned data, or user typed "samsung" — augment with our sector label).
  const seen = new Set(yfResults.map(r => r.symbol));
  const localMatches = KR_INDEX
    .filter(s => !seen.has(s.symbol))
    .filter(s => s.symbol.includes(query) || s.name.toLowerCase().includes(lq))
    .filter(s => !filterMarket || s.market === filterMarket);

  const merged = [...yfResults, ...localMatches].slice(0, 10);
  return Response.json(merged);
}
