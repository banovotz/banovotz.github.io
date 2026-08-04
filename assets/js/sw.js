const CACHE_NAME = 'images-cache-v1';

// Presretanje mrežnih zahtjeva
self.addEventListener('fetch', (event) => {
  // Provjeravamo je li zahtjev za sliku
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          // Ako imamo sliku u klijentskom cacheu, vrati je izravno
          if (cachedResponse) {
            return cachedResponse;
          }
          // Ako nemamo, dohvati s mreže i spremi u klijentski cache za ubuduće
          return fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
  }
});