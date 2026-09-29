// 決算チャレンジ（令和6年度） Service Worker
// 更新したら VERSION を上げると、古いキャッシュが自動で消えます
const VERSION = 'v1';
const CACHE = 'kakogawa06kessan-' + VERSION;
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.ico'];
// このページが読み込む外部ライブラリ（React・Babel・Tailwind）の配信元。初回に保存して、2回目以降とオフラインで使う
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'cdn.tailwindcss.com'];

self.addEventListener('install', e => {
  // 1つでも見つからないファイルがあっても、インストールを止めない
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('kakogawa06kessan-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// キャッシュを先に返し、裏で最新版に更新する
function staleWhileRevalidate(e, req) {
  e.respondWith(
    caches.open(CACHE).then(c =>
      c.match(req).then(hit => {
        const net = fetch(req).then(res => {
          if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
          return res;
        }).catch(() => hit);
        if (hit) e.waitUntil(net);
        return hit || net;
      })
    )
  );
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (CDN_HOSTS.includes(url.hostname)) { staleWhileRevalidate(e, req); return; }
  // 上記以外の他サイト（議員マップなどのリンク先）には介入しない
  if (url.origin !== location.origin) return;

  // ページ本体: ネットワーク優先、失敗したらキャッシュ
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('index.html', copy));
        return res;
      }).catch(() => caches.match('index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  staleWhileRevalidate(e, req);
});
