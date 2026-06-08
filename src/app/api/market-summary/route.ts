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

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: MARKET_SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return Response.json(parsed, { headers: NO_STORE });
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
