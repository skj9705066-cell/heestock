"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import type { MarketVolumePoint } from "@/types/market";

interface Props {
  data: MarketVolumePoint[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-dark-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-xl text-sm">
      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">{label}</p>
      <p className="font-mono font-bold text-blue-500">
        {formatNumber(payload[0].value)}억원
      </p>
    </div>
  );
};

// Renamed conceptually to MarketVolumeTrend but kept the InvestorTrend export
// name so existing imports / route references in src/app/page.tsx and the
// dashboard skeleton don't break in this refactor.
export function InvestorTrend({ data }: Props) {
  const today     = data[data.length - 1];
  const yesterday = data[data.length - 2];
  const change    = today && yesterday && yesterday.value > 0
    ? ((today.value - yesterday.value) / yesterday.value) * 100
    : null;
  const up = (change ?? 0) >= 0;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="section-title">코스피 거래대금 추이</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">주요 31개 종목 합산 · 최근 5거래일</p>
        </div>
        <span className="text-xs text-slate-400">단위: 억원</span>
      </div>

      {/* Today summary */}
      {today ? (
        <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg flex items-baseline justify-between gap-3">
          <div>
            <p className="text-[11px] text-slate-400 mb-0.5">최근일 ({today.date})</p>
            <p className="text-lg font-bold font-mono text-slate-900 dark:text-white">
              {formatNumber(today.value)}억원
            </p>
          </div>
          {change !== null && (
            <span className={cn(
              "inline-flex items-center gap-1 text-xs font-mono font-medium",
              up ? "text-red-500" : "text-blue-500",
            )}>
              {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {up ? "+" : ""}{change.toFixed(1)}% 전일대비
            </span>
          )}
        </div>
      ) : (
        <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-sm text-slate-400 text-center">
          거래대금 데이터 없음
        </div>
      )}

      {/* Bar chart */}
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#334155"
              opacity={0.3}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatNumber(v)}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#94a3b820" }} />
            <Bar
              dataKey="value"
              name="거래대금"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
