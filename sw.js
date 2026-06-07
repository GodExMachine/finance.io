const CACHE_NAME = 'Financcely-v1.0';
const ASSETS = [
  './app.html',
  './manifest.json'
];

// Instala e faz cache dos arquivos principais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {
        // Ignora erros de cache de recursos externos
      });
    })
  );
  self.skipWaiting();
});

// Limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Estratégia: Network first, cai para cache se offline
self.addEventListener('fetch', (event) => {
  // Ignora requisições de outros domínios (fontes, CDN, etc)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Salva cópia no cache
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => {
        // Offline: retorna do cache
        return caches.match(event.request);
      })
  );
});
