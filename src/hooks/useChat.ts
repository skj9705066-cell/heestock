"use client";

import { useState, useCallback } from "react";
import type { ChatMessage, ChatSession } from "@/types/chat";
import { generateId } from "@/lib/utils";

export function useChat(stockSymbol?: string, stockName?: string, market?: "KR" | "US") {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(generateId());

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content,
        timestamp: new Date(),
        stockSymbol,
        stockName,
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      const assistantId = generateId();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        stockSymbol,
        stockName,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        const response = await fetch("/api/ai-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            stockSymbol,
            stockName,
            market,
          }),
        });

        if (!response.ok) throw new Error("API request failed");
        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") break;
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullContent += parsed.content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: fullContent }
                        : m
                    )
                  );
                }
              } catch {}
            }
          }
        }
      } catch (error) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    "죄송합니다. 응답 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [messages, stockSymbol, stockName, market]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const getSession = useCallback(
    (): ChatSession => ({
      id: sessionId,
      title: stockName
        ? `${stockName} (${stockSymbol}) 분석`
        : "일반 주식 분석",
      stockSymbol,
      stockName,
      messages,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    [sessionId, stockSymbol, stockName, messages]
  );

  return { messages, isLoading, sendMessage, clearMessages, getSession };
}
