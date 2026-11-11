// Service worker: giúp app chạy offline và cài được lên điện thoại.
// Khi phát hành bản mới: tăng VERSION để người dùng nhận bản cập nhật.
const VERSION = 'v1.0.1';
const APP_CACHE = 'hht-app-' + VERSION;
const DATA_CACHE = 'hht-data';      // nét chữ, font, thư viện ngoài (ít thay đổi)

const APP_SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/style.css',
  'js/vendor/hanzi-writer.min.js', 'js/data-chars.js', 'js/data-components.js',
  'js/data-words.js', 'js/data-grammar.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(APP_SHELL)));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('hht-app-') && k !== APP_CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isData = (sameOrigin && url.pathname.includes('/data/strokes/')) || !sameOrigin;

  if (isData) {
    // Cache-first: dữ liệu nét, font chữ, từ điển CDN
    e.respondWith(caches.open(DATA_CACHE).then(async cache => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    }));
    return;
  }
  // Network-first cho file của app: luôn lấy bản mới nhất khi có mạng, offline thì dùng bản đã lưu
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(APP_CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
