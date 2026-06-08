"use client";

import { useState, useEffect, useRef } from "react";
import { Star, ChevronDown, ChevronUp, Search, X, Plus } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface SearchResult {
  symbol: string;
  name: string;
  market: "KR" | "US";
  sector: string;
}

export function WatchlistPanel() {
  const { watchlist, add, remove, check, hydrated } = useWatchlist();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Load expansion state
  useEffect(() => {
    const saved = localStorage.getItem("heestock_ai_watchlist_expanded");
    if (saved !== null) {
      setIsExpanded(saved === "true");
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowAddForm(false);
        setQuery("");
        setResults([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Search stocks
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/stock-search?q=${encodeURIComponent(query)}&market=ALL`);
        const data = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem("heestock_ai_watchlist_expanded", String(newState));
  };

  const handleAddStock = (stock: SearchResult) => {
    add({ symbol: stock.symbol, name: stock.name, market: stock.market, sector: stock.sector });
    toast.success(`${stock.name} 관심종목 추가됨 ★`);
    setQuery("");
    setResults([]);
  };

  const handleRemoveStock = (symbol: string, name: string) => {
    remove(symbol);
    toast.success(`${name} 관심종목 삭제됨`);
  };

  if (!hydrated) return null;

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
      <div className="px-6 py-3">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Left: Title */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Star className="w-4 h-4 text-yellow-400 fill-current" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              관심종목
            </h3>
            {watchlist.length > 0 && (
              <span className="text-xs text-slate-400">({watchlist.length})</span>
            )}
          </div>

          {/* Center: Toggle Button */}
          <button
            onClick={toggleExpanded}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                닫기
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                열기
              </>
            )}
          </button>

          {/* Right: Add/Search */}
          <div ref={searchRef} className="flex-1 relative">
            {!showAddForm ? (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full sm:w-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                관심종목 추가
              </button>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="종목명 또는 티커..."
                      className="w-full pl-8 pr-8 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoFocus
                    />
                    {query && (
                      <button
                        onClick={() => setQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2"
                      >
                        <X className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setQuery("");
                      setResults([]);
                    }}
                    className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    취소
                  </button>
                </div>

                {/* Search Results Dropdown */}
                {query && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-64 overflow-y-auto z-50">
                    {isLoading ? (
                      <div className="px-3 py-2 text-xs text-slate-400 text-center">검색 중...</div>
                    ) : results.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-400 text-center">검색 결과 없음</div>
                    ) : (
                      <ul>
                        {results.map((stock) => {
                          const inList = check(stock.symbol);
                          return (
                            <li
                              key={`${stock.market}-${stock.symbol}`}
                              className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                    {stock.name}
                                  </span>
                                  <span className="text-xs text-slate-400 font-mono">{stock.symbol}</span>
                                  <span className={cn(
                                    "text-xs px-1.5 py-0.5 rounded",
                                    stock.market === "KR"
                                      ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                                      : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                                  )}>
                                    {stock.market}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => inList ? handleRemoveStock(stock.symbol, stock.name) : handleAddStock(stock)}
                                className={cn(
                                  "p-1 rounded",
                                  inList
                                    ? "text-yellow-400 hover:text-yellow-500"
                                    : "text-slate-400 hover:text-yellow-400"
                                )}
                              >
                                <Star className={cn("w-3.5 h-3.5", inList && "fill-current")} />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Watchlist Items */}
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            isExpanded ? "max-h-[500px] opacity-100 mt-3" : "max-h-0 opacity-0"
          }`}
        >
          {watchlist.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">
              <Star className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
              <p>아직 관심종목이 없습니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 overflow-y-auto max-h-[400px] pr-2">
              {watchlist.map((item) => (
                <div
                  key={item.symbol}
                  className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg group hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {item.name}
                      </span>
                      <span className={cn(
                        "text-xs px-1 py-0.5 rounded flex-shrink-0",
                        item.market === "KR"
                          ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                          : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                      )}>
                        {item.market}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{item.symbol}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveStock(item.symbol, item.name)}
                    className="ml-2 p-1 text-yellow-400 hover:text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Star className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
