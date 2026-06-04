"use client";

import { useState, useEffect, useCallback } from "react";
import {
  WatchlistItem,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  isInWatchlist,
} from "@/lib/watchlist";

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [hydrated,  setHydrated]  = useState(false);

  useEffect(() => {
    setWatchlist(getWatchlist());
    setHydrated(true);
  }, []);

  const refresh = useCallback(() => setWatchlist(getWatchlist()), []);

  const add = useCallback((item: Omit<WatchlistItem, "addedAt">) => {
    addToWatchlist(item);
    refresh();
  }, [refresh]);

  const remove = useCallback((symbol: string) => {
    removeFromWatchlist(symbol);
    refresh();
  }, [refresh]);

  const check = useCallback((symbol: string): boolean => {
    if (!hydrated) return false;
    return isInWatchlist(symbol);
  }, [hydrated]);

  const toggle = useCallback((item: Omit<WatchlistItem, "addedAt">): boolean => {
    if (isInWatchlist(item.symbol)) { remove(item.symbol); return false; }
    add(item);
    return true;
  }, [add, remove]);

  return { watchlist, add, remove, check, toggle, hydrated };
}
