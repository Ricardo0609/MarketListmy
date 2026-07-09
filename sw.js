/* ══════════════════════════════════════════
   MarketList — sw.js (Service Worker)
   ══════════════════════════════════════════ */

const CACHE_NAME = 'marketlist-v3';
const URLS_TO_CACHE = [
  '/index.html',
  '/style.css',
  '/js.js',
  '/sw.js'
];

// Instalación: cachear archivos esenciales
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        URLS_TO_CACHE.map(url =>
          cache.add(url).catch(err => console.warn(`No se pudo cachear ${url}:`, err))
        )
      );
    })
  );
  self.skipWaiting(); // Activar inmediatamente sin esperar
});

// Activación: limpiar caches viejos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim(); // Tomar control de todas las pestañas abiertas
});

// Fetch: responder desde caché, con red como fallback
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).catch(() => caches.match('/index.html'));
    })
  );
});
