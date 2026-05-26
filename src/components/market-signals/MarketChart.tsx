"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { ADRData } from "@/types/market";

interface MarketChartProps {
  data: ADRData[];
  title: string;
  dataKey: keyof ADRData;
  color?: string;
  referenceValue?: number;
  referenceLabel?: string;
  valueFormatter?: (v: number) => string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-dark-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-xl text-sm">
      <p className="font-medium text-slate-500 mb-1">{label}</p>
      <p className="font-bold text-slate-900 dark:text-white font-mono">
        {payload[0].value?.toFixed(2)}
      </p>
    </div>
  );
};

export function MarketChart({
  data,
  title,
  dataKey,
  color = "#3b82f6",
  referenceValue,
  referenceLabel,
  valueFormatter,
}: MarketChartProps) {
  return (
    <div className="card p-5">
      <h3 className="section-title text-base mb-4">{title}</h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
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
              tickFormatter={valueFormatter}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            {referenceValue !== undefined && (
              <ReferenceLine
                y={referenceValue}
                stroke="#64748b"
                strokeDasharray="4 4"
                label={{
                  value: referenceLabel ?? String(referenceValue),
                  fontSize: 10,
                  fill: "#94a3b8",
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey={dataKey as string}
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${dataKey})`}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
