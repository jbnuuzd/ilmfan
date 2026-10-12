'use strict';
// Ilmiy yuksalish — oddiy PWA service worker: ilova qobig'i keshlanadi, /api/* hech qachon keshlanmaydi.
const CACHE = 'iy-shell-v1';
const SHELL = ['/', '/styles.css', '/app.js', '/i18n.js', '/i18n-ru-ui.js', '/i18n-ru-content.js', '/i18n-ru-data.js', '/icon.svg', '/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  // tarmoq birinchi (yangi versiya ko'rinsin), oflaynda kesh
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('/') : Response.error()))));
});
