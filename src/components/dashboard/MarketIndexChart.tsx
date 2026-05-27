"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BarChart, Bar, Cell,
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { RefreshCw, BarChart2, Activity, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type { OHLCVPoint } from "@/app/api/chart-data/route";

// ── Config ───────────────────────────────────────────────────────────────────

const INDICES = [
  { label: "코스피",  symbol: "^KS11",  market: "KR", baseColor: "#ef4444" },
  { label: "코스닥",  symbol: "^KQ11",  market: "KR", baseColor: "#f97316" },
  { label: "S&P500", symbol: "^GSPC",  market: "US", baseColor: "#3b82f6" },
  { label: "나스닥",  symbol: "^IXIC",  market: "US", baseColor: "#8b5cf6" },
] as const;

const PERIOD_OPTIONS = [
  { label: "일봉", interval: "1d",  range: "6mo",  dateFormat: (d: string) => d },
  { label: "주봉", interval: "1wk", range: "2y",   dateFormat: (d: string) => d },
  { label: "월봉", interval: "1mo", range: "5y",   dateFormat: (d: string) => d },
] as const;

const REFRESH_OPTIONS = [
  { label: "1분",  ms: 60_000  },
  { label: "5분",  ms: 300_000 },
  { label: "15분", ms: 900_000 },
  { label: "없음", ms: 0       },
] as const;

// ── Candle transform ─────────────────────────────────────────────────────────

interface CandlePoint extends OHLCVPoint {
  isUp: boolean;
  base: number;
  lowerWick: number;
  body: number;
  upperWick: number;
}

function toCandlePoints(raw: OHLCVPoint[]): {
  points: CandlePoint[];
  minPrice: number;
  maxRelative: number;
} {
  if (raw.length === 0) return { points: [], minPrice: 0, maxRelative: 0 };

  const allLow  = raw.map(d => d.low);
  const allHigh = raw.map(d => d.high);
  const dataMin = Math.min(...allLow);
  const dataMax = Math.max(...allHigh);
  const pad     = (dataMax - dataMin) * 0.03;
  const minPrice = dataMin - pad;
  const minBody  = (dataMax - dataMin) * 0.0008;

  const points: CandlePoint[] = raw.map(d => {
    const isUp      = d.close >= d.open;
    const bodyBottom = Math.min(d.open, d.close);
    const bodyTop    = Math.max(d.open, d.close);
    return {
      ...d,
      isUp,
      base:       d.low - minPrice,
      lowerWick:  bodyBottom - d.low,
      body:       Math.max(bodyTop - bodyBottom, minBody),
      upperWick:  d.high - bodyTop,
    };
  });

  return {
    points,
    minPrice,
    maxRelative: dataMax - minPrice + pad,
  };
}

// ── Custom recharts shapes ────────────────────────────────────────────────────

const WickShape = (props: {
  x?: number; y?: number; width?: number; height?: number; fill?: string;
}) => {
  const { x = 0, y = 0, width = 0, height = 0, fill = "#ef4444" } = props;
  if (height <= 0) return null;
  const cx = x + width / 2;
  return <rect x={cx - 0.8} y={y} width={1.6} height={height} fill={fill} />;
};

const BodyShape = (props: {
  x?: number; y?: number; width?: number; height?: number; fill?: string;
}) => {
  const { x = 0, y = 0, width = 0, height = 0, fill = "#ef4444" } = props;
  const w = Math.max(width * 0.6, 2);
  return (
    <rect
      x={x + (width - w) / 2}
      y={y}
      width={w}
      height={Math.max(height, 1)}
      fill={fill}
    />
  );
};

// ── Tooltip ───────────────────────────────────────────────────────────────────

const CandleTooltip = ({
  active,
  payload,
  minPrice,
}: {
  active?: boolean;
  payload?: { payload: CandlePoint }[];
  minPrice: number;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const pct = d.open > 0
    ? (((d.close - d.open) / d.open) * 100).toFixed(2)
    : "0.00";
  const isUp = d.close >= d.open;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-2xl text-xs min-w-[140px]">
      <p className="font-semibold text-slate-500 dark:text-slate-400 mb-2">{d.date}</p>
      <div className="space-y-1 font-mono">
        {[
          ["시가", d.open],
          ["고가", d.high],
          ["저가", d.low],
        ].map(([label, val]) => (
          <div key={String(label)} className="flex justify-between gap-4">
            <span className="text-slate-400">{label}</span>
            <span className="text-slate-700 dark:text-slate-300">
              {(val as number).toLocaleString()}
            </span>
          </div>
        ))}
        <div className="flex justify-between gap-4 pt-1 border-t border-slate-100 dark:border-slate-700">
          <span className="text-slate-400">종가</span>
          <span className={cn("font-bold", isUp ? "text-red-500" : "text-blue-500")}>
            {d.close.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">등락</span>
          <span className={cn("font-bold", isUp ? "text-red-500" : "text-blue-500")}>
            {isUp ? "+" : ""}{pct}%
          </span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t border-slate-100 dark:border-slate-700">
          <span className="text-slate-400">거래량</span>
          <span className="text-slate-500">{fmtVol(d.volume)}</span>
        </div>
      </div>
    </div>
  );
};

const LineTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: OHLCVPoint }[];
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-2xl text-xs">
      <p className="font-semibold text-slate-500 dark:text-slate-400 mb-1">{d.date}</p>
      <p className="font-mono font-bold text-slate-800 dark:text-slate-100 text-sm">
        {d.close.toLocaleString()}
      </p>
      <p className="text-slate-400 font-mono mt-0.5">Vol {fmtVol(d.volume)}</p>
    </div>
  );
};

const VolumeTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number; payload: OHLCVPoint }[];
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <span className="text-slate-400">거래량 </span>
      <span className="font-mono text-slate-700 dark:text-slate-300">
        {fmtVol(payload[0].value)}
      </span>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtVol(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(v);
}

function xTickInterval(len: number): number {
  return Math.max(Math.floor(len / 7), 1);
}

// ── Main component ────────────────────────────────────────────────────────────

export function MarketIndexChart() {
  const [idxTab,      setIdxTab]      = useState(0);
  const [periodIdx,   setPeriodIdx]   = useState(0);
  const [chartType,   setChartType]   = useState<"candle" | "line">("candle");
  const [refreshIdx,  setRefreshIdx]  = useState(1);
  const [rawData,     setRawData]     = useState<OHLCVPoint[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [noData,      setNoData]      = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentIndex  = INDICES[idxTab];
  const currentPeriod = PERIOD_OPTIONS[periodIdx];

  const fetchData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    try {
      const res = await fetch(
        `/api/chart-data?symbol=${encodeURIComponent(currentIndex.symbol)}` +
        `&interval=${currentPeriod.interval}&range=${currentPeriod.range}`,
      );
      const data: OHLCVPoint[] = await res.json();
      setRawData(data);
      setNoData(res.headers.get("X-No-Data") === "true" || data.length === 0);
      setLastUpdated(new Date());
    } catch {
      // keep existing data on error
    } finally {
      setIsLoading(false);
    }
  }, [currentIndex.symbol, currentPeriod.interval, currentPeriod.range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const ms = REFRESH_OPTIONS[refreshIdx].ms;
    if (ms > 0) timerRef.current = setInterval(() => fetchData(false), ms);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchData, refreshIdx]);

  // ── Derived data ──
  const { points: candleData, minPrice, maxRelative } = toCandlePoints(rawData);

  const last = rawData.at(-1);
  const prev = rawData.at(-2);
  const priceChange = last && prev ? last.close - prev.close : 0;
  const pctChange   = prev ? (priceChange / prev.close) * 100 : 0;
  const isUp        = priceChange >= 0;

  const tickGap     = xTickInterval(rawData.length);
  const yAxisWidth  = 68;

  const upColor   = "#ef4444";
  const downColor = "#3b82f6";
  const lineColor = isUp ? upColor : downColor;

  return (
    <div className="card p-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="section-title">시장 지수 차트</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="w-3 h-3 text-slate-400" />
            <span className="text-xs text-slate-400">
              {lastUpdated
                ? lastUpdated.toLocaleTimeString("ko-KR")
                : "로딩 중..."}
            </span>
            {noData && !isLoading && (
              <span className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">
                데이터 없음
              </span>
            )}
          </div>
        </div>

        {last && !isLoading && (
          <div className="text-right">
            <p className={cn("text-2xl font-bold font-mono", isUp ? "text-red-500" : "text-blue-500")}>
              {last.close.toLocaleString()}
            </p>
            <p className={cn("text-sm font-mono", isUp ? "text-red-400" : "text-blue-400")}>
              {isUp ? "+" : ""}{priceChange.toFixed(2)}&nbsp;
              ({isUp ? "+" : ""}{pctChange.toFixed(2)}%)
            </p>
          </div>
        )}
      </div>

      {/* ── Index Tabs ── */}
      <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-800 mb-4">
        {INDICES.map((idx, i) => (
          <button
            key={idx.symbol}
            onClick={() => setIdxTab(i)}
            className={cn(
              "px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              idxTab === i
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
            )}
          >
            {idx.label}
            <span className={cn(
              "ml-1.5 text-[10px] font-semibold px-1 py-0.5 rounded",
              idx.market === "KR"
                ? "bg-orange-100 dark:bg-orange-900/30 text-orange-500"
                : "bg-blue-100 dark:bg-blue-900/30 text-blue-500",
            )}>
              {idx.market}
            </span>
          </button>
        ))}
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Period */}
        <div className="flex gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
          {PERIOD_OPTIONS.map((p, i) => (
            <button
              key={p.interval}
              onClick={() => setPeriodIdx(i)}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                periodIdx === i
                  ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Chart Type */}
        <div className="flex gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
          {(["candle", "line"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all",
                chartType === type
                  ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
              )}
            >
              {type === "candle"
                ? <><BarChart2 className="w-3.5 h-3.5" /> 캔들</>
                : <><Activity  className="w-3.5 h-3.5" /> 라인</>}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => fetchData()}
            disabled={isLoading}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
            title="새로고침"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 text-slate-400", isLoading && "animate-spin")} />
          </button>

          <div className="flex gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
            {REFRESH_OPTIONS.map((r, i) => (
              <button
                key={r.label}
                onClick={() => setRefreshIdx(i)}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                  refreshIdx === i
                    ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Charts ── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-72">
          <div className="flex flex-col items-center gap-2">
            <LoadingSpinner size="lg" />
            <p className="text-xs text-slate-400">차트 데이터 로딩 중...</p>
          </div>
        </div>
      ) : noData ? (
        <div className="flex items-center justify-center h-72">
          <div className="flex flex-col items-center gap-3 text-center max-w-sm">
            <AlertCircle className="w-10 h-10 text-slate-300 dark:text-slate-600" />
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                차트 데이터를 불러올 수 없습니다
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Yahoo Finance · Alpha Vantage API 호출 실패 — 잠시 후 새로고침을 시도해주세요
              </p>
            </div>
            <button
              onClick={() => fetchData()}
              className="mt-1 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> 다시 시도
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Price chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "candle" ? (
                <BarChart
                  data={candleData}
                  barCategoryGap="20%"
                  margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    interval={tickGap - 1}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    width={yAxisWidth}
                    domain={[0, maxRelative]}
                    tickFormatter={(v) => (v + minPrice).toLocaleString()}
                    tickCount={6}
                  />
                  <Tooltip
                    content={<CandleTooltip minPrice={minPrice} />}
                    cursor={{ fill: "rgba(148,163,184,0.06)" }}
                  />
                  {/* invisible base */}
                  <Bar dataKey="base" stackId="c" fill="transparent" stroke="none" isAnimationActive={false} legendType="none" />
                  {/* lower wick */}
                  <Bar dataKey="lowerWick" stackId="c" shape={<WickShape />} isAnimationActive={false} legendType="none">
                    {candleData.map((d, i) => (
                      <Cell key={i} fill={d.isUp ? upColor : downColor} />
                    ))}
                  </Bar>
                  {/* body */}
                  <Bar dataKey="body" stackId="c" shape={<BodyShape />} isAnimationActive={false} legendType="none">
                    {candleData.map((d, i) => (
                      <Cell key={i} fill={d.isUp ? upColor : downColor} />
                    ))}
                  </Bar>
                  {/* upper wick */}
                  <Bar dataKey="upperWick" stackId="c" shape={<WickShape />} isAnimationActive={false} legendType="none">
                    {candleData.map((d, i) => (
                      <Cell key={i} fill={d.isUp ? upColor : downColor} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <AreaChart
                  data={rawData}
                  margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id={`areaGrad-${idxTab}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={lineColor} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={lineColor} stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    interval={tickGap - 1}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    width={yAxisWidth}
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => v.toLocaleString()}
                    tickCount={6}
                  />
                  <Tooltip content={<LineTooltip />} cursor={{ stroke: lineColor, strokeWidth: 1, strokeDasharray: "4 2" }} />
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke={lineColor}
                    strokeWidth={1.8}
                    fill={`url(#areaGrad-${idxTab})`}
                    dot={false}
                    activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Volume chart */}
          <div className="h-20 mt-1 border-t border-slate-100 dark:border-slate-800 pt-1">
            <p className="text-[10px] text-slate-400 mb-0.5 pl-1">거래량</p>
            <div className="h-14">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={rawData}
                  barCategoryGap="20%"
                  margin={{ top: 0, right: 4, left: 0, bottom: 0 }}
                >
                  <XAxis dataKey="date" hide />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    width={yAxisWidth}
                    tickFormatter={fmtVol}
                    tickCount={3}
                  />
                  <Tooltip content={<VolumeTooltip />} cursor={{ fill: "rgba(148,163,184,0.06)" }} />
                  <Bar dataKey="volume" isAnimationActive={false} radius={[1, 1, 0, 0]}>
                    {rawData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.close >= d.open
                          ? "rgba(239,68,68,0.45)"
                          : "rgba(59,130,246,0.45)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
            <span>{rawData.length}개 봉 · Yahoo Finance{process.env.NEXT_PUBLIC_AV_KEY ? " + Alpha Vantage" : ""}</span>
            <span>자동갱신 {REFRESH_OPTIONS[refreshIdx].label}</span>
          </div>
        </>
      )}
    </div>
  );
}
