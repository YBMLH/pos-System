/* Kaftan Store Manager — service worker.
   Caches the app shell so the app opens with NO internet after the first visit.
   Strategy: serve from cache instantly, refresh the cache in the background
   (stale-while-revalidate) — updates apply on the next launch.

   It handles the shell and nothing else. An earlier version answered every GET
   the page made, including calls to the cloud mirror, and matched them with
   ignoreSearch — so one cached reply was served for every later call to the
   same path whatever its query string, and the owner's live page would sit
   frozen on the first answer it ever got. Live data must never come from here. */
const CACHE = 'kaftan-shell-v2';
const SHELL = ['./', './index.html', './live.html'];
// The shell is these pages and nothing more. Everything else — above all
// another origin — goes straight to the network, untouched.
const SHELL_PATH = /(^|\/)(index\.html|live\.html)$|\/$/;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // One missing file must not abandon the whole cache, which is what
      // addAll does: the app would then never work offline at all.
      .then(c => Promise.all(SHELL.map(p => c.add(p).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  let url;
  try { url = new URL(e.request.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;                 // not ours to answer
  if (e.request.mode !== 'navigate' && !SHELL_PATH.test(url.pathname)) return;
  e.respondWith(
    // ignoreSearch is safe here and only here: the shell carries no query
    // string that changes what comes back.
    caches.match(e.request, { ignoreSearch: true }).then(cached => {
      const fresh = fetch(e.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached); // offline: fall back to cache
      return cached || fresh;   // cached shell wins; network only when uncached
    })
  );
});
