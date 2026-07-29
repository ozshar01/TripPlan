const CACHE = 'japan-trip-shell-v4';
const DATA_FILE = 'data/trip-data.js';
const ASSETS = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/sheets-sync.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Network-first for everything: always try the server first so edits show up
// immediately. Only fall back to the cached copy when offline.
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function networkFirstData(request) {
  const cache = await caches.open(CACHE);
  try {
    const url = new URL(request.url);
    url.searchParams.set('_refresh', Date.now().toString());
    const response = await fetch(url.toString(), { cache: 'no-store' });
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // let cross-origin calls (e.g. Sheets API) pass through normally

  if (url.pathname.endsWith('/' + DATA_FILE)) {
    event.respondWith(networkFirstData(event.request));
    return;
  }

  event.respondWith(networkFirst(event.request));
});

// Let the page ask the waiting worker to activate immediately (see app.js).
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
