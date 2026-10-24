/* Offline support. Bump VERSION after editing the menu so phones pick up the new files. */
const VERSION = 'aplus-v2';
const SHELL = ['./', 'index.html', 'complaints.html', 'logo.svg', 'manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* Pages: network first, so price changes show up as soon as there is signal.
   Photos and the rest: show the saved copy at once and refresh it in the background,
   so a photo replaced in the studio appears on the next visit. */
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  /* the photo studio talks to the server directly and previews exact versions (?v=) */
  if (url.origin === location.origin && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin') || url.searchParams.has('v'))) return;
  const keep = res => {
    if (res && (res.ok || res.type === 'opaque')) {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy));
    }
    return res;
  };
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(keep).catch(() =>
      caches.match(req, {ignoreSearch: true}).then(r => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const fresh = fetch(req).then(keep);
    if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
    return fresh;
  }));
});
