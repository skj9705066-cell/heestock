import { anthropic, MARKET_SUMMARY_SYSTEM_PROMPT } from "@/lib/anthropic";
import { NextRequest } from "next/server";

export const runtime    = "nodejs";
export const dynamic    = "force-dynamic";
export const revalidate = 0;

// Empty briefing returned when the caller can't supply real index data. We
// previously stuffed hardcoded 2024 values into the prompt — that produced
// AI briefings written against stale numbers. Now: no real data → no AI
// call → UI just shows the empty state.
const EMPTY_BRIEFING = {
  summary:   "실시간 지수 데이터를 가져오지 못했습니다. 잠시 후 새로고침을 눌러 재시도해주세요.",
  sentiment: "neutral" as const,
  keyPoints: [] as string[],
};

const NO_STORE = { "Cache-Control": "no-store, must-revalidate" } as const;

// "+1.44%" / "-1.15%" → 1.44 / -1.15
function pctNum(s?: string): number | null {
  if (!s) return null;
  const n = parseFloat(String(s).replace(/[+%,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// Claude 호출이 불가능할 때(크레딧 소진·일시 장애 등) 실시간 숫자만으로 만드는
// 데이터 기반 자동 브리핑. AI 산문은 아니지만 화면이 비지 않게 한다.
// source:"auto" 로 표시해 UI가 "Claude AI"가 아님을 정직하게 라벨링한다.
interface MarketData {
  kospi?: string; kospiChange?: string; kosdaq?: string; kosdaqChange?: string;
  nasdaq?: string; nasdaqChange?: string; sp500?: string; sp500Change?: string;
  wti?: string; wtiChange?: string; brent?: string; brentChange?: string;
  tnx?: string; tnxChange?: string;
}

function buildAutoBriefing(m: MarketData) {
  const kospiP  = pctNum(m.kospiChange);
  const kosdaqP = pctNum(m.kosdaqChange);
  const nasP    = pctNum(m.nasdaqChange);
  const spP     = pctNum(m.sp500Change);
  const wtiP    = pctNum(m.wtiChange);
  const tnxP    = pctNum(m.tnxChange);

  const dir = (n: number) => (n > 0.05 ? "상승" : n < -0.05 ? "하락" : "보합");
  const vals = [kospiP, kosdaqP, nasP, spP].filter((n): n is number => n !== null);
  const avg = vals.length ? vals.reduce((a, c) => a + c, 0) / vals.length : 0;
  const sentiment: "bullish" | "bearish" | "neutral" =
    avg > 0.3 ? "bullish" : avg < -0.3 ? "bearish" : "neutral";
  const mood = sentiment === "bullish" ? "강세" : sentiment === "bearish" ? "약세" : "중립";

  const krMood =
    kospiP !== null && kosdaqP !== null
      ? (kospiP + kosdaqP) / 2 > 0.05 ? "상승" : (kospiP + kosdaqP) / 2 < -0.05 ? "하락" : "혼조"
      : "혼조";
  const usMood =
    nasP !== null && spP !== null
      ? (nasP + spP) / 2 > 0.05 ? "강세" : (nasP + spP) / 2 < -0.05 ? "약세" : "보합"
      : "보합";

  const summary =
    `국내 증시는 코스피 ${m.kospi ?? "-"}(${m.kospiChange ?? "-"}), 코스닥 ${m.kosdaq ?? "-"}(${m.kosdaqChange ?? "-"})로 ${krMood} 흐름입니다. ` +
    `간밤 미국 증시는 나스닥 ${m.nasdaqChange ?? "-"}, S&P500 ${m.sp500Change ?? "-"}로 ${usMood}를 보였습니다. ` +
    `종합적으로 오늘 시장 분위기는 ${mood}으로 판단됩니다.`;

  const keyPoints: string[] = [];
  if (kospiP !== null)  keyPoints.push(`코스피 ${m.kospi ?? ""} (${m.kospiChange}) ${dir(kospiP)}`);
  if (kosdaqP !== null) keyPoints.push(`코스닥 ${m.kosdaq ?? ""} (${m.kosdaqChange}) ${dir(kosdaqP)}`);
  if (nasP !== null && spP !== null)
    keyPoints.push(`미국 증시 ${usMood}(나스닥 ${m.nasdaqChange}, S&P500 ${m.sp500Change}) — 국내 투자심리에 영향`);
  if (wtiP !== null)
    keyPoints.push(`WTI 유가 ${m.wti} (${m.wtiChange}) ${dir(wtiP)} — 에너지·화학·항공 등 관련 섹터 주시`);
  if (tnxP !== null)
    keyPoints.push(`미 국채 10년물 ${m.tnx} (${m.tnxChange}) ${dir(tnxP)} — 금리 방향이 성장주 밸류에이션에 영향`);

  return { summary, sentiment, keyPoints, source: "auto" as const };
}

export async function POST(req: NextRequest) {
  try {
    const marketData = await req.json().catch(() => ({}));

    // Require all four index values — without them the AI has nothing real
    // to anchor against. Return empty briefing instead of fabricating a prompt.
    const haveCore =
      marketData.kospi  && marketData.kospiChange  &&
      marketData.kosdaq && marketData.kosdaqChange &&
      marketData.nasdaq && marketData.nasdaqChange &&
      marketData.sp500  && marketData.sp500Change;

    if (!haveCore) {
      return Response.json(EMPTY_BRIEFING, { headers: NO_STORE });
    }

    // Optional enrichments — included only when actually provided.
    const lines: string[] = [
      `- 코스피: ${marketData.kospi} (${marketData.kospiChange})`,
      `- 코스닥: ${marketData.kosdaq} (${marketData.kosdaqChange})`,
      `- 나스닥: ${marketData.nasdaq} (${marketData.nasdaqChange})`,
      `- S&P500: ${marketData.sp500} (${marketData.sp500Change})`,
    ];
    if (marketData.usdkrw) lines.push(`- 원/달러: ${marketData.usdkrw}원`);
    if (marketData.wti || marketData.brent) {
      lines.push(`- WTI 원유: ${marketData.wti ?? "N/A"} (${marketData.wtiChange ?? "N/A"}) / 브렌트유: ${marketData.brent ?? "N/A"} (${marketData.brentChange ?? "N/A"})`);
    }
    if (marketData.tnx) {
      lines.push(`- 미국 국채 10년물: ${marketData.tnx} (${marketData.tnxChange ?? "N/A"})`);
    }

    const prompt = `오늘 ${new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} 기준 시장 현황을 분석해주세요.

시장 데이터 (모두 실시간 측정값):
${lines.join("\n")}

위 데이터만을 기반으로 시장 브리핑을 JSON 형식으로 제공해주세요. 데이터에 포함되지 않은 수치는 절대 추측하지 말고, 유가와 금리 데이터가 있다면 반드시 해당 지표가 국내외 증시와 섹터에 미치는 영향도 keyPoints에 포함해주세요:
{
  "summary": "전체 시황 요약 (200자 내외)",
  "sentiment": "bullish|bearish|neutral",
  "keyPoints": ["포인트1", "포인트2", "포인트3", "포인트4", "포인트5"]
}`;

    // Claude 호출 — 실패(크레딧 소진·일시 장애 등) 시 데이터 기반 자동 브리핑으로 폴백.
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: MARKET_SUMMARY_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== "text") throw new Error("Unexpected response type");

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");

      const parsed = JSON.parse(jsonMatch[0]);
      return Response.json({ ...parsed, source: "ai" }, { headers: NO_STORE });
    } catch (aiError) {
      console.warn("[market-summary] AI 호출 실패 → 데이터 기반 폴백 사용:", (aiError as Error).message);
      return Response.json(buildAutoBriefing(marketData), { headers: NO_STORE });
    }
  } catch (error) {
    console.error("Market summary error:", error);
    return Response.json(
      {
        summary: "시장 데이터를 불러오는 중 오류가 발생했습니다.",
        sentiment: "neutral",
        keyPoints: [],
      },
      { status: 500, headers: NO_STORE },
    );
  }
}
