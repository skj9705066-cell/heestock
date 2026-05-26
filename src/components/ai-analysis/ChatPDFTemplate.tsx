import type { ChatMessage } from "@/types/chat";

interface Props {
  messages: ChatMessage[];
  stockName?: string;
  stockSymbol?: string;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .trim();
}

export function ChatPDFTemplate({ messages, stockName, stockSymbol }: Props) {
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div style={{
      fontFamily: "'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif",
      background: "#ffffff",
      color: "#1e293b",
      padding: "48px 52px",
      width: "860px",
    }}>
      {/* Header */}
      <div style={{ borderBottom: "3px solid #1d4ed8", paddingBottom: 16, marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#0f172a" }}>
              {stockName ?? "AI 종목 분석"}
              {stockSymbol && (
                <span style={{ fontSize: 14, fontWeight: 400, color: "#64748b", marginLeft: 10 }}>
                  {stockSymbol}
                </span>
              )}
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
              AI 종목 분석 리포트 · Claude AI
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>생성일: {today}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#3b82f6", fontWeight: 700 }}>
              희스탁 · HeeStock
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: msg.role === "user" ? "#1d4ed8" : "#059669",
              marginBottom: 6,
              textTransform: "uppercase" as const,
              letterSpacing: "0.08em",
            }}>
              {msg.role === "user" ? "질문" : "AI 답변"}
            </div>
            {msg.role === "user" ? (
              <div style={{ fontSize: 12, lineHeight: 1.8, color: "#334155", whiteSpace: "pre-wrap" as const }}>
                {msg.content}
              </div>
            ) : (
              <div style={{
                fontSize: 12,
                lineHeight: 1.8,
                color: "#334155",
                background: "#f8fafc",
                padding: "12px 16px",
                borderLeft: "3px solid #3b82f6",
                borderRadius: "0 8px 8px 0",
                whiteSpace: "pre-wrap" as const,
              }}>
                {stripMarkdown(msg.content)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 32,
        paddingTop: 12,
        borderTop: "1px solid #e2e8f0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <p style={{ fontSize: 9, color: "#94a3b8", margin: 0 }}>
          본 보고서는 투자 참고용이며 투자 권유가 아닙니다.
        </p>
        <p style={{ fontSize: 9, color: "#94a3b8", margin: 0 }}>
          Powered by 희스탁 · claude-sonnet-4-6
        </p>
      </div>
    </div>
  );
}
