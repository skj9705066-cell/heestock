"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Calendar,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/Badge";
import type { StockSnapshot } from "@/lib/stock-snapshot";
import { cn } from "@/lib/utils";

interface Props {
  symbol: string;
  name: string;
  market: "KR" | "US";
}

function pricePrefix(currency: string) {
  return currency === "KRW" ? "" : "$";
}
function priceSuffix(currency: string) {
  return currency === "KRW" ? "원" : "";
}
function fmtPrice(n: number | undefined, currency: string, digits?: number) {
  if (n === undefined || Number.isNaN(n)) return "N/A";
  const d = digits ?? (currency === "KRW" ? 0 : 2);
  return `${pricePrefix(currency)}${n.toLocaleString("ko-KR", { maximumFractionDigits: d })}${priceSuffix(currency)}`;
}
function fmtPct(n: number | undefined) {
  if (n === undefined || Number.isNaN(n)) return "N/A";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
function fmtMcap(n: number | undefined, currency: string) {
  if (!n) return "N/A";
  if (currency === "KRW") {
    if (n >= 1e12) return `${(n / 1e12).toFixed(2)}조원`;
    if (n >= 1e8) return `${Math.round(n / 1e8).toLocaleString("ko-KR")}억원`;
    return n.toLocaleString("ko-KR") + "원";
  }
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}
function fmtFin(n: number | undefined, unit: string) {
  if (n === undefined) return "N/A";
  return `${n.toLocaleString("ko-KR")} ${unit}`;
}

export function StockSnapshotPanel({ symbol, name, market }: Props) {
  const [snap, setSnap] = useState<StockSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSnap(null);

    fetch(
      `/api/stock-snapshot?symbol=${encodeURIComponent(symbol)}&name=${encodeURIComponent(name)}&market=${market}`,
    )
      .then(r => r.json())
      .then((data: StockSnapshot) => {
        if (!cancelled) setSnap(data);
      })
      .catch(() => {
        if (!cancelled) setSnap(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, name, market, reloadKey]);

  if (loading) {
    return (
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-dark-900/50">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <LoadingSpinner size="sm" />
          실시간 데이터 불러오는 중...
        </div>
      </div>
    );
  }

  if (!snap) {
    return (
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-amber-50 dark:bg-amber-900/10 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        실시간 데이터를 불러올 수 없습니다.
      </div>
    );
  }

  const currency = snap.quote?.currency ?? (market === "KR" ? "KRW" : "USD");
  const isUp = (snap.quote?.change ?? 0) >= 0;
  const q = snap.quote;
  const k = snap.keyStats;
  const h = snap.priceHistory;
  const f = snap.financials;

  return (
    <div className="flex-shrink-0 max-h-[44vh] md:max-h-[40vh] overflow-y-auto px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-b from-slate-50 to-white dark:from-dark-900/60 dark:to-transparent">
      {/* Header: date + refresh */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Calendar className="w-3.5 h-3.5" />
          <span>데이터 기준: {snap.asOfDateKr}</span>
          {snap.errors.length > 0 && (
            <Badge variant="yellow" size="sm">일부 데이터 누락</Badge>
          )}
        </div>
        <button
          onClick={() => setReloadKey(k => k + 1)}
          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          title="새로고침"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      {/* Price block */}
      {q ? (
        <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1 mb-3">
          <span className="text-2xl font-bold text-slate-900 dark:text-white">
            {fmtPrice(q.price, currency)}
          </span>
          <span
            className={cn(
              "flex items-center gap-1 text-sm font-semibold",
              isUp ? "text-rose-500" : "text-blue-500",
            )}
          >
            {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {(q.change >= 0 ? "+" : "") + q.change.toLocaleString("ko-KR")}
            {currency === "KRW" ? "원" : ""}
            <span className="ml-1">({fmtPct(q.changePercent)})</span>
          </span>
          {q.pricePosition52w !== undefined && (
            <span className="text-xs text-slate-400">
              52주 밴드 {q.pricePosition52w.toFixed(0)}%
            </span>
          )}
        </div>
      ) : (
        <div className="text-sm text-slate-400 mb-3">시세 정보 없음</div>
      )}

      {/* Metric grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <Metric
          icon={<Activity className="w-3.5 h-3.5" />}
          label="거래량"
          value={q?.volume ? q.volume.toLocaleString("ko-KR") : "N/A"}
        />
        <Metric
          icon={<BarChart3 className="w-3.5 h-3.5" />}
          label="시가총액"
          value={fmtMcap(q?.marketCap, currency)}
        />
        <Metric
          label="52주 최고"
          value={fmtPrice(q?.fiftyTwoWeekHigh, currency)}
        />
        <Metric
          label="52주 최저"
          value={fmtPrice(q?.fiftyTwoWeekLow, currency)}
        />
        <Metric
          label="PER (TTM)"
          value={k?.trailingPE !== undefined ? `${k.trailingPE.toFixed(2)}배` : "N/A"}
        />
        <Metric
          label="PBR"
          value={k?.priceToBook !== undefined ? `${k.priceToBook.toFixed(2)}배` : "N/A"}
        />
        <Metric
          label="ROE"
          value={k?.returnOnEquity !== undefined ? `${k.returnOnEquity.toFixed(2)}%` : "N/A"}
        />
        <Metric
          label="1년 수익률"
          value={fmtPct(h?.return1y)}
          valueClass={
            h?.return1y === undefined ? undefined : h.return1y >= 0 ? "text-rose-500" : "text-blue-500"
          }
        />
      </div>

      {/* Financial block */}
      {f && (f.latestQuarter || f.latestAnnual) && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              최신 재무
            </span>
            <Badge variant={f.source === "DART" ? "blue" : "neutral"} size="sm">
              {f.source}
            </Badge>
            <span className="text-[10px] text-slate-400">단위: {f.unit}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {f.latestQuarter && (
              <FinBlock
                title={`분기 (${f.latestQuarter.period})`}
                row={f.latestQuarter}
                unit={f.unit}
                changeLabel={f.source === "DART" ? "QoQ" : "YoY"}
              />
            )}
            {f.latestAnnual && (
              <FinBlock
                title={`연간 (${f.latestAnnual.period})`}
                row={f.latestAnnual}
                unit={f.unit}
                changeLabel="YoY"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  valueClass,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  const isNA = value === "N/A";
  return (
    <div className="bg-white dark:bg-dark-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 h-[52px] flex flex-col justify-between">
      <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className={cn(
        "text-sm font-semibold truncate",
        isNA ? "text-slate-400" : "text-slate-800 dark:text-slate-100",
        valueClass,
      )}>
        {value}
      </div>
    </div>
  );
}

function FinBlock({
  title,
  row,
  unit,
  changeLabel,
}: {
  title: string;
  row: {
    revenue?: number;
    operatingIncome?: number;
    netIncome?: number;
    revenueYoY?: number;
    operatingIncomeYoY?: number;
    netIncomeYoY?: number;
    operatingMargin?: number;
    netMargin?: number;
  };
  unit: string;
  changeLabel: string;
}) {
  return (
    <div className="bg-white dark:bg-dark-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider">{title}</span>
        <span className="text-[9px] text-slate-400 font-mono">{changeLabel}</span>
      </div>
      <FinRow label="매출액" v={row.revenue} unit={unit} yoy={row.revenueYoY} />
      <FinRow
        label="영업이익"
        v={row.operatingIncome}
        unit={unit}
        yoy={row.operatingIncomeYoY}
        margin={row.operatingMargin}
      />
      <FinRow
        label="순이익"
        v={row.netIncome}
        unit={unit}
        yoy={row.netIncomeYoY}
        margin={row.netMargin}
      />
    </div>
  );
}

function FinRow({
  label,
  v,
  unit,
  yoy,
  margin,
}: {
  label: string;
  v?: number;
  unit: string;
  yoy?: number;
  margin?: number;
}) {
  return (
    <div className="flex items-baseline gap-2 justify-between">
      <span className="text-slate-400 text-[11px] w-12 flex-shrink-0">{label}</span>
      <span className="font-semibold text-slate-700 dark:text-slate-200 text-[11px] flex-1 text-right">
        {v === undefined ? "-" : `${v.toLocaleString("ko-KR")} ${unit}`}
        {margin !== undefined && v !== undefined && (
          <span className="ml-1 text-slate-400">({margin.toFixed(1)}%)</span>
        )}
        {yoy !== undefined && (
          <span className={cn("ml-1", yoy >= 0 ? "text-rose-500" : "text-blue-500")}>
            {yoy >= 0 ? "+" : ""}{yoy.toFixed(1)}%
          </span>
        )}
      </span>
    </div>
  );
}
