"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge }       from "@/components/ui/Badge";
import { Sparkles, TrendingUp, Info, RefreshCw, Search, X } from "lucide-react";
import { cn }          from "@/lib/utils";
import type { ValuationData } from "@/types/stock";

interface ExtValuation extends ValuationData {
  market:    "KR" | "US";
  price:     number;
  marketCap?: number;
}

function MetricCell({ value, label, isAI, benchmark, good }: {
  value?:     number;
  label:      string;
  isAI?:      boolean;
  benchmark?: number;
  good?:      "low" | "high";
}) {
  const isGood = value !== undefined && benchmark !== undefined
    ? good === "low" ? value < benchmark : value > benchmark
    : null;
  return (
    <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <div className="flex items-center justify-center gap-1">
        {value !== undefined ? (
          <span className={cn(
            "text-lg font-bold font-mono",
            isGood === true  && "text-emerald-500",
            isGood === false && "text-red-500",
            isGood === null  && "text-slate-800 dark:text-slate-200",
          )}>
            {value.toFixed(1)}
          </span>
        ) : (
          <span className="text-sm text-slate-400">-</span>
        )}
        {isAI && <Sparkles className="w-3 h-3 text-blue-400" aria-label="AI 추정치" />}
      </div>
    </div>
  );
}

const DEFAULT_SYMBOLS = ["005930", "000660", "NVDA", "035720", "005380", "MSFT"];

