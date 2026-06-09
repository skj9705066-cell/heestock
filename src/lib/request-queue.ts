// 관심종목 시세용 클라이언트 요청 조절기.
//
// 문제: 홈 로드 시 WatchlistStockCard 여러 개 + BounceAlertsSection 이 같은 종목의
// /api/stock-snapshot, /api/daily-candles 를 제각각 동시에(Promise.all) 발사 →
// 서버가 KIS Open API를 짧은 시간에 몰아 호출 → 초당 제한에 걸려 일부 종목의
// quote 가 누락(HTTP 200 + quote:null). 종목 4개면 한순간 ~16개 요청.
//
// 해결 2가지를 함께 적용:
//   1) 동시성 제한(限): 한 번에 최대 MAX_CONCURRENT 개만 실제 호출.
//   2) 중복 제거 + 단기 캐시: 같은 종목 요청은 진행 중이면 공유(in-flight),
//      성공 결과는 TTL 동안 캐시 → 카드와 바운스알림이 한 번의 호출을 공유.

const MAX_CONCURRENT = 3;   // 동시 실행 상한 (KIS 부하 ↓, 그래도 너무 느리지 않게)
const CACHE_TTL_MS   = 60_000;

// ── 동시성 세마포어 ───────────────────────────────────────────────────────────
let active = 0;
const waiters: Array<() => void> = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  return new Promise<void>((res) => waiters.push(res));
}

function release(): void {
  const next = waiters.shift();
  if (next) next();      // 슬롯을 대기자에게 인계 (active 유지)
  else active--;
}

async function run<T>(task: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await task();
  } finally {
    release();
  }
}

// ── 중복 제거 + 캐시 ──────────────────────────────────────────────────────────
type CacheEntry = { data: unknown; ts: number };
const cache    = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * key 단위로 중복 제거하며 JSON GET. 동일 key가 진행 중이면 그 promise를 공유하고,
 * 유효한(=isValid) 결과는 TTL 동안 캐시한다. 실패/무효 결과는 캐시하지 않아 재시도 가능.
 * 반환: 파싱된 JSON, 또는 응답 실패 시 null.
 */
function dedupedFetch<T>(
  key: string,
  url: string,
  init: RequestInit,
  isValid: (data: T) => boolean,
): Promise<T | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return Promise.resolve(hit.data as T);
  }
  const existing = inflight.get(key) as Promise<T | null> | undefined;
  if (existing) return existing;

  const p = run(async () => {
    const res = await fetch(url, init);
    const data = res.ok ? ((await res.json()) as T) : null;
    if (data != null && isValid(data)) {
      cache.set(key, { data, ts: Date.now() });
    }
    return data;
  }).finally(() => inflight.delete(key));

  inflight.set(key, p as Promise<unknown>);
  return p;
}

// ── 공개 헬퍼 ─────────────────────────────────────────────────────────────────

export interface SnapshotQuoteLite {
  quote?: { price?: number; change?: number; changePercent?: number; currency?: string } | null;
  [k: string]: unknown;
}

/** 종목 스냅샷(시세 포함). quote.price>0 일 때만 캐시. 실패 시 null. */
export function fetchSnapshot(
  symbol: string,
  market: "KR" | "US",
): Promise<SnapshotQuoteLite | null> {
  const url = `/api/stock-snapshot?symbol=${symbol}&market=${market}&_t=${Date.now()}`;
  return dedupedFetch<SnapshotQuoteLite>(
    `snap:${market}:${symbol}`,
    url,
    { cache: "no-store", headers: { "Cache-Control": "no-cache" } },
    (d) => (d?.quote?.price ?? 0) > 0,
  );
}

/** 일봉 캔들. 20개 이상일 때만 캐시. 실패 시 null. */
export function fetchCandles(
  symbol: string,
  market: "KR" | "US",
  days = 130,
): Promise<unknown[] | null> {
  const url = `/api/daily-candles?symbol=${symbol}&market=${market}&days=${days}&_t=${Date.now()}`;
  return dedupedFetch<unknown[]>(
    `cand:${market}:${symbol}`,
    url,
    { cache: "no-store" },
    (d) => Array.isArray(d) && d.length >= 20,
  );
}
