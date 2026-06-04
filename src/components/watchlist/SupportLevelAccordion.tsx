"use client";

import { SupportLevel, scoreLabel, scoreColor } from "@/lib/support-levels";
import { cn } from "@/lib/utils";

interface Props {
  levels:       SupportLevel[];
  currentPrice: number;
  market:       "KR" | "US";
}

function fmt(price: number, market: "KR" | "US") {
  return market === "KR"
    ? price.toLocaleString("ko-KR") + "원"
    : "$" + price.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export function SupportLevelAccordion({ levels, currentPrice, market }: Props) {
  if (!levels.length) {
    return (
      <p className="text-xs text-slate-400 text-center py-4">
        지지선 데이터가 부족합니다 (120일 이상 데이터 필요)
      </p>
    );
  }

  const distPct = (price: number) =>
    (((currentPrice - price) / price) * 100).toFixed(1);

  return (
    <div className="space-y-3 mt-3">
      {levels.map((lvl, i) => (
        <div
          key={i}
          className={cn(
            "rounded-lg p-3 border text-xs",
            lvl.score >= 3
              ? "border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10"
              : lvl.score === 2
              ? "border-yellow-200 dark:border-yellow-900/50 bg-yellow-50/50 dark:bg-yellow-900/10"
              : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <span className={cn("font-bold text-sm", scoreColor(lvl.score))}>
              {scoreLabel(lvl.score)}: {fmt(lvl.price, market)}
            </span>
            <span className="text-slate-400 tabular-nums">
              현재가 ↑ {distPct(lvl.price)}%
            </span>
          </div>

          {/* Reasons */}
          <div className="space-y-1">
            <ReasonRow
              active={!!lvl.reasons.historicalLows}
              label={
                lvl.reasons.historicalLows
                  ? `과거 저점 ${lvl.reasons.historicalLows.count}회 (${lvl.reasons.historicalLows.dates.slice(0, 2).join(", ")})`
                  : "과거 저점 클러스터 미해당"
              }
            />
            <ReasonRow
              active={!!lvl.reasons.movingAverage}
              label={
                lvl.reasons.movingAverage
                  ? `${lvl.reasons.movingAverage.period}일 이동평균선 근처 (${fmt(lvl.reasons.movingAverage.value, market)})`
                  : "이동평균선 미해당"
              }
            />
            <ReasonRow
              active={!!lvl.reasons.fibonacci}
              label={
                lvl.reasons.fibonacci
                  ? `피보나치 ${lvl.reasons.fibonacci.label} 구간`
                  : "피보나치 되돌림 미해당"
              }
            />
            <ReasonRow
              active={!!lvl.reasons.volumeConcentration}
              label={
                lvl.reasons.volumeConcentration
                  ? `거래량 집중 구간 (${lvl.reasons.volumeConcentration.date})`
                  : "거래량 집중 미해당"
              }
            />
          </div>

          {/* Score */}
          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <span className="text-slate-500">강도 점수: </span>
            <span className={cn("font-bold", scoreColor(lvl.score))}>
              {lvl.score}/4
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReasonRow({ active, label }: { active: boolean; label: string }) {
  return (
    <div className={cn("flex items-start gap-1.5", active ? "text-slate-700 dark:text-slate-200" : "text-slate-400")}>
      <span className="shrink-0 mt-0.5">{active ? "✅" : "❌"}</span>
      <span>{label}</span>
    </div>
  );
}
