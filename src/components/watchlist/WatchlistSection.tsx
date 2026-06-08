"use client";

import { useState, useEffect } from "react";
import { Star, ChevronDown, ChevronUp } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { WatchlistStockCard } from "./WatchlistStockCard";

export function WatchlistSection() {
  const { watchlist, remove, hydrated } = useWatchlist();
  const [isExpanded, setIsExpanded] = useState(true);

  // Load expansion state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("heestock_watchlist_expanded");
    if (saved !== null) {
      setIsExpanded(saved === "true");
    }
  }, []);

  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem("heestock_watchlist_expanded", String(newState));
  };

  if (!hydrated) return null;

  return (
    <section>
      <button
        onClick={toggleExpanded}
        className="flex items-center justify-between w-full mb-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <Star className="w-5 h-5 text-yellow-400 fill-current" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">관심종목</h2>
          {watchlist.length > 0 && (
            <span className="text-sm text-slate-400">({watchlist.length})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
          )}
        </div>
      </button>

      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        {watchlist.length === 0 ? (
          <div className="card p-8 text-center">
            <Star className="w-10 h-10 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">
              관심종목이 없습니다
            </p>
            <p className="text-xs text-slate-400">
              인기 종목이나 검색 결과의 <span className="text-yellow-400 font-bold">★</span> 버튼을 눌러 추가하세요
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {watchlist.map(item => (
              <WatchlistStockCard
                key={item.symbol}
                item={item}
                onRemove={remove}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
