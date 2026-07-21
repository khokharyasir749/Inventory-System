/**
 * service-worker.js — PWA Service Worker
 * Offline asset caching and versioned cache strategy.
 */

const CACHE_NAME = 'inventory-pos-v4.0.0';
const ASSETS = [
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
  './js/pages/proposal.js',
  'https://unpkg.com/dexie@3.2.7/dist/dexie.js',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap'
];

// Install event — pre-cache all core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static assets...');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate event — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event — serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh in background to update cache for next time (Stale-While-Revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => { /* ignore offline fetch errors */ });

        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // If offline and request is HTML, return index page
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
