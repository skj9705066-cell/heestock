"use client";

import { useState, useEffect } from "react";
import { Star, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { cn } from "@/lib/utils";
import { AddWatchlistModal } from "@/components/watchlist/AddWatchlistModal";
import toast from "react-hot-toast";

export function WatchlistPanel() {
  const { watchlist, remove, hydrated } = useWatchlist();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Load expansion state
  useEffect(() => {
    const saved = localStorage.getItem("heestock_ai_watchlist_expanded");
    if (saved !== null) {
      setIsExpanded(saved === "true");
    }
  }, []);

  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem("heestock_ai_watchlist_expanded", String(newState));
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

          {/* Right: Add Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">추가</span>
          </button>
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

      <AddWatchlistModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}
