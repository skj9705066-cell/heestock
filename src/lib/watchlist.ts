export interface WatchlistItem {
  symbol: string;
  name:   string;
  market: "KR" | "US";
  sector?: string;
  addedAt: number;
}

const KEY = "heestock_watchlist";

export function getWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function addToWatchlist(item: Omit<WatchlistItem, "addedAt">): void {
  const list = getWatchlist();
  if (list.some(x => x.symbol === item.symbol)) return;
  list.unshift({ ...item, addedAt: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function removeFromWatchlist(symbol: string): void {
  localStorage.setItem(KEY, JSON.stringify(getWatchlist().filter(x => x.symbol !== symbol)));
}

export function isInWatchlist(symbol: string): boolean {
  return getWatchlist().some(x => x.symbol === symbol);
}
