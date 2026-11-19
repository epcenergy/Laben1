/* EPC service worker: λειτουργία χωρίς internet.
 * Σε κάθε νέα έκδοση αλλάξτε το CACHE (π.χ. panellabels-1.11.2) ώστε οι συσκευές να πάρουν τα νέα αρχεία.
 * Με internet: παίρνει πάντα τα τελευταία αρχεία από το GitHub (network-first).
 * Χωρίς internet: δουλεύει από την αποθηκευμένη αντιγραφή. */
const CACHE = 'panellabels-1.11.1';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './render.js', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './apple-touch-icon.png', './favicon-32.png', './logo-128.png'
];
self.addEventListener('install', e => {
  // cache: 'reload' = κατευθείαν από τον server, όχι από παλιά αντίγραφα του browser
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.all(ASSETS.map(u => fetch(new Request(u, { cache: 'reload' })).then(r => { if (r.ok) return c.put(u, r); }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function fromNetwork(req) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 5000);
    fetch(req, { cache: 'no-cache' }).then(res => {
      clearTimeout(timer);
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      resolve(res);
    }, err => { clearTimeout(timer); reject(err); });
  });
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isImage = /\.(png|jpe?g|svg|ico)$/i.test(new URL(req.url).pathname);
  if (isImage) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(c => c || fromNetwork(req)));
    return;
  }
  // σελίδα, κώδικας, στυλ: πρώτα το δίκτυο (νέα έκδοση αμέσως), αλλιώς η αποθηκευμένη
  e.respondWith(fromNetwork(req).catch(() =>
    caches.match(req, { ignoreSearch: true }).then(c => c || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))));
});
