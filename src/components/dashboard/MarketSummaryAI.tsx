"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketIndex } from "@/types/market";

interface Props {
  indices?: MarketIndex[];
}

interface BriefingResult {
  summary:    string;
  sentiment:  "bullish" | "bearish" | "neutral";
  keyPoints:  string[];
}

export function MarketSummaryAI({ indices = [] }: Props) {
  const [result,   setResult]   = useState<BriefingResult | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const kospi  = indices.find(i => i.name === "코스피");
      const kosdaq = indices.find(i => i.name === "코스닥");
      const nasdaq = indices.find(i => i.name === "나스닥");
      const sp500  = indices.find(i => i.name === "S&P500");

      const fmt = (v: number, decimals = 2) =>
        `${v >= 0 ? "+" : ""}${v.toFixed(decimals)}%`;

      // Fetch commodities & bonds in parallel with no additional loading state
      const commodities = await fetch("/api/market-data?type=commodities")
        .then(r => r.ok ? r.json() : null)
        .catch(() => null) as {
          wti:   { price: number; changePercent: number } | null;
          brent: { price: number; changePercent: number } | null;
          tnx:   { price: number; changePercent: number } | null;
        } | null;

      const res = await fetch("/api/market-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kospi:        kospi?.value?.toLocaleString("ko-KR",  { maximumFractionDigits: 2 }),
          kospiChange:  kospi  ? fmt(kospi.changePercent)  : undefined,
          kosdaq:       kosdaq?.value?.toLocaleString("ko-KR", { maximumFractionDigits: 2 }),
          kosdaqChange: kosdaq ? fmt(kosdaq.changePercent) : undefined,
          nasdaq:       nasdaq?.value?.toLocaleString("en-US", { maximumFractionDigits: 2 }),
          nasdaqChange: nasdaq ? fmt(nasdaq.changePercent) : undefined,
          sp500:        sp500?.value?.toLocaleString("en-US",  { maximumFractionDigits: 2 }),
          sp500Change:  sp500  ? fmt(sp500.changePercent)  : undefined,
          wti:          commodities?.wti   ? `$${commodities.wti.price.toFixed(2)}`   : undefined,
          wtiChange:    commodities?.wti   ? fmt(commodities.wti.changePercent)        : undefined,
          brent:        commodities?.brent ? `$${commodities.brent.price.toFixed(2)}` : undefined,
          brentChange:  commodities?.brent ? fmt(commodities.brent.changePercent)     : undefined,
          tnx:          commodities?.tnx   ? `${commodities.tnx.price.toFixed(3)}%`  : undefined,
          tnxChange:    commodities?.tnx   ? fmt(commodities.tnx.changePercent)       : undefined,
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json() as BriefingResult;
      setResult(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [indices]);

  // Auto-fetch once on mount
  useEffect(() => {
    fetch_();
  }, [fetch_]);

  const cfg = {
    bullish: { label: "강세", Icon: TrendingUp,  color: "text-red-500",   bg: "bg-red-500/10",   border: "border-red-500/20"   },
    bearish: { label: "약세", Icon: TrendingDown, color: "text-blue-500",  bg: "bg-blue-500/10",  border: "border-blue-500/20"  },
    neutral: { label: "중립", Icon: Minus,        color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20" },
  }[result?.sentiment ?? "neutral"];

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600/10 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h3 className="section-title text-base">AI 시장 브리핑</h3>
            <p className="text-xs text-slate-400">실시간 지수 기반 · Claude AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
              cfg.color, cfg.bg, cfg.border,
            )}>
              <cfg.Icon className="w-3 h-3" />
              {cfg.label}
            </span>
          )}
          <button
            onClick={fetch_}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw className={cn("w-4 h-4 text-slate-400", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="space-y-2 animate-pulse">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-4/5" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
        </div>
      )}

      {error && !loading && (
        <p className="text-sm text-slate-400 py-2">브리핑을 불러오지 못했습니다. 새로고침을 눌러 재시도하세요.</p>
      )}

      {result && !loading && (
        <>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
            {result.summary}
          </p>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              주요 포인트
            </p>
            <ul className="space-y-1.5">
              {result.keyPoints.map((pt, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">•</span>
                  {pt}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          {new Date().toLocaleDateString("ko-KR", {
            year: "numeric", month: "long", day: "numeric",
            hour: "2-digit", minute: "2-digit",
          })} 기준
        </span>
        <span className="text-xs text-slate-300 dark:text-slate-600">claude-sonnet-4-6</span>
      </div>
    </div>
  );
}
