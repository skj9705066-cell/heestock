"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { cn, formatNumber } from "@/lib/utils";
import type { InvestorFlow } from "@/types/market";

interface InvestorTrendProps {
  data: InvestorFlow[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-dark-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-xl text-sm">
      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400">{entry.name}</span>
          <span
            className={cn(
              "font-mono font-medium",
              entry.value > 0 ? "text-red-500" : "text-blue-500"
            )}
          >
            {entry.value > 0 ? "+" : ""}
            {formatNumber(entry.value)}억
          </span>
        </div>
      ))}
    </div>
  );
};

export function InvestorTrend({ data }: InvestorTrendProps) {
  const todayData = data[data.length - 1];

  const summary = [
    {
      label: "외국인",
      value: todayData?.foreign ?? 0,
      color: "text-purple-500",
    },
    {
      label: "기관",
      value: todayData?.institution ?? 0,
      color: "text-amber-500",
    },
    {
      label: "개인",
      value: todayData?.individual ?? 0,
      color: "text-slate-400",
    },
  ];

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title">수급 동향</h3>
        <span className="text-xs text-slate-400">최근 5거래일 (억원)</span>
      </div>

      {/* 오늘 요약 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {summary.map((item) => (
          <div
            key={item.label}
            className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5 text-center"
          >
            <p className="text-xs text-slate-400 mb-1">{item.label}</p>
            <p
              className={cn(
                "text-sm font-bold font-mono",
                item.value > 0 ? "text-red-500" : "text-blue-500"
              )}
            >
              {item.value > 0 ? "+" : ""}
              {formatNumber(item.value)}
            </p>
          </div>
        ))}
      </div>

      {/* 차트 */}
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={10} barGap={2}>
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
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              formatter={(value) => (
                <span style={{ color: "#94a3b8" }}>{value}</span>
              )}
            />
            <Bar dataKey="foreign" name="외국인" fill="#a855f7" radius={[2, 2, 0, 0]} />
            <Bar dataKey="institution" name="기관" fill="#f59e0b" radius={[2, 2, 0, 0]} />
            <Bar dataKey="individual" name="개인" fill="#64748b" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
