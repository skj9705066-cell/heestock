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

    // Migration: 오래된 데이터 정규화
    const migrated = raw.map((item: any) => {
      let updated = { ...item };
      let needsUpdate = false;

      // 1. symbol을 문자열로 강제 변환 (숫자로 저장된 경우 대비)
      if (typeof item.symbol !== "string") {
        updated.symbol = String(item.symbol);
        needsUpdate = true;
        console.warn(`[watchlist] ${item.name}: symbol을 문자열로 변환 (${typeof item.symbol} → string)`);
      }

      // 2. 한국 종목 symbol을 6자리로 패딩 (앞자리 0 복구)
      if (updated.symbol && /^\d+$/.test(updated.symbol)) {
        const padded = updated.symbol.padStart(6, "0");
        if (padded !== updated.symbol) {
          console.warn(`[watchlist] ${item.name}: symbol 패딩 (${updated.symbol} → ${padded})`);
          updated.symbol = padded;
          needsUpdate = true;
        }
      }

      // 3. market 필드 없으면 자동 설정
      if (!updated.market) {
        const detectedMarket = /^\d{6}$/.test(updated.symbol) ? "KR" : "US";
        console.warn(`[watchlist] ${updated.symbol} (${item.name}): market 필드 없음 → ${detectedMarket}로 자동 설정`);
        updated.market = detectedMarket;
        needsUpdate = true;
      }

      return updated;
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
