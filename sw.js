/* Kaftan Store Manager — service worker.
   Caches the app shell so the app opens with NO internet after the first visit.
   Strategy: serve from cache instantly, refresh the cache in the background
   (stale-while-revalidate) — updates apply on the next launch.

   It handles the shell and nothing else. An early version answered every GET
   the page made, including calls to the cloud mirror, and matched them with
   ignoreSearch — so one cached reply was served for every later call to the
   same path whatever its query string. Live data must never come from here.

   Three rules below exist because breaking any one of them puts a blank screen
   on the shop counter, with reloading no help because the worker keeps
   answering the same way:
     1. never resolve respondWith with nothing;
     2. never take over until this cache can actually serve the app;
     3. never delete the previous cache until this one can.
   A worker holding nothing is worse than no worker at all. */
const CACHE = 'kaftan-shell-v3';
const SHELL = ['./', './index.html', './live.html'];
// The shell is these pages and nothing more. Everything else — above all
// another origin — goes straight to the network, untouched.
const SHELL_PATH = /(^|\/)(index\.html|live\.html)$|\/$/;

// Can this cache actually open the app? The whole point of the worker.
async function shellReady(cache) {
  const c = cache || await caches.open(CACHE);
  return !!(await c.match('./index.html', { ignoreSearch: true })
         || await c.match('./', { ignoreSearch: true }));
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // One missing file must not abandon the whole cache, which is what addAll
    // does — the app would then never work offline at all.
    await Promise.all(SHELL.map(p => c.add(p).catch(() => {})));
    // Take over only once there is something to serve. On a shop PC with no
    // internet at that moment every add fails, and replacing a working worker
    // with an empty one is exactly how the screen goes blank.
    if (await shellReady(c)) await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // Keep the old cache until this one can stand on its own. An older copy of
    // the app opening is always better than no app opening.
    if (await shellReady()) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    }
    await self.clients.claim();
  })());
});

/* Shown only when there is no cached copy AND the network is unreachable.
   Something explaining itself, with a way out, beats a white page. */
function lastResort() {
  return new Response(
    '<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Cannot open the app</title>' +
    '<style>body{font:16px/1.6 system-ui,sans-serif;margin:0;display:grid;place-items:center;' +
    'min-height:100vh;background:#f6f6f4;color:#161614;padding:24px;text-align:center}' +
    'div{max-width:420px}h1{font-size:19px;margin:0 0 10px}p{color:#6c6c66;font-size:14px}' +
    'button{font:inherit;font-weight:700;padding:12px 20px;border:0;border-radius:10px;' +
    'background:#0d3b31;color:#fff;margin:6px 4px;cursor:pointer}</style>' +
    '<div><h1>Cannot open the app</h1>' +
    '<p>There is no saved copy on this computer and the app files cannot be reached right now. ' +
    'Your shop data is untouched — this is only the program itself.</p>' +
    '<p>Connect to the internet and press Reload. If that does not work, press Repair: it clears ' +
    'the saved program files and fetches them again. It does not touch your data.</p>' +
    '<button onclick="location.reload()">Reload</button>' +
    '<button onclick="caches.keys().then(k=>Promise.all(k.map(x=>caches.delete(x))))' +
    '.then(()=>navigator.serviceWorker.getRegistrations())' +
    '.then(r=>Promise.all(r.map(x=>x.unregister())))' +
    '.then(()=>location.reload(true))">Repair</button></div>',
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  let url;
  try { url = new URL(e.request.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;                 // not ours to answer
  if (e.request.mode !== 'navigate' && !SHELL_PATH.test(url.pathname)) return;
  e.respondWith((async () => {
    // caches.match searches every cache, so a previous version's copy still
    // opens the app if this one somehow holds nothing.
    // ignoreSearch is safe here and only here: the shell carries no query
    // string that changes what comes back.
    const cached = await caches.match(e.request, { ignoreSearch: true });
    if (cached) {
      e.waitUntil((async () => {                   // refresh in the background
        try {
          const res = await fetch(e.request);
          if (res && res.ok) (await caches.open(CACHE)).put(e.request, res.clone());
        } catch (_) { /* offline: keep what we have */ }
      })());
      return cached;
    }
    try {
      const res = await fetch(e.request);
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    } catch (_) {
      return lastResort();   // never resolve with nothing
    }
  })());
});
