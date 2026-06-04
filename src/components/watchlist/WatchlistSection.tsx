"use client";

import { Star } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { WatchlistStockCard } from "./WatchlistStockCard";

export function WatchlistSection() {
  const { watchlist, remove, hydrated } = useWatchlist();

  if (!hydrated) return null;

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <Star className="w-5 h-5 text-yellow-400 fill-current" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">관심종목</h2>
        {watchlist.length > 0 && (
          <span className="text-sm text-slate-400">({watchlist.length})</span>
        )}
      </div>

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
    </section>
  );
}
