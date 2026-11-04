// 名片管家 service worker：讓 App 沒有網路也能打開
const VERSION = 'mpgj-2026.11.04-5';   // 每次更新 App 都要改這個版本號
const SHELL = ['./', './index.html', './help.html', './manifest.webmanifest', './xlsx.full.min.js',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  // cache:'reload' 確保拿到伺服器上最新的檔案，而不是舊的快取
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// 只處理自己網站的檔案；AI 服務的請求直接走網路，不快取
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // 先用手機裡存好的版本（打開最快），同時在背景向伺服器確認有沒有新版本
  e.respondWith(caches.open(VERSION).then(async cache => {
    const key = req.mode === 'navigate' ? './index.html' : req;
    const cached = await cache.match(key, { ignoreSearch: true });
    const fresh = fetch(url.pathname + url.search, { cache: 'no-cache' }).then(res => {
      if (res && res.ok) cache.put(key, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
