import { NextRequest } from "next/server";
import { searchYFSymbols } from "@/lib/yahoo-finance";

// Static fallback list (Korean + US major stocks)
const STATIC_STOCKS = [
  { symbol: "005930", name: "삼성전자",       market: "KR", sector: "반도체"         },
  { symbol: "000660", name: "SK하이닉스",     market: "KR", sector: "반도체"         },
  { symbol: "035420", name: "NAVER",          market: "KR", sector: "IT서비스"        },
  { symbol: "035720", name: "카카오",          market: "KR", sector: "IT서비스"        },
  { symbol: "207940", name: "삼성바이오로직스",market: "KR", sector: "바이오"         },
  { symbol: "373220", name: "LG에너지솔루션", market: "KR", sector: "이차전지"        },
  { symbol: "006400", name: "삼성SDI",        market: "KR", sector: "이차전지"        },
  { symbol: "247540", name: "에코프로비엠",   market: "KR", sector: "이차전지"        },
  { symbol: "051910", name: "LG화학",          market: "KR", sector: "화학"           },
  { symbol: "005380", name: "현대차",          market: "KR", sector: "자동차"         },
  { symbol: "000270", name: "기아",            market: "KR", sector: "자동차"         },
  { symbol: "042700", name: "한미반도체",      market: "KR", sector: "반도체장비"     },
  { symbol: "259960", name: "크래프톤",        market: "KR", sector: "게임"           },
  { symbol: "068270", name: "셀트리온",        market: "KR", sector: "바이오"         },
  { symbol: "105560", name: "KB금융",          market: "KR", sector: "금융"           },
  { symbol: "055550", name: "신한지주",        market: "KR", sector: "금융"           },
  { symbol: "086790", name: "하나금융지주",    market: "KR", sector: "금융"           },
  { symbol: "005490", name: "POSCO홀딩스",    market: "KR", sector: "철강"           },
  { symbol: "004020", name: "현대제철",        market: "KR", sector: "철강"           },
  { symbol: "028260", name: "삼성물산",        market: "KR", sector: "건설"           },
  { symbol: "AAPL",   name: "애플",            market: "US", sector: "하드웨어"       },
  { symbol: "MSFT",   name: "마이크로소프트", market: "US", sector: "소프트웨어"     },
  { symbol: "NVDA",   name: "엔비디아",        market: "US", sector: "반도체"         },
  { symbol: "GOOGL",  name: "알파벳(구글)",    market: "US", sector: "인터넷"         },
  { symbol: "META",   name: "메타",            market: "US", sector: "소셜미디어"     },
  { symbol: "TSLA",   name: "테슬라",          market: "US", sector: "전기차"         },
  { symbol: "AMZN",   name: "아마존",          market: "US", sector: "이커머스/클라우드"},
  { symbol: "AVGO",   name: "브로드컴",        market: "US", sector: "반도체"         },
  { symbol: "ORCL",   name: "오라클",          market: "US", sector: "소프트웨어"     },
  { symbol: "AMD",    name: "AMD",             market: "US", sector: "반도체"         },
  { symbol: "PLTR",   name: "팔란티어",        market: "US", sector: "빅데이터/AI"   },
  { symbol: "SMCI",   name: "슈퍼마이크로",    market: "US", sector: "서버"           },
];

export async function GET(req: NextRequest) {
  const query  = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const market = req.nextUrl.searchParams.get("market");

  if (!query) return Response.json([]);

  const lq = query.toLowerCase();

  // Search static list first (fast, Korean names supported)
  let staticResults = STATIC_STOCKS.filter(s =>
    s.symbol.toLowerCase().includes(lq) || s.name.toLowerCase().includes(lq),
  );
  if (market && market !== "ALL") {
    staticResults = staticResults.filter(s => s.market === market);
  }

  // If not enough static results, try Yahoo Finance search API
  let yfResults: typeof STATIC_STOCKS = [];
  if (staticResults.length < 3) {
    try {
      const yfRaw = await searchYFSymbols(query);
      yfResults = yfRaw
        .filter(r => {
          if (r.market === "OTHER") return false;
          if (market && market !== "ALL" && r.market !== market) return false;
          // dedupe against static
          const sym = r.symbol.replace(/\.(KS|KQ)$/, "");
          return !staticResults.some(s => s.symbol === sym);
        })
        .map(r => ({
          symbol: r.symbol.replace(/\.(KS|KQ)$/, ""),
          name:   r.name,
          market: r.market as "KR" | "US",
          sector: "",
        }));
    } catch {
      // YF search failed, continue with static only
    }
  }

  const merged = [...staticResults, ...yfResults].slice(0, 10);
  return Response.json(merged);
}
