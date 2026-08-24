const CACHE = 'gibweather-shell-v15-1';
const OBSERVATION_CACHE_KEY = './data/lxgb-observation.json';
const APP_SHELL = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest', './version.json',
  './data/lxgb-observation.json', './icons/icon-192-v2.png', './icons/icon-512-v2.png', './icons/icon-180-v2.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Forecast/radar/map APIs manage their own network behaviour in app.js or the browser image loader.
  if (url.hostname.endsWith('open-meteo.com') || url.hostname.endsWith('rainviewer.com') || url.hostname === 'tile.openstreetmap.org') return;

  // Airport observation changes independently of the app shell. Always try the
  // network first, cache only the latest canonical copy, then fall back offline.
  if (url.pathname.endsWith('/data/lxgb-observation.json')) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(OBSERVATION_CACHE_KEY, clone));
        }
        return response;
      }).catch(() => caches.match(OBSERVATION_CACHE_KEY))
    );
    return;
  }

  const isNavigation = event.request.mode === 'navigate';
  if (isNavigation) {
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put('./index.html', clone));
        return response;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
      if (!response || response.status !== 200 || response.type === 'opaque') return response;
      const clone = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, clone));
      return response;
    }))
  );
});
