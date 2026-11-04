// 名片管家 service worker：讓 App 沒有網路也能打開
const VERSION = 'mpgj-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './xlsx.full.min.js',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png', './help.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// 只處理自己網站的檔案；AI 服務的請求直接走網路，不快取
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // 先用手機裡存好的版本（打開最快），同時在背景下載新版本，下次打開就會更新
  e.respondWith(caches.open(VERSION).then(async cache => {
    const key = req.mode === 'navigate' ? './index.html' : req;
    const cached = await cache.match(key, { ignoreSearch: true });
    const fresh = fetch(req).then(res => {
      if (res && res.ok) cache.put(key, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
