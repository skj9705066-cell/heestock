"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Star, TrendingUp } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface SearchResult {
  symbol: string;
  name: string;
  market: "KR" | "US";
  sector: string;
  price?: number;
  changePercent?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AddWatchlistModal({ isOpen, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { check, toggle } = useWatchlist();

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

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
        setResults(data || []);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }
  }, [isOpen, onClose]);

  const handleToggleStar = (stock: SearchResult) => {
    const added = toggle({
      symbol: stock.symbol,
      name: stock.name,
      market: stock.market,
      sector: stock.sector,
    });
    toast.success(added ? `${stock.name} 관심종목 추가됨 ★` : `${stock.name} 관심종목 삭제됨`);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Star className="w-5 h-5 text-yellow-500 fill-current" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">관심종목 추가</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="닫기"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Search Input */}
          <div className="px-6 pt-4 pb-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="종목명 또는 종목코드로 검색... (예: 삼성전자, 005930, NVDA)"
                className="w-full pl-12 pr-4 py-3 text-base bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 dark:text-white placeholder:text-slate-400"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {!query ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                  종목을 검색해주세요
                </p>
                <p className="text-xs text-slate-400">
                  종목명이나 종목코드를 입력하세요
                </p>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                  <span className="text-sm text-slate-500">검색 중...</span>
                </div>
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <TrendingUp className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                  검색 결과가 없습니다
                </p>
                <p className="text-xs text-slate-400">
                  다른 키워드로 검색해보세요
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((stock) => {
                  const inList = check(stock.symbol);
                  return (
                    <div
                      key={`${stock.market}-${stock.symbol}`}
                      className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors group"
                    >
                      {/* Icon */}
                      <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-slate-700">
                        <TrendingUp className="w-5 h-5 text-blue-500" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-base text-slate-900 dark:text-white">
                            {stock.name}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            {stock.symbol}
                          </span>
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded font-semibold",
                              stock.market === "KR"
                                ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                                : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                            )}
                          >
                            {stock.market}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {stock.sector}
                        </p>
                      </div>

                      {/* Star Button */}
                      <button
                        onClick={() => handleToggleStar(stock)}
                        className={cn(
                          "p-3 rounded-lg transition-all flex-shrink-0",
                          inList
                            ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-500 hover:bg-yellow-200 dark:hover:bg-yellow-900/50"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-400 hover:bg-yellow-100 hover:text-yellow-500 dark:hover:bg-yellow-900/30"
                        )}
                        title={inList ? "관심종목 삭제" : "관심종목 추가"}
                      >
                        <Star className={cn("w-5 h-5", inList && "fill-current")} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Hint */}
          <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              ★ 버튼을 눌러 관심종목에 추가/삭제할 수 있습니다
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
