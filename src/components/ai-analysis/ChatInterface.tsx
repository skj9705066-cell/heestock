"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Download, Trash2, Sparkles } from "lucide-react";
import { cn, generateId } from "@/lib/utils";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/types/chat";

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (content: string) => void;
  onClear: () => void;
  onExportPDF: () => void;
  stockName?: string;
  stockSymbol?: string;
}

const QUICK_QUESTIONS = [
  "실시간 데이터 기준 종합 분석을 해줘",
  "현재가 기준 밸류에이션 평가",
  "최신 분기 실적과 성장성 분석",
  "52주 고저 대비 현재 위치는?",
  "거래량/수급 상황 분석",
  "오늘 기준 투자 포인트 정리",
];

export function ChatInterface({
  messages,
  isLoading,
  onSend,
  onClear,
  onExportPDF,
  stockName,
  stockSymbol,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600/10 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {stockName ? `${stockName} AI 분석` : "AI 종목 분석"}
            </p>
            {stockSymbol && (
              <p className="text-xs text-slate-400 font-mono">{stockSymbol}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onExportPDF}
            disabled={messages.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            PDF 저장
          </button>
          <button
            onClick={onClear}
            disabled={messages.length === 0}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-40"
            title="대화 초기화"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 space-y-4">
            <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center">
              <Bot className="w-7 h-7 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-700 dark:text-slate-300">
                {stockName
                  ? `${stockName} 종목에 대해 질문해보세요`
                  : "종목을 선택하고 질문해보세요"}
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Yahoo Finance · DART 실시간 데이터를 기반으로 Claude AI가 분석합니다
              </p>
            </div>
            {stockName && (
              <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => onSend(`${stockName}의 ${q}`)}
                    className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3 animate-fade-in",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}

              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : "bg-white dark:bg-dark-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-tl-sm"
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-bold prose-headings:text-slate-800 dark:prose-headings:text-slate-200 prose-p:text-slate-600 dark:prose-p:text-slate-400 prose-strong:text-slate-800 dark:prose-strong:text-slate-200 prose-code:text-blue-600 dark:prose-code:text-blue-400 prose-code:bg-blue-50 dark:prose-code:bg-blue-900/20 prose-code:px-1 prose-code:rounded prose-table:text-xs prose-th:bg-slate-50 dark:prose-th:bg-slate-800">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content ||
                        (isLoading ? "▋" : "")}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
                <p
                  className={cn(
                    "text-xs mt-1.5",
                    msg.role === "user"
                      ? "text-blue-200"
                      : "text-slate-400"
                  )}
                >
                  {new Date(msg.timestamp).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              {msg.role === "user" && (
                <div className="w-7 h-7 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                </div>
              )}
            </div>
          ))
        )}

        {isLoading &&
          messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white dark:bg-dark-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3">
                <LoadingSpinner size="sm" />
              </div>
            </div>
          )}

        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder={
                stockName
                  ? `${stockName}에 대해 질문하세요... (Shift+Enter: 줄바꿈)`
                  : "종목을 먼저 선택해주세요..."
              }
              rows={1}
              className="input-field resize-none min-h-[44px] max-h-40 py-3 pr-3"
              style={{ height: "44px" }}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 w-11 h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:cursor-not-allowed text-white disabled:text-slate-400 rounded-xl flex items-center justify-center transition-colors"
          >
            {isLoading ? (
              <LoadingSpinner size="sm" className="border-white border-t-blue-200" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
        <p className="text-xs text-slate-400 mt-2 text-center">
          AI 답변은 투자 참고용이며 투자 권유가 아닙니다
        </p>
      </div>
    </div>
  );
}
