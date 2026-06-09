// 희스탁 HeeStock — Service Worker
// IMPORTANT: bump these version suffixes whenever client-visible logic changes
// so existing visitors invalidate their cached app shell + API responses.
const CACHE_VER  = 'heestock-v3';
const STATIC_CACHE = 'heestock-static-v3';
const API_CACHE    = 'heestock-api-v3';

const PRECACHE_URLS = ['/', '/guide', '/ai-analysis', '/market-signals', '/rs-ranking', '/valuation', '/financials'];

// ── Install: precache app shell ───────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)))
    )
  );
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const KEEP = new Set([STATIC_CACHE, API_CACHE]);
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k)))
      ),
    ])
  );
});

// ── Fetch: routing strategy ───────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Next.js static assets → cache-first (they have content hashes, safe to cache forever)
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(request).then((hit) => {
        if (hit) return hit;
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // API routes → network-first with 10 s timeout, cached fallback for offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      Promise.race([
        fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(API_CACHE).then((c) => c.put(request, clone));
          }
          return res;
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10_000)),
      ]).catch(() => caches.match(request))
    );
    return;
  }

  // HTML pages → network-first, offline fallback to cached '/'
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request) ?? caches.match('/'))
  );
});