export default function ValuationPage() {
  const [data,      setData]      = useState<ExtValuation[]>([]);
  const [selected,  setSelected]  = useState<ExtValuation | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(false);
  const [search,    setSearch]    = useState("");
  const [results,   setResults]   = useState<{ symbol: string; name: string; market: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  // Load default stocks
  const loadDefaults = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const res = await fetch(`/api/valuation?symbols=${DEFAULT_SYMBOLS.join(",")}`);
      if (!res.ok) throw new Error("API error");
      const json = await res.json() as ExtValuation[];
      setData(json);
      if (json.length > 0 && !selected) setSelected(json[0]);
      setFetchedAt(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => { loadDefaults(); }, [loadDefaults]);

  // Search stocks
  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/stock-search?q=${encodeURIComponent(search)}`);
        setResults(await res.json() as { symbol: string; name: string; market: string }[]);
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const addStock = async (sym: string, name: string) => {
    setSearch(""); setResults([]);
    // Check if already loaded
    const already = data.find(d => d.symbol === sym);
    if (already) { setSelected(already); return; }
    try {
      const res  = await fetch(`/api/valuation?symbols=${sym}`);
      const json = await res.json() as ExtValuation[];
      if (json.length > 0) {
        setData(prev => [...prev, ...json.filter(j => !prev.some(p => p.symbol === j.symbol))]);
        setSelected(json[0]);
      }
    } catch { /* ignore */ }
  };

  const s = selected;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">밸류에이션</h1>
          <p className="text-sm text-slate-400 mt-1">
            PER/PBR/ROE · Yahoo Finance 실데이터 · 동일 업종 비교
          </p>
        </div>
        <div className="flex items-center gap-2">
          {fetchedAt && (
            <span className="text-xs text-slate-400">
              {fetchedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준
            </span>
          )}
          <button
            onClick={loadDefaults}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4 text-slate-400", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Stock selector + search */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {data.map(stock => (
            <button
              key={stock.symbol}
              onClick={() => setSelected(stock)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all",
                selected?.symbol === stock.symbol
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white dark:bg-dark-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-400",
              )}
            >
              <Badge variant={stock.market === "KR" ? "yellow" : "blue"} size="sm">
                {stock.market}
              </Badge>
              {stock.name}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative max-w-xs">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="종목 추가 (코드 또는 이름 검색)"
              className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <button onClick={() => { setSearch(""); setResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>
          {(results.length > 0 || searching) && (
            <div className="absolute top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 overflow-hidden">
              {searching && <p className="px-4 py-2 text-xs text-slate-400">검색 중...</p>}
              {results.map(r => (
                <button
                  key={r.symbol}
                  onClick={() => addStock(r.symbol, r.name)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-left"
                >
                  <Badge variant={r.market === "KR" ? "yellow" : "blue"} size="sm">{r.market}</Badge>
                  <span className="text-sm text-slate-800 dark:text-slate-200">{r.name}</span>
                  <span className="text-xs text-slate-400 font-mono ml-auto">{r.symbol}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="card p-8 text-center">
          <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
          <p className="text-sm text-slate-500">Yahoo Finance에서 밸류에이션 데이터 수집 중...</p>
        </div>
      )}

      {error && !loading && (
        <div className="card p-8 text-center">
          <p className="text-sm text-slate-500">데이터를 불러오지 못했습니다.</p>
          <button onClick={loadDefaults} className="mt-3 text-xs text-blue-500 hover:underline">재시도</button>
        </div>
      )}

      {s && !loading && (
        <div className="card p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{s.name}</h2>
                <Badge variant={s.market === "KR" ? "yellow" : "blue"}>{s.market}</Badge>
                <Badge variant="neutral">{s.sector}</Badge>
              </div>
              <p className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
                {s.market === "KR"
                  ? s.price.toLocaleString() + "원"
                  : "$" + s.price.toFixed(2)}
              </p>
              {s.marketCap && (
                <p className="text-xs text-slate-400 mt-0.5">
                  시가총액: {s.market === "KR"
                    ? s.marketCap.toLocaleString() + "억원"
                    : s.marketCap.toLocaleString() + "백만달러"}
                </p>
              )}
            </div>
            <span className="text-xs text-slate-400 font-mono">{s.symbol}</span>
          </div>

          {/* Core metrics */}
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-6">
            <MetricCell value={s.per}      label="PER (Trailing)"  benchmark={20}  good="low"  />
            <MetricCell value={s.pbr}      label="PBR"             benchmark={3}   good="low"  />
            <MetricCell value={s.roe}      label="ROE (%)"         benchmark={10}  good="high" />
            <MetricCell value={s.psr}      label="PSR"             />
            <MetricCell value={s.evEbitda} label="EV/EBITDA"       />
          </div>

          {/* Forward PER */}
          {s.forwardPer && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-200">향후 추정 PER</h3>
                {s.forwardPer.isAIEstimate && (
                  <span className="flex items-center gap-1 text-xs text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                    <Sparkles className="w-3 h-3" />추정치
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Forward PE",     value: s.forwardPer.year1 },
                  { label: "FY2 추정",        value: s.forwardPer.year2 },
                  { label: "FY3 추정",        value: s.forwardPer.year3 },
                ].map(item => (
                  <div
                    key={item.label}
                    className="bg-gradient-to-br from-blue-50 to-slate-50 dark:from-blue-900/20 dark:to-slate-800/50 rounded-xl p-4 border border-blue-100 dark:border-blue-900/50 text-center"
                  >
                    <p className="text-xs text-slate-400 mb-1">{item.label}</p>
                    <p className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                      {item.value?.toFixed(1) ?? "-"}x
                    </p>
                  </div>
                ))}
              </div>
              {s.forwardPer.isAIEstimate && (
                <div className="flex items-start gap-2 mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Yahoo Finance Forward PE 미제공 · Trailing PE와 성장률 기반 추정치
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Peer comparison */}
          {s.peers && s.peers.length > 0 && (
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">동일 업종 비교 (PEER Group)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      <th className="pb-2 text-left font-medium">종목</th>
                      <th className="pb-2 text-right font-medium">PER</th>
                      <th className="pb-2 text-right font-medium">PBR</th>
                      <th className="pb-2 text-right font-medium">ROE (%)</th>
                      <th className="pb-2 text-right font-medium">시가총액</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/10">
                      <td className="py-2.5 font-bold text-blue-700 dark:text-blue-300">{s.name} (현재)</td>
                      <td className="py-2.5 text-right font-mono font-bold text-blue-700 dark:text-blue-300">{s.per?.toFixed(1) ?? "-"}</td>
                      <td className="py-2.5 text-right font-mono font-bold text-blue-700 dark:text-blue-300">{s.pbr?.toFixed(1) ?? "-"}</td>
                      <td className="py-2.5 text-right font-mono font-bold text-blue-700 dark:text-blue-300">{s.roe?.toFixed(1) ?? "-"}</td>
                      <td className="py-2.5 text-right font-mono text-slate-400">-</td>
                    </tr>
                    {s.peers.map(peer => (
                      <tr key={peer.symbol} className="table-row">
                        <td className="py-2.5">
                          <p className="font-medium text-slate-800 dark:text-slate-200">{peer.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{peer.symbol}</p>
                        </td>
                        <td className="py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">{peer.per?.toFixed(1) ?? "-"}</td>
                        <td className="py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">{peer.pbr?.toFixed(1) ?? "-"}</td>
                        <td className="py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">{peer.roe?.toFixed(1) ?? "-"}</td>
                        <td className="py-2.5 text-right font-mono text-slate-500">
                          {peer.marketCap ? peer.marketCap.toLocaleString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center">
        * 본 밸류에이션 데이터는 참고용이며 투자 권유가 아닙니다. 실제 투자 결정 시 최신 공인 데이터를 확인하세요.
      </p>
    </div>
  );
}
