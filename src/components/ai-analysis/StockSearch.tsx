"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, TrendingUp, Star } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { useWatchlist } from "@/hooks/useWatchlist";

interface SearchResult {
  symbol: string;
  name:   string;
  market: "KR" | "US";
  sector: string;
}

interface StockSearchProps {
  onSelect:      (stock: SearchResult) => void;
  selectedStock?: SearchResult | null;
}

export function StockSearch({ onSelect, selectedStock }: StockSearchProps) {
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState<SearchResult[]>([]);
  const [isOpen,   setIsOpen]   = useState(false);
  const [isLoading,setIsLoading]= useState(false);
  const [market,   setMarket]   = useState<"ALL" | "KR" | "US">("ALL");
  const inputRef  = useRef<HTMLInputElement>(null);
  const wrapperRef= useRef<HTMLDivElement>(null);

  const { check, toggle } = useWatchlist();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res  = await fetch(`/api/stock-search?q=${encodeURIComponent(query)}&market=${market}`);
        const data = await res.json();
        setResults(data);
        setIsOpen(true);
      } catch { setResults([]); }
      finally { setIsLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, market]);

  const handleSelect = (stock: SearchResult) => { onSelect(stock); setQuery(""); setIsOpen(false); };
  const handleClear  = () => { onSelect(null as any); setQuery(""); inputRef.current?.focus(); };

  const handleStar = (stock: SearchResult, e: React.MouseEvent) => {
    e.stopPropagation();
    const added = toggle({ symbol: stock.symbol, name: stock.name, market: stock.market, sector: stock.sector });
    toast.success(added ? `${stock.name} 관심종목 추가됨 ★` : `${stock.name} 관심종목 삭제됨`);
  };

  return (
    <div className="space-y-3">
      {/* Market Toggle */}
      <div className="flex gap-2">
        {(["ALL", "KR", "US"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMarket(m)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              market === m
                ? "bg-blue-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            {m === "ALL" ? "전체" : m === "KR" ? "한국" : "미국"}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div ref={wrapperRef} className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setIsOpen(true)}
            placeholder="종목명 또는 티커 검색... (예: 삼성전자, NVDA)"
            className="input-field pl-10 pr-10"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-dark-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
            {isLoading ? (
              <div className="px-4 py-3 text-sm text-slate-400 text-center">검색 중...</div>
            ) : results.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-400 text-center">검색 결과가 없습니다</div>
            ) : (
              <ul className="max-h-64 overflow-y-auto">
                {results.map((stock) => {
                  const inList = check(stock.symbol);
                  return (
                    <li key={`${stock.market}-${stock.symbol}`} className="group">
                      <div className="flex items-center">
                        <button
                          onClick={() => handleSelect(stock)}
                          className="flex-1 flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                        >
                          <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                            <TrendingUp className="w-4 h-4 text-slate-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                                {stock.name}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">{stock.symbol}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{stock.sector}</p>
                          </div>
                          <Badge variant={stock.market === "KR" ? "yellow" : "blue"} size="sm">
                            {stock.market}
                          </Badge>
                        </button>
                        {/* ★ Button */}
                        <button
                          onClick={(e) => handleStar(stock, e)}
                          className={cn(
                            "p-2.5 mr-2 rounded-lg transition-all",
                            inList
                              ? "text-yellow-400 hover:text-yellow-500"
                              : "text-slate-300 hover:text-yellow-400 dark:text-slate-600 opacity-0 group-hover:opacity-100"
                          )}
                          title={inList ? "관심종목 삭제" : "관심종목 추가"}
                        >
                          <Star className={cn("w-4 h-4", inList && "fill-current")} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Selected Stock Display */}
      {selectedStock && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-700 dark:text-blue-300">{selectedStock.name}</span>
              <span className="text-xs text-blue-500 font-mono">{selectedStock.symbol}</span>
              <Badge variant={selectedStock.market === "KR" ? "yellow" : "blue"}>{selectedStock.market}</Badge>
            </div>
            <p className="text-xs text-blue-500/70 mt-0.5">{selectedStock.sector}</p>
          </div>
          <button
            onClick={() => {
              const added = toggle({ symbol: selectedStock.symbol, name: selectedStock.name, market: selectedStock.market, sector: selectedStock.sector });
              toast.success(added ? `${selectedStock.name} 관심종목 추가됨 ★` : `${selectedStock.name} 관심종목 삭제됨`);
            }}
            className={cn(
              "p-1.5 rounded-lg transition-all",
              check(selectedStock.symbol)
                ? "text-yellow-400 hover:text-yellow-500"
                : "text-slate-400 hover:text-yellow-400"
            )}
            title={check(selectedStock.symbol) ? "관심종목 삭제" : "관심종목 추가"}
          >
            <Star className={cn("w-4 h-4", check(selectedStock.symbol) && "fill-current")} />
          </button>
          <button
            onClick={handleClear}
            className="p-1 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
          >
            <X className="w-4 h-4 text-blue-500" />
          </button>
        </div>
      )}
    </div>
  );
}
