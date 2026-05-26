"use client";

import { useState, useEffect } from "react";
import { SignalLight }  from "@/components/market-signals/SignalLight";
import { MarketChart }  from "@/components/market-signals/MarketChart";
import { Badge }        from "@/components/ui/Badge";
import { cn }           from "@/lib/utils";
import { TrendingUp, Star, Zap, RefreshCw, TrendingDown } from "lucide-react";
import type { MarketSignal, ADRData } from "@/types/market";

interface SignalData {
  signals:           MarketSignal[];
  adrHistory:        ADRData[];
  leaderSectors:     { name: string; leader: string; change: number }[];
  fiftyTwoWeekHighs: { symbol: string; name: string; price: number; market: "KR" | "US"; changePercent: number }[];
  breakthroughList:  { symbol: string; name: string; price: number; changePercent: number; volume: number; market: "KR" | "US"; action: string }[];
}

export default function MarketSignalsPage() {
  const [data,      setData]      = useState<SignalData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(false);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/market-signals");
      if (!res.ok) throw new Error("API error");
      setData(await res.json() as SignalData);
      setFetchedAt(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Assign RS scores to leader sectors (rank-based, highest change = highest RS proxy)
  const leaderSectors = (data?.leaderSectors ?? []).map((s, i, arr) => ({
    ...s,
    rs: Math.round(95 - (i / Math.max(arr.length - 1, 1)) * 30),
  }));

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">시장 신호등</h1>
          <p className="text-sm text-slate-400 mt-1">
            추세추종 기반 시장 신호 · Yahoo Finance 실데이터
          </p>
        </div>
        <div className="flex items-center gap-2">
          {fetchedAt && (
            <span className="text-xs text-slate-400">
              {fetchedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준
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

      {loading && (
        <div className="card p-8 text-center">
          <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
          <p className="text-sm text-slate-500">시장 신호 데이터 수집 중...</p>
        </div>
      )}

      {error && !loading && (
        <div className="card p-8 text-center">
          <p className="text-sm text-slate-500">데이터를 불러오지 못했습니다.</p>
          <button onClick={fetchData} className="mt-3 text-xs text-blue-500 hover:underline">재시도</button>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Signal Lights */}
          <section>
            <h2 className="section-title mb-3">시장 신호</h2>
            <div className="grid grid-cols-2 md:grid-cols-2 gap-4 max-w-sm">
              {data.signals.map(s => <SignalLight key={s.type} signal={s} />)}
            </div>
          </section>

          {/* Market Charts */}
          <section>
            <h2 className="section-title mb-3">시장 지표</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MarketChart
                data={data.adrHistory}
                title="ADR (등락비율) — 풀 종목 기준"
                dataKey="adr"
                color="#10b981"
                referenceValue={1.0}
                referenceLabel="기준선 1.0"
              />
              <MarketChart
                data={data.adrHistory.map(d => ({
                  ...d,
                  adr: d.advancers / Math.max(d.decliners, 1),
                }))}
                title="상승/하락 비율"
                dataKey="adr"
                color="#a855f7"
                referenceValue={1.0}
                referenceLabel="균형선"
              />
            </div>
          </section>

          {/* Leader Sectors & 52w Highs */}
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Leading Sectors */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-4 h-4 text-amber-400" />
                <h2 className="section-title">주도 섹터 (오늘 등락률 기준)</h2>
              </div>
              <div className="space-y-3">
                {leaderSectors.map((sector, i) => (
                  <div key={sector.name} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-300 dark:text-slate-600 w-4">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{sector.name}</span>
                          <span className="text-xs text-slate-400">({sector.leader})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={sector.change > 0 ? "text-xs text-red-500 font-mono" : "text-xs text-blue-500 font-mono"}>
                            {sector.change > 0 ? "+" : ""}{sector.change}%
                          </span>
                          <span className="text-xs font-bold text-emerald-500">RS {sector.rs}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                          style={{ width: `${sector.rs}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {leaderSectors.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">섹터 데이터 없음</p>
                )}
              </div>
            </div>

            {/* 52w Highs */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-red-500" />
                <h2 className="section-title">52주 신고가 근접 종목 (97% 이상)</h2>
              </div>
              <div className="space-y-2">
                {data.fiftyTwoWeekHighs.map(stock => (
                  <div key={stock.symbol} className="flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant={stock.market === "KR" ? "yellow" : "blue"} size="sm">
                        {stock.market}
                      </Badge>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{stock.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{stock.symbol}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                        {stock.price.toLocaleString()}원
                      </p>
                      <p className={cn("text-xs font-bold font-mono", stock.changePercent >= 0 ? "text-red-500" : "text-blue-500")}>
                        {stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                ))}
                {data.fiftyTwoWeekHighs.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">해당 종목 없음</p>
                )}
              </div>
            </div>
          </section>

          {/* Breakthrough List */}
          <section className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-yellow-400" />
              <h2 className="section-title">돌파 리스트 (±3% 이상 급변동)</h2>
              <Badge variant="yellow">실시간 · 거래량 포함</Badge>
            </div>
            {data.breakthroughList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      <th className="pb-2 text-left font-medium">종목</th>
                      <th className="pb-2 text-right font-medium">현재가</th>
                      <th className="pb-2 text-right font-medium">등락률</th>
                      <th className="pb-2 text-right font-medium">거래량</th>
                      <th className="pb-2 text-left font-medium pl-4">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.breakthroughList.map(stock => (
                      <tr key={stock.symbol} className="table-row">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <Badge variant={stock.market === "KR" ? "yellow" : "blue"} size="sm">
                              {stock.market}
                            </Badge>
                            <div>
                              <p className="font-semibold text-slate-800 dark:text-slate-200">{stock.name}</p>
                              <p className="text-xs text-slate-400 font-mono">{stock.symbol}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {stock.price.toLocaleString()}원
                        </td>
                        <td className="py-3 text-right">
                          <span className={cn("font-mono font-medium", stock.changePercent >= 0 ? "text-red-500" : "text-blue-500")}>
                            {stock.changePercent >= 0 ? <TrendingUp className="inline w-3 h-3 mr-0.5" /> : <TrendingDown className="inline w-3 h-3 mr-0.5" />}
                            {stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-3 text-right text-slate-600 dark:text-slate-400 font-mono">
                          {stock.volume > 1_000_000
                            ? (stock.volume / 1_000_000).toFixed(1) + "M"
                            : (stock.volume / 1_000).toFixed(0) + "K"}
                        </td>
                        <td className="py-3 pl-4">
                          <span className="text-xs px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-md border border-amber-200 dark:border-amber-800">
                            {stock.action}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">±3% 이상 변동 종목 없음</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
