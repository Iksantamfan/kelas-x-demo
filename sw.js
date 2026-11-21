// Service worker Kelas X: bikin website bisa di-install (PWA) + notifikasi push.
//
// - Navigasi: network-first, jatuh ke cache '/' kalau offline.
// - Aset /assets/* (nama file ber-hash): cache-first.
// - API Supabase TIDAK di-cache (beda origin, jadi memang tidak tersentuh).
// - Push: tampilkan notifikasi dari Edge Function send-push; klik membuka URL-nya.
const VERSI_CACHE = 'kelasx-v25'
const ASET_CACHE = 'kelasx-aset-v23'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSI_CACHE)
      .then((cache) => cache.add('/'))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== VERSI_CACHE && key !== ASET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Aset build (nama file ber-hash): cache-first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASET_CACHE).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) void cache.put(req, res.clone())
        return res
      }),
    )
    return
  }

  // Navigasi (perpindahan halaman SPA): network-first, offline pakai cache.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(async (res) => {
          const cache = await caches.open(VERSI_CACHE)
          if (res.ok) void cache.put('/', res.clone())
          return res
        })
        .catch(async () => {
          const cache = await caches.open(VERSI_CACHE)
          const hit = await cache.match('/')
          return hit ?? Response.error()
        }),
    )
  }
})

self.addEventListener('push', (event) => {
  let data = { title: 'Kelas X', body: 'Ada info baru di website kelas.', url: '/' }
  try {
    if (event.data) {
      const parsed = event.data.json()
      data = {
        title: typeof parsed.title === 'string' ? parsed.title : data.title,
        body: typeof parsed.body === 'string' ? parsed.body : data.body,
        url: typeof parsed.url === 'string' ? parsed.url : data.url,
      }
    }
  } catch {
    // Pakai data default di atas kalau payload tidak bisa dibaca.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'kelasx-info',
      renotify: true,
      data: { url: data.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((daftar) => {
        const target = new URL(url, self.location.origin).href
        for (const klien of daftar) {
          if (klien.url === target && 'focus' in klien) return klien.focus()
        }
        return self.clients.openWindow(url)
      }),
  )
})
