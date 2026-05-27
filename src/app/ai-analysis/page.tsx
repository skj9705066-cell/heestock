"use client";

import { useState, useCallback, useRef } from "react";
import { StockSearch } from "@/components/ai-analysis/StockSearch";
import { ChatInterface } from "@/components/ai-analysis/ChatInterface";
import { ChatHistory } from "@/components/ai-analysis/ChatHistory";
import { ChatPDFTemplate } from "@/components/ai-analysis/ChatPDFTemplate";
import { StockSnapshotPanel } from "@/components/ai-analysis/StockSnapshotPanel";
import { exportElementAsPDF } from "@/lib/pdf-export";
import { useChat } from "@/hooks/useChat";
import { History, ChevronLeft, ChevronRight } from "lucide-react";
import type { ChatSession } from "@/types/chat";
import toast from "react-hot-toast";

interface SearchResult {
  symbol: string;
  name: string;
  market: "KR" | "US";
  sector: string;
}

export default function AIAnalysisPage() {
  const [selectedStock, setSelectedStock] = useState<SearchResult | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const chatPdfRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, sendMessage, clearMessages, getSession } =
    useChat(selectedStock?.symbol, selectedStock?.name, selectedStock?.market);

  const handleStockSelect = (stock: SearchResult | null) => {
    setSelectedStock(stock);
    clearMessages();
  };

  const handleExportPDF = useCallback(async () => {
    if (messages.length === 0 || !chatPdfRef.current) return;
    try {
      await exportElementAsPDF(
        chatPdfRef.current,
        `${selectedStock?.name ?? "analysis"}_AI분석_${new Date().toISOString().slice(0, 10)}.pdf`,
      );
      toast.success("PDF가 저장되었습니다");
    } catch {
      toast.error("PDF 저장 중 오류가 발생했습니다");
    }
  }, [messages, selectedStock]);

  const handleClear = () => {
    if (messages.length > 0) {
      const session = getSession();
      setSessions((prev) => [session, ...prev.slice(0, 19)]);
    }
    clearMessages();
    toast.success("대화가 초기화되었습니다");
  };

  const handleSelectSession = (session: ChatSession) => {
    toast("대화 기록 불러오기는 Supabase 연동 후 사용 가능합니다", {
      icon: "ℹ️",
    });
    setShowHistory(false);
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* History Sidebar */}
      <div
        className={`${
          showHistory ? "w-72" : "w-0"
        } transition-all duration-300 overflow-hidden border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-dark-900`}
      >
        <div className="p-4 h-full overflow-y-auto">
          <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <History className="w-4 h-4" />
            대화 기록
          </h3>
          <ChatHistory
            sessions={sessions}
            onSelect={handleSelectSession}
            onDelete={handleDeleteSession}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-dark-900">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="대화 기록"
            >
              {showHistory ? (
                <ChevronLeft className="w-4 h-4 text-slate-500" />
              ) : (
                <History className="w-4 h-4 text-slate-500" />
              )}
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                AI 종목 분석
              </h1>
              <p className="text-xs text-slate-400">
                Claude AI 기반 무제한 질문 · 수급/기술적/펀더멘탈 분석
              </p>
            </div>
          </div>

          <StockSearch
            onSelect={handleStockSelect}
            selectedStock={selectedStock}
          />
        </div>

        {/* Live snapshot panel (real-time data above chat) */}
        {selectedStock && (
          <StockSnapshotPanel
            symbol={selectedStock.symbol}
            name={selectedStock.name}
            market={selectedStock.market}
          />
        )}

        {/* Chat Area — flex-1 with min-h-0 ensures the chat keeps its share of
            the column when the snapshot panel above it grows. */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ChatInterface
            messages={messages}
            isLoading={isLoading}
            onSend={sendMessage}
            onClear={handleClear}
            onExportPDF={handleExportPDF}
            stockName={selectedStock?.name}
            stockSymbol={selectedStock?.symbol}
          />
        </div>
      </div>

      {/* Off-screen PDF template — captured by html2canvas on export */}
      <div
        ref={chatPdfRef}
        style={{ position: "fixed", left: -9999, top: 0, zIndex: -1, pointerEvents: "none" }}
        aria-hidden="true"
      >
        <ChatPDFTemplate
          messages={messages}
          stockName={selectedStock?.name}
          stockSymbol={selectedStock?.symbol}
        />
      </div>
    </div>
  );
}
