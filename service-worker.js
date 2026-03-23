// VitaTrack Service Worker
// Strategia: Cache-first per assets locali, Network-first per API esterne

const CACHE_NAME = 'vitatrack-v1';
const CACHE_VERSION = 1;

// File da cachare subito all'installazione
const PRECACHE_URLS = [
  './vitatrack.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=DM+Sans:wght@300;400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

// URL che vanno sempre dalla rete (API esterne)
const NETWORK_ONLY = [
  'world.openfoodfacts.org',
  'fonts.gstatic.com'
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Cache i file locali — ignora eventuali errori su CDN
        return Promise.allSettled(
          PRECACHE_URLS.map(url =>
            cache.add(url).catch(err => {
              console.warn('[SW] Failed to cache:', url, err.message);
            })
          )
        );
      })
      .then(() => self.skipWaiting()) // Attiva subito senza aspettare reload
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME) // Elimina cache vecchie
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      ))
      .then(() => self.clients.claim()) // Prendi controllo di tutte le tab subito
  );
});

// ── FETCH ────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignora richieste non-GET
  if(event.request.method !== 'GET') return;

  // API esterne → Network first, senza cache
  if(NETWORK_ONLY.some(domain => url.hostname.includes(domain))){
    event.respondWith(
      fetch(event.request)
        .catch(() => new Response(
          JSON.stringify({ error: 'offline', status: 0 }),
          { headers: { 'Content-Type': 'application/json' } }
        ))
    );
    return;
  }

  // Tutto il resto → Cache first, poi rete
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if(cached) return cached;

        // Non in cache → fetch dalla rete e salva
        return fetch(event.request)
          .then(response => {
            // Salva solo risposte valide
            if(!response || response.status !== 200 || response.type === 'error'){
              return response;
            }
            const toCache = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
            return response;
          })
          .catch(() => {
            // Offline e non in cache → fallback minimo
            if(event.request.destination === 'document'){
              return caches.match('./vitatrack.html');
            }
            return new Response('', { status: 503 });
          });
      })
  );
});

// ── BACKGROUND SYNC (future-proof) ───────────────────────────
self.addEventListener('sync', event => {
  if(event.tag === 'vitatrack-sync'){
    console.log('[SW] Background sync triggered');
    // Placeholder per sync futura con backend
  }
});

// ── PUSH NOTIFICATIONS (future-proof) ────────────────────────
self.addEventListener('push', event => {
  if(!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'VitaTrack', {
      body: data.body || '',
      icon: './icons/icon-192.png',
      badge: './icons/icon-72.png',
      vibrate: [100, 50, 100]
    })
  );
});
