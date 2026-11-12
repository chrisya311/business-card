// 名片管家 service worker：讓 App 沒有網路也能打開
const VERSION = 'mpgj-2026.11.12-1';   // 每次更新 App 都要改這個版本號
const SHELL = ['./', './index.html', './help.html', './manifest.webmanifest', './xlsx.full.min.js',
  './style.css', './core.js', './options.js', './cardcrop.js', './calendar.js', './companies.js', './forms.js', './ai-scan.js', './export.js', './drive-sync.js', './app.js',
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
    // 每個頁面（主畫面、說明）各自存各自的；找不到時才退回 App 主畫面
    const cached = (await cache.match(req, { ignoreSearch: true })) ||
      (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
    const fresh = fetch(url.pathname + url.search, { cache: 'no-cache' }).then(res => {
      if (res && res.ok && !res.redirected) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    // 說明頁：有網路就一定用最新版，沒網路才用存好的
    if (/\/help\.html$/.test(url.pathname)) return fresh.then(r => (r && r.ok) ? r : (cached || r), () => cached);
    return cached || fresh;
  }));
});
