"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn, formatPercent } from "@/lib/utils";
import type { MarketIndex } from "@/types/market";

interface MarketIndexCardProps {
  index: MarketIndex;
}

export function MarketIndexCard({ index }: MarketIndexCardProps) {
  const isUp = index.change > 0;
  const isDown = index.change < 0;

  return (
    <div
      className={cn(
        "card p-4 transition-all duration-200 hover:shadow-md",
        isUp && "hover:border-red-500/30",
        isDown && "hover:border-blue-500/30"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            {index.symbol}
          </p>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
            {index.name}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center justify-center w-8 h-8 rounded-lg",
            isUp && "bg-red-500/10",
            isDown && "bg-blue-500/10",
            !isUp && !isDown && "bg-slate-500/10"
          )}
        >
          {isUp ? (
            <TrendingUp className="w-4 h-4 text-red-500" />
          ) : isDown ? (
            <TrendingDown className="w-4 h-4 text-blue-500" />
          ) : (
            <Minus className="w-4 h-4 text-slate-400" />
          )}
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white font-mono">
          {index.value.toLocaleString("en-US", {
            maximumFractionDigits: 2,
            minimumFractionDigits: index.market === "US" ? 2 : 0,
          })}
        </p>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium font-mono",
              isUp && "text-red-500",
              isDown && "text-blue-500",
              !isUp && !isDown && "text-slate-400"
            )}
          >
            {isUp ? "+" : ""}
            {index.change.toLocaleString("en-US", {
              maximumFractionDigits: 2,
            })}
          </span>
          <span
            className={cn(
              "text-xs px-1.5 py-0.5 rounded font-medium font-mono",
              isUp && "bg-red-500/10 text-red-500",
              isDown && "bg-blue-500/10 text-blue-500",
              !isUp && !isDown && "bg-slate-500/10 text-slate-400"
            )}
          >
            {formatPercent(index.changePercent)}
          </span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <div
          className={cn(
            "h-1 rounded-full overflow-hidden",
            "bg-slate-100 dark:bg-slate-800"
          )}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isUp ? "bg-red-500" : isDown ? "bg-blue-500" : "bg-slate-400"
            )}
            style={{
              width: `${Math.min(Math.abs(index.changePercent) * 20, 100)}%`,
            }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-1.5 text-right">
          {index.market === "KR" ? "한국 시장" : "미국 시장"}
        </p>
      </div>
    </div>
  );
}
