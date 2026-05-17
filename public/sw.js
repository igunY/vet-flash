const STATIC_CACHE = 'vetflash-static-v1';
const PAGE_CACHE = 'vetflash-pages-v1';
const CURRENT_CACHES = [STATIC_CACHE, PAGE_CACHE];

// ---- インストール: 即座にアクティブ化 ----
self.addEventListener('install', () => {
  self.skipWaiting();
});

// ---- アクティベート: 古いキャッシュを削除 ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !CURRENT_CACHES.includes(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// ---- フェッチ戦略 ----
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 対象外: POST 等、別オリジン
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // API ルート: ネットワークのみ（キャッシュしない）
  if (url.pathname.startsWith('/api/')) return;

  // Next.js ビルド成果物 (_next/static/): キャッシュファースト
  // ファイル名がコンテンツハッシュされているので永続キャッシュ可能
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          });
        }),
      ),
    );
    return;
  }

  // アイコン・マニフェスト等の静的アセット: キャッシュファースト
  if (
    url.pathname.match(/\.(png|svg|ico|webp|json)$/) &&
    !url.pathname.startsWith('/api/')
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          });
        }),
      ),
    );
    return;
  }

  // HTML ページ: ネットワークファースト（オフライン時はキャッシュから）
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(PAGE_CACHE).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          // ルートにフォールバック
          return caches.match('/') ?? Response.error();
        }),
    );
    return;
  }
});
