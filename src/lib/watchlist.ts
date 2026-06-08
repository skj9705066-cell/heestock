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
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");

    // Migration: 오래된 데이터에 market 필드가 없을 수 있음
    const migrated = raw.map((item: any) => {
      if (!item.market) {
        // 6자리 숫자면 한국 종목, 그 외는 미국
        const detectedMarket = /^\d{6}$/.test(item.symbol) ? "KR" : "US";
        console.warn(`[watchlist] ${item.symbol} (${item.name}): market 필드 없음 → ${detectedMarket}로 자동 설정`);
        return { ...item, market: detectedMarket };
      }
      return item;
    });

    // 변경사항이 있으면 저장
    if (JSON.stringify(raw) !== JSON.stringify(migrated)) {
      localStorage.setItem(KEY, JSON.stringify(migrated));
      console.log(`[watchlist] Migration completed: ${migrated.length} items updated`);
    }

    return migrated;
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
