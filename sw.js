// Sonicwave PWA Service Worker
const CACHE_NAME = 'sonicwave-cache-v21';
const STATIC_ASSETS = [
  './',
  './index.html',
  './login.html',
  './login.css',
  './login.js',
  './style.css',
  './app.js',
  './logo.png',
  './logo.jpg',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests for local static files
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Do not cache external API or stream calls
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          if (networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });
      });
    }).catch(() => {
      return caches.match('./index.html');
    })
  );
});
