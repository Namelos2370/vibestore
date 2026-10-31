// Service worker VibeStore : garde l'interface hors ligne, ne met jamais l'audio en cache.
const CACHE = 'vibestore-shell-v1'
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png'])))
  self.skipWaiting()
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin) return
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/')))
    return
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && /\.(js|css|woff2?|png|jpg|svg)$/.test(url.pathname)) {
        const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy))
      }
      return res
    }))
  )
})
