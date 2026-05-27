"use client";

import { useState, useCallback, useRef } from "react";
import { StockSearch } from "@/components/ai-analysis/StockSearch";
import { FinancialTable } from "@/components/financials/FinancialTable";
import { FinancialPDFTemplate } from "@/components/financials/FinancialPDFTemplate";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/Badge";
import { exportElementAsPDF } from "@/lib/pdf-export";
import {
  Download, Sparkles, FileBarChart2,
  RefreshCw, AlertTriangle, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FinancialData } from "@/types/financial";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SearchResult {
  symbol: string;
  name: string;
  market: "KR" | "US";
  sector: string;
}

export default function FinancialsPage() {
  const [selected,    setSelected]    = useState<SearchResult | null>(null);
  const [mode,        setMode]        = useState<"annual" | "quarterly">("annual");
  const [finData,     setFinData]     = useState<FinancialData | null>(null);
  const [isLoading,   setIsLoading]   = useState(false);
  const [aiAnalysis,  setAiAnalysis]  = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  // ── Fetch financial data ──────────────────────────────────────────────────
  const fetchFinancials = useCallback(async (stock: SearchResult) => {
    setIsLoading(true);
    setFinData(null);
    setAiAnalysis("");
    try {
      const res = await fetch(
        `/api/financials?symbol=${encodeURIComponent(stock.symbol)}&market=${stock.market}&name=${encodeURIComponent(stock.name)}`,
      );
      const data: FinancialData = await res.json();
      setFinData(data);
    } catch {
      toast.error("재무 데이터를 불러오지 못했습니다");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSelect = (stock: SearchResult | null) => {
    setSelected(stock);
    setAiAnalysis("");
    if (stock) fetchFinancials(stock);
  };

  // ── AI Analysis ───────────────────────────────────────────────────────────
  const handleAiAnalysis = async () => {
    if (!finData || !selected) return;
    setIsAiLoading(true);
    setAiAnalysis("");

    const annualSummary = finData.annual.map(r =>
      `${r.period}: 매출 ${r.revenue?.toLocaleString() ?? "—"}, 영업이익 ${r.operatingIncome?.toLocaleString() ?? "—"} (${r.operatingMargin?.toFixed(1) ?? "—"}%), 순이익 ${r.netIncome?.toLocaleString() ?? "—"}`
    ).join("\n");

    const prompt = `${finData.name}(${finData.symbol}) 최근 ${finData.annual.length}년 재무 데이터를 분석해주세요.

[연간 재무 요약 - 단위: ${finData.unit}]
${annualSummary}
부채비율 (최근): ${finData.annual.at(-1)?.debtRatio?.toFixed(0) ?? "—"}%
FCF (최근): ${finData.annual.at(-1)?.freeCashFlow?.toLocaleString() ?? "—"}

다음 항목을 포함하여 분석해주세요:
1. **매출 및 수익성 트렌드** - 성장세·둔화 여부
2. **재무 건전성** - 부채비율, 자본구조 평가
3. **현금흐름 분석** - FCF 창출 능력
4. **핵심 리스크** - 주의해야 할 위험 요인
5. **투자 포인트** - 긍정적 요인 요약

각 항목은 2-3문장으로 간결하게 작성해주세요.`;

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          stockSymbol: selected.symbol,
          stockName: selected.name,
        }),
      });

      if (!res.body) throw new Error("No body");
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split("\n")) {
          if (line.startsWith("data: ") && line.slice(6) !== "[DONE]") {
            try {
              const { content } = JSON.parse(line.slice(6));
              if (content) {
                full += content;
                setAiAnalysis(full);
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch {
      toast.error("AI 분석 생성에 실패했습니다");
    } finally {
      setIsAiLoading(false);
    }
  };

  // ── PDF Export ────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    if (!selected || !finData || !pdfRef.current) return;
    setIsExporting(true);
    try {
      await exportElementAsPDF(
        pdfRef.current,
        `${selected.name}_재무제표_${new Date().toISOString().slice(0, 10)}.pdf`,
      );
      toast.success("PDF가 저장되었습니다");
    } catch {
      toast.error("PDF 저장에 실패했습니다");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">재무제표</h1>
          <p className="text-sm text-slate-400 mt-1">
            연간·분기 재무 데이터 · Alpha Vantage API · AI 분석 · PDF 저장
          </p>
        </div>

        {/* Search */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileBarChart2 className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">종목 검색</h2>
          </div>
          <StockSearch onSelect={handleSelect} selectedStock={selected} />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="card p-8 flex items-center justify-center gap-3">
            <LoadingSpinner />
            <span className="text-sm text-slate-400">재무 데이터 불러오는 중...</span>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !finData && (
          <div className="card p-12 text-center text-slate-400">
            <FileBarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">종목을 검색하면 재무제표가 표시됩니다</p>
            <p className="text-xs mt-1">한국 주식 · 미국 주식 모두 지원</p>
          </div>
        )}

        {/* Financial data */}
        {!isLoading && finData && (
          <>
            {/* MOCK DATA WARNING — shown at top when real API failed and preset/generated data is being displayed */}
            {finData.isMock && (
              <div className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-700 dark:text-red-300">
                    ⚠️ 실데이터를 불러오지 못해 임시 데이터를 표시 중입니다
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {finData.market === "KR"
                      ? "DART OpenAPI 호출 실패 — 아래 수치는 사전 정의된 추정값 또는 절차적으로 생성된 값이며, 실제 공시 데이터가 아닙니다."
                      : "Alpha Vantage / Yahoo Finance 호출 실패 — 아래 수치는 사전 정의된 추정값 또는 절차적으로 생성된 값이며, 실제 공시 데이터가 아닙니다."}
                    {" "}투자 판단에 사용하지 마세요.
                  </p>
                </div>
              </div>
            )}

            {/* Stock info + controls bar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {finData.name}
                </h2>
                <Badge variant={finData.market === "KR" ? "yellow" : "blue"}>
                  {finData.market}
                </Badge>
                <span className="text-sm text-slate-400 font-mono">{finData.symbol}</span>
                {finData.isMock && (
                  <Badge variant="red">임시 데이터</Badge>
                )}
              </div>

              <div className="flex gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg ml-auto">
                {(["annual", "quarterly"] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                      mode === m
                        ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
                    )}
                  >
                    {m === "annual" ? "연간" : "분기"}
                  </button>
                ))}
              </div>

              <button
                onClick={() => selected && fetchFinancials(selected)}
                className="btn-ghost text-xs flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> 새로고침
              </button>

              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {isExporting
                  ? <><LoadingSpinner size="sm" className="border-white border-t-blue-200" /> 생성 중...</>
                  : <><Download className="w-4 h-4" /> PDF 저장</>}
              </button>
            </div>

            {/* Table */}
            <div className="card overflow-hidden">
              <FinancialTable data={finData} mode={mode} />
            </div>

            {/* AI Analysis section */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">AI 재무 분석</h3>
                  <span className="text-xs text-slate-400">Claude AI · 재무 데이터 기반</span>
                </div>
                <button
                  onClick={handleAiAnalysis}
                  disabled={isAiLoading}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all",
                    isAiLoading
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                      : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800",
                  )}
                >
                  {isAiLoading
                    ? <><LoadingSpinner size="sm" /> 분석 중...</>
                    : <><Sparkles className="w-3.5 h-3.5" /> AI 분석 생성</>}
                </button>
              </div>

              {!aiAnalysis && !isAiLoading && (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                  <ChevronRight className="w-4 h-4" />
                  <span>
                    &apos;AI 분석 생성&apos; 버튼을 클릭하면 Claude AI가 재무 데이터를 분석합니다.
                    결과는 PDF에도 포함됩니다.
                  </span>
                </div>
              )}

              {(aiAnalysis || isAiLoading) && (
                <div className="prose prose-sm dark:prose-invert max-w-none
                                prose-headings:text-slate-800 dark:prose-headings:text-slate-200
                                prose-p:text-slate-600 dark:prose-p:text-slate-400
                                prose-strong:text-slate-800 dark:prose-strong:text-slate-200">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {aiAnalysis || " "}
                  </ReactMarkdown>
                  {isAiLoading && <span className="animate-stream">▋</span>}
                </div>
              )}
            </div>

          </>
        )}
      </div>

      {/* Off-screen PDF template — captured by html2canvas on export */}
      {finData && (
        <div
          ref={pdfRef}
          style={{ position: "fixed", left: -9999, top: 0, zIndex: -1, pointerEvents: "none" }}
          aria-hidden="true"
        >
          <FinancialPDFTemplate data={finData} aiAnalysis={aiAnalysis || undefined} />
        </div>
      )}
    </>
  );
}
