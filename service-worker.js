const CACHE_NAME = 'ai-dashboard-v1';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './manifest.json', './data.json'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
    if (resp && resp.status === 200 && e.request.url.startsWith(self.location.origin)) {
      const copy = resp.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
    }
    return resp;
  }).catch(() => caches.match('./index.html'))));
});
