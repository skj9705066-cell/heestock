import { anthropic, STOCK_ANALYSIS_SYSTEM_PROMPT } from "@/lib/anthropic";
import { buildStockSnapshot, formatSnapshotForPrompt, type Market } from "@/lib/stock-snapshot";
import { NextRequest } from "next/server";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const revalidate  = 0;
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { messages, stockSymbol, stockName, market } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch real-time snapshot for the selected stock (errors are tolerated — the snapshot
    // still returns with an `errors` array so the model knows what's missing).
    let snapshotContext = "";
    const todayKr = new Date().toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (stockSymbol) {
      try {
        const mk: Market | undefined =
          market === "KR" || market === "US" ? market : undefined;
        const snap = await buildStockSnapshot(stockSymbol, stockName ?? stockSymbol, mk);
        snapshotContext = formatSnapshotForPrompt(snap);
      } catch (err) {
        console.warn("[ai-chat] snapshot failed:", (err as Error).message);
      }
    }

    const systemPrompt = stockSymbol
      ? [
          STOCK_ANALYSIS_SYSTEM_PROMPT,
          "",
          `# 분석 대상`,
          `종목: ${stockName ?? stockSymbol} (${stockSymbol})`,
          `오늘 날짜: ${todayKr} ← **반드시 이 날짜만 기준일로 사용**`,
          "",
          snapshotContext ||
            "_실시간 데이터를 가져오지 못했습니다 — 추측·프리셋·과거 컨센서스로 채우지 말고 '데이터 미수신'을 명시하고 일반론 위주로 답변하세요._",
        ].join("\n")
      : `${STOCK_ANALYSIS_SYSTEM_PROMPT}\n\n오늘 날짜: ${todayKr}`;

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              const data = JSON.stringify({ content: chunk.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const errData = JSON.stringify({ error: "Stream error" });
          controller.enqueue(encoder.encode(`data: ${errData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("AI Chat error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
