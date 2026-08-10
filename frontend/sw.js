self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // Network first strategy
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
