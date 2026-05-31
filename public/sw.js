const VERSION = 'keluargaku-v1'
const APP_SHELL_CACHE = `${VERSION}-app-shell`
const IMAGE_CACHE = `${VERSION}-images`
const OFFLINE_URL = '/offline.html'

const APP_SHELL_ASSETS = [
  '/',
  '/manifest.json',
  OFFLINE_URL,
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_ASSETS)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![APP_SHELL_CACHE, IMAGE_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      ),
    ),
  )
  self.clients.claim()
})

function isImageRequest(request) {
  return request.destination === 'image'
}

function isAppShellRequest(request) {
  return (
    request.mode === 'navigate' ||
    request.destination === 'document' ||
    request.destination === 'script' ||
    request.destination === 'style'
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') {
    return
  }

  if (isImageRequest(request)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(request)
        if (cachedResponse) {
          return cachedResponse
        }

        const networkResponse = await fetch(request)
        cache.put(request, networkResponse.clone())
        return networkResponse
      }),
    )
    return
  }

  if (isAppShellRequest(request)) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          const cache = await caches.open(APP_SHELL_CACHE)
          cache.put(request, response.clone())
          return response
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request)
          if (cachedResponse) {
            return cachedResponse
          }

          if (request.mode === 'navigate') {
            return caches.match(OFFLINE_URL)
          }

          throw new Error('Network unavailable and no cache entry found.')
        }),
    )
  }
})
