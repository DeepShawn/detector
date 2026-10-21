// 离线缓存：首次打开后全部资源本地可用。改动资源时记得提升 CACHE 版本号。

const CACHE = 'yfmz-v1';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/main.js',
  'js/play.js',
  'js/judge.js',
  'js/storage.js',
  'js/feedback.js',
  'js/levels.js',
  'js/share.js',
  'js/ui.js',
  'js/modes/index.js',
  'js/modes/scene.js',
  'js/modes/pick.js',
  'js/modes/order.js',
  'levels/index.json',
  'levels/case-001.json',
  'levels/case-002.json',
  'levels/case-003.json',
  'levels/case-004.json',
  'levels/assets/case-001.svg',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => hit ?? fetch(event.request)),
  );
});
