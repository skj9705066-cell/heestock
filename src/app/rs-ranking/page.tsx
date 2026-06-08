"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/Badge";
import { cn, formatPercent } from "@/lib/utils";
import { CheckCircle2, XCircle, Info, RefreshCw } from "lucide-react";
import type { RSRankingEntry } from "@/types/stock";

type Period = "rs1m" | "rs3m" | "rs6m" | "rs12m" | "rsComposite";
type Market = "ALL" | "KR" | "US";

const periodLabels: Record<Period, string> = {
  rs1m: "1개월", rs3m: "3개월", rs6m: "6개월", rs12m: "12개월", rsComposite: "종합",
};

function RSBar({ value }: { value: number }) {
  const color =
    value >= 90 ? "bg-red-500" :
    value >= 70 ? "bg-orange-400" :
    value >= 50 ? "bg-yellow-400" :
    "bg-slate-300 dark:bg-slate-600";

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">{value}</span>
    </div>
  );
}

export default function RSRankingPage() {
  const [data,        setData]        = useState<RSRankingEntry[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(false);
  const [sortBy,      setSortBy]      = useState<Period>("rsComposite");
  const [market,      setMarket]      = useState<Market>("ALL");
  const [showMTTOnly, setShowMTTOnly] = useState(false);
  const [fetchedAt,   setFetchedAt]   = useState<Date | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/rs-ranking");
      if (!res.ok) throw new Error("API error");
      const json = await res.json() as RSRankingEntry[];
      setData(json);
      setFetchedAt(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  let displayed = [...data];
  if (market !== "ALL")   displayed = displayed.filter(s => s.market === market);
  if (showMTTOnly)        displayed = displayed.filter(s => s.mttMeets);
  displayed.sort((a, b) => b[sortBy] - a[sortBy]);
  displayed = displayed.map((s, i) => ({ ...s, rank: i + 1 }));

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">RS 순위</h1>
          <p className="text-sm text-slate-400 mt-1">
            상대강도(Relative Strength) · 실제 Yahoo Finance 1년 가격 데이터 기반
          </p>
        </div>
        <div className="flex items-center gap-2">
          {fetchedAt && (
            <span className="text-xs text-slate-400">
              {fetchedAt.toLocaleTimeString("ko-KR", {
                hour: "2-digit", minute: "2-digit",
                timeZone: "Asia/Seoul",
              })} 기준
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4 text-slate-400", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1.5">
          {(["ALL","KR","US"] as Market[]).map(m => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                market === m
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
              )}
            >
              {m === "ALL" ? "전체" : m}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5">
          {(Object.entries(periodLabels) as [Period, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                sortBy === key
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowMTTOnly(!showMTTOnly)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
            showMTTOnly
              ? "bg-purple-600 text-white"
              : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
          )}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          MTT 충족만
        </button>
      </div>

      {/* MTT Info */}
      <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-semibold text-blue-700 dark:text-blue-300">MTT (Minervini Template): </span>
          <span className="text-blue-600 dark:text-blue-400">
            50/150/200일 이평 배열 · 200일선 상승추세 · 52주 저가 +30% 이상 · 52주 고가 -25% 이내 · RS 70 이상
          </span>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="card p-8 text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Yahoo Finance에서 1년 가격 데이터 수집 중...</p>
          <p className="text-xs text-slate-400 mt-1">{Object.keys({}).length}개 종목 처리 중, 잠시만 기다려 주세요</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="card p-8 text-center">
          <p className="text-sm text-slate-500">데이터를 불러오지 못했습니다.</p>
          <button onClick={fetchData} className="mt-3 text-xs text-blue-500 hover:underline">재시도</button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && displayed.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr className="text-xs text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-left font-semibold">#</th>
                  <th className="px-4 py-3 text-left font-semibold">종목</th>
                  <th className="px-4 py-3 text-right font-semibold">현재가</th>
                  <th className="px-4 py-3 text-right font-semibold">등락률</th>
                  <th className="px-4 py-3 text-center font-semibold">1개월</th>
                  <th className="px-4 py-3 text-center font-semibold">3개월</th>
                  <th className="px-4 py-3 text-center font-semibold">6개월</th>
                  <th className="px-4 py-3 text-center font-semibold">12개월</th>
                  <th className="px-4 py-3 text-center font-semibold">종합 RS</th>
                  <th className="px-4 py-3 text-center font-semibold">MTT</th>
                  <th className="px-4 py-3 text-center font-semibold">Stage</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(stock => (
                  <tr key={`${stock.market}-${stock.symbol}`} className="table-row">
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{stock.rank}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={stock.market === "KR" ? "yellow" : "blue"} size="sm">
                          {stock.market}
                        </Badge>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{stock.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{stock.symbol} · {stock.sector}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {stock.market === "KR"
                        ? stock.price.toLocaleString() + "원"
                        : "$" + stock.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn("font-mono font-medium", stock.changePercent > 0 ? "text-red-500" : "text-blue-500")}>
                        {formatPercent(stock.changePercent)}
                      </span>
                    </td>
                    <td className="px-4 py-3"><RSBar value={stock.rs1m}  /></td>
                    <td className="px-4 py-3"><RSBar value={stock.rs3m}  /></td>
                    <td className="px-4 py-3"><RSBar value={stock.rs6m}  /></td>
                    <td className="px-4 py-3"><RSBar value={stock.rs12m} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <span className={cn(
                          "text-sm font-bold font-mono px-2 py-0.5 rounded",
                          stock.rsComposite >= 90
                            ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                            : stock.rsComposite >= 70
                            ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500",
                        )}>
                          {stock.rsComposite}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {stock.mttMeets
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                        : <XCircle     className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded",
                        stock.stage === 2
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400",
                      )}>
                        {stock.stage}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>총 {displayed.length}개 종목 · 15분 캐시</span>
            <span>RS 기준: {periodLabels[sortBy]} 정렬</span>
          </div>
        </div>
      )}

      {!loading && !error && displayed.length === 0 && data.length > 0 && (
        <div className="card p-8 text-center text-sm text-slate-500">
          필터 조건에 맞는 종목이 없습니다.
        </div>
      )}
    </div>
  );
}
