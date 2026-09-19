/**
 * service-worker.js — Enterprise PWA Service Worker (Hardened Offline Resilience)
 * Offline-first asset caching, atomic cache cleanup, and resilient fallbacks.
 */

const CACHE_NAME = 'inventory-pos-charcoal_glass_v1';

const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './styles/base.css',
  './styles/layout.css',
  './styles/components.css',
  './styles/pos.css',
  './styles/print.css',
  './icons/sprite.svg',
  './js/db.js',
  './js/router.js',
  './js/utils.js',
  './js/components/toast.js',
  './js/components/modal.js',
  './js/components/cart.js',
  './js/components/search.js',
  './js/components/tour.js',
  './js/pages/dashboard.js',
  './js/pages/inventory.js',
  './js/pages/pos.js',
  './js/pages/register.js',
  './js/pages/recipes.js',
  './js/pages/customers.js',
  './js/pages/suppliers.js',
  './js/pages/logs.js',
  './js/pages/analytics.js',
  './js/pages/adv_inventory.js',
  './js/pages/reports.js',
  './js/pages/showcase.js',
  './js/pages/settings.js',
  './js/pages/business_value.js',
  './js/pages/proposal.js'
];

const EXTERNAL_ASSETS = [
  'https://unpkg.com/dexie@3.2.7/dist/dexie.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Outfit:wght@400;600;700&display=swap'
];

// Install event — pre-cache all local assets reliably
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Pre-caching core local assets...');
      // Cache local assets strictly
      await cache.addAll(LOCAL_ASSETS);

      // Cache external assets gracefully (do not fail if offline during install)
      for (const url of EXTERNAL_ASSETS) {
        try {
          await cache.add(url);
        } catch (e) {
          console.warn('[SW] Non-critical external asset skipped:', url);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// Activate event — clean up old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging deprecated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event — Stale-While-Revalidate with bulletproof offline fallbacks
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache for next time (Stale-While-Revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => { /* offline: ignore network error */ });

        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        // Cache newly requested assets
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // If offline and requesting navigation HTML, return cached index.html
        const accept = event.request.headers.get('accept');
        if (accept && accept.includes('text/html')) {
          return caches.match('./index.html') || caches.match('./');
        }
      });
    })
  );
});
