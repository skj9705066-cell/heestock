import { anthropic, MARKET_SUMMARY_SYSTEM_PROMPT } from "@/lib/anthropic";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const marketData = await req.json().catch(() => ({}));

    const oilLine = (marketData.wti || marketData.brent)
      ? `\n- WTI 원유: ${marketData.wti ?? "N/A"} (${marketData.wtiChange ?? "N/A"}) / 브렌트유: ${marketData.brent ?? "N/A"} (${marketData.brentChange ?? "N/A"})`
      : "";
    const tnxLine = marketData.tnx
      ? `\n- 미국 국채 10년물: ${marketData.tnx} (${marketData.tnxChange ?? "N/A"})`
      : "";

    const prompt = `오늘 ${new Date().toLocaleDateString("ko-KR")} 기준 시장 현황을 분석해주세요.

시장 데이터:
- 코스피: ${marketData.kospi ?? "2,651.34"} (${marketData.kospiChange ?? "+0.70%"})
- 코스닥: ${marketData.kosdaq ?? "873.21"} (${marketData.kosdaqChange ?? "-0.47%"})
- 나스닥: ${marketData.nasdaq ?? "19,287.45"} (${marketData.nasdaqChange ?? "+0.75%"})
- S&P500: ${marketData.sp500 ?? "5,302.43"} (${marketData.sp500Change ?? "+0.53%"})
- 원/달러: ${marketData.usdkrw ?? "1,335.40"}원${oilLine}${tnxLine}

위 데이터를 기반으로 시장 브리핑을 JSON 형식으로 제공해주세요. 유가와 금리 데이터가 있다면 반드시 해당 지표가 국내외 증시와 섹터에 미치는 영향도 keyPoints에 포함해주세요:
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

    return Response.json(parsed);
  } catch (error) {
    console.error("Market summary error:", error);
    return Response.json(
      {
        summary: "시장 데이터를 불러오는 중 오류가 발생했습니다.",
        sentiment: "neutral",
        keyPoints: [],
      },
      { status: 500 }
    );
  }
}
