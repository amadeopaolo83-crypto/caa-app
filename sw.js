/* sw.js — funzionamento offline. Cambia VERSIONE ogni volta che aggiorni i file dell'app. */
const VERSIONE = 'caa-v2';
const GUSCIO = ['./', 'index.html', 'style.css', 'core.js', 'comunica.js', 'terapista.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
const EXT = 'caa-ext';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSIONE).then(c => Promise.all(GUSCIO.map(u => c.add(u).catch(() => { })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.indexOf('caa-v') === 0 && k !== VERSIONE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // file dell'app: dalla cache, aggiornati in background
    e.respondWith(caches.open(VERSIONE).then(c => c.match(req, { ignoreSearch: true }).then(hit => {
      const net = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })));
  } else if (url.hostname === 'static.arasaac.org') {
    // immagini: prima la cache
    e.respondWith(caches.open(EXT).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { c.put(req, r.clone()); return r; }))));
  } else if (url.hostname === 'api.arasaac.org') {
    // ricerche: prima la rete, poi la cache
    e.respondWith(caches.open(EXT).then(c => fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => c.match(req))));
  }
});
