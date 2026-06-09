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

      // 1.5 한국 종목 .KS/.KQ 접미사 제거 (앱은 6자리 코드만 사용)
      if (typeof updated.symbol === "string") {
        const stripped = updated.symbol.replace(/\.(KS|KQ)$/i, "");
        if (stripped !== updated.symbol) {
          console.warn(`[watchlist] ${item.name}: 접미사 제거 (${updated.symbol} → ${stripped})`);
          updated.symbol = stripped;
          needsUpdate = true;
        }
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

      // 3. market 정규화/복구:
      //    6자리 숫자 코드는 무조건 KR. 과거 버그로 KR 종목이 "US"로 오염 저장된
      //    경우까지 강제로 바로잡는다 (값이 비었을 때만 채우던 기존 로직은 오염을 못 고침).
      const isKrCode = /^\d{6}$/.test(updated.symbol);
      if (isKrCode) {
        if (updated.market !== "KR") {
          console.warn(`[watchlist] ${updated.symbol} (${item.name}): market 오염/누락 복구 (${updated.market ?? "없음"} → KR)`);
          updated.market = "KR";
          needsUpdate = true;
        }
      } else if (!updated.market) {
        console.warn(`[watchlist] ${updated.symbol} (${item.name}): market 필드 없음 → US로 자동 설정`);
        updated.market = "US";
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
