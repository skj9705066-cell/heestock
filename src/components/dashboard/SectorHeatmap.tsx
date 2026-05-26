"use client";

import { cn } from "@/lib/utils";
import type { SectorData } from "@/types/market";

interface SectorHeatmapProps {
  sectors: SectorData[];
}

function getHeatmapColor(changePercent: number): string {
  if (changePercent >= 3) return "bg-red-600 text-white";
  if (changePercent >= 2) return "bg-red-500 text-white";
  if (changePercent >= 1) return "bg-red-400 text-white";
  if (changePercent >= 0.5) return "bg-red-300 text-red-900";
  if (changePercent >= 0) return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
  if (changePercent >= -0.5) return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
  if (changePercent >= -1) return "bg-blue-300 text-blue-900";
  if (changePercent >= -2) return "bg-blue-400 text-white";
  if (changePercent >= -3) return "bg-blue-500 text-white";
  return "bg-blue-600 text-white";
}

function getSizeClass(marketCap: number): string {
  if (marketCap >= 500_000_000_000) return "col-span-2 row-span-2";
  if (marketCap >= 200_000_000_000) return "col-span-2";
  if (marketCap >= 100_000_000_000) return "";
  return "";
}

export function SectorHeatmap({ sectors }: SectorHeatmapProps) {
  const sorted = [...sectors].sort((a, b) => b.marketCap - a.marketCap);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title">섹터 히트맵</h3>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span>상승</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span>하락</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 auto-rows-fr" style={{ minHeight: 200 }}>
        {sorted.map((sector) => (
          <div
            key={sector.name}
            className={cn(
              "rounded-lg flex flex-col items-center justify-center p-2 cursor-pointer",
              "transition-all duration-200 hover:opacity-90 hover:scale-[1.02]",
              getHeatmapColor(sector.changePercent),
              getSizeClass(sector.marketCap)
            )}
          >
            <span className="font-semibold text-xs text-center leading-tight">
              {sector.name}
            </span>
            <span className="font-mono text-sm font-bold mt-0.5">
              {sector.changePercent > 0 ? "+" : ""}
              {sector.changePercent.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            상승 {sectors.filter((s) => s.changePercent > 0).length}개
          </span>
          <span>
            하락 {sectors.filter((s) => s.changePercent < 0).length}개
          </span>
        </div>
      </div>
    </div>
  );
}
