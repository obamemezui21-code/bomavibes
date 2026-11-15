// BomaVibes' one service worker: makes the site installable and steadier on a
// weak connection, and receives the push notifications (Firebase Cloud
// Messaging). A scope holds a single service worker, so both jobs live here,
// under the name FCM has always used (/firebase-messaging-sw.js): devices that
// already turned notifications on keep their subscription and their token.
//
// Built by vite-plugin-pwa (vite.config.js), which fills self.__WB_MANIFEST.
//
// What goes through the cache, and what never does:
// - pages: network first, so a member online always gets the current version;
//   the copy kept here only answers when the network fails or takes too long;
// - /assets/*: files whose name holds their content's hash, so a copy is never
//   out of date; kept as they're used (the whole app is ~5 MB of code, too much
//   to download up front on a phone plan);
// - never: /api, /uploads (members' photos), audio and video, and anything on
//   another site (Firebase Auth, Firestore, Storage, LiveKit, TURN…), which the
//   worker leaves to the browser untouched.
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, matchPrecache, precache } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'
import { firebaseConfig } from './firebase/options.js'
import { addUnread, badgeKeyOf } from './lib/appBadge.js'

const ICON = '/icons/icon-192.png'
const SHELL = '/index.html'
// Past this, a page request is answered from the copy kept here (if any):
// a member on a weak signal gets the app instead of a blank screen.
const PAGE_TIMEOUT_MS = 4000
// Played by <audio>/<video> with range requests, which a cached copy can't
// answer (Safari then refuses to play): left to the browser.
const MEDIA = /\.(mp3|m4a|aac|ogg|oga|wav|mp4|webm|mov)$/i

// ---- Notifications ------------------------------------------------------
//
// Added before getMessaging() below, which adds Firebase's own listeners:
// this one runs first, and stops Firebase's from opening a second window.

// Where a tapped notification leads: the conversation for a message or a
// call, otherwise the page the server named (webpush.fcmOptions.link, or
// data.url for a message sent without a `notification` block).
function destinationOf(notification) {
  const fcm = notification.data?.FCM_MSG
  const data = (fcm ? fcm.data : notification.data) || {}
  if (data.conversationId) return `/chat/${data.conversationId}`
  const link = data.url || fcm?.fcmOptions?.link
  if (link) {
    try {
      const url = new URL(link, self.location.origin)
      // Never somewhere else than BomaVibes.
      if (url.origin === self.location.origin) return url.pathname + url.search + url.hash
    } catch {
      // Malformed link: the home page below.
    }
  }
  return '/'
}

self.addEventListener('notificationclick', (event) => {
  event.stopImmediatePropagation()
  event.notification.close()
  const path = destinationOf(event.notification)

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // The window the member last looked at, if one is open: it's told where
      // to go (see the service-worker message listener in App.jsx) rather
      // than reloaded, so a call or a half-typed message there survives.
      const open = windows.find((w) => w.focused) || windows.find((w) => w.visibilityState === 'visible') || windows[0]
      if (open) {
        open.postMessage({ type: 'notification-click', url: path })
        try {
          return await open.focus()
        } catch {
          // Some browsers refuse focus(): a fresh window instead.
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(path) : undefined
    })(),
  )
})

const messaging = getMessaging(initializeApp(firebaseConfig))

// The backend's notifications carry a `notification` block, which Firebase
// already shows by itself when no BomaVibes window is on screen (with an open
// one, it hands the message to the page instead). Showing it here too used to
// make every notification appear twice. This only shows data-only messages.
// Each notification shown also adds to the red counter on the installed app's
// icon (lib/appBadge.js); the app sets the exact count again once opened.
onBackgroundMessage(messaging, (payload) => {
  if (payload.notification) return addUnread(badgeKeyOf(payload))
  const data = payload.data || {}
  if (!data.title && !data.body) return undefined
  return Promise.all([
    addUnread(badgeKeyOf(payload)),
    self.registration.showNotification(data.title || 'BomaVibes', {
      body: data.body || '',
      icon: data.icon || ICON,
      // One notification per conversation/call, replaced rather than stacked.
      tag: data.tag || undefined,
      renotify: !!data.tag,
      data,
    }),
  ])
})

// ---- Installable app and offline ---------------------------------------

// A new version waits until the member accepts it (UpdatePrompt.jsx), so a
// page in use is never swapped mid-call or mid-message.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
clientsClaim()

// Small: the page itself (for when the network fails), the manifest and the
// icons. Kept per version, the previous version's copies are dropped.
precache(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// No navigation preload: it would also fire for the pages left to the
// browser below (an e-mail's /api/... action link), sending them twice.

function within(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

registerRoute(
  new NavigationRoute(
    async ({ request }) => {
      const fromNetwork = fetch(request)
      try {
        const response = await within(fromNetwork, PAGE_TIMEOUT_MS)
        if (response.status < 500) return response
      } catch {
        // Offline or too slow: the copy below.
      }
      return (await matchPrecache(SHELL)) || fromNetwork
    },
    // Served by the backend, or files: never answered with the app's page.
    { denylist: [/^\/api\//, /^\/uploads\//, /^\/__\//, /\/[^/?]+\.[^/?]+$/] },
  ),
)

registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    url.pathname.startsWith('/assets/') &&
    !MEDIA.test(url.pathname) &&
    !request.headers.has('range'),
  new CacheFirst({
    cacheName: 'bv-assets',
    plugins: [
      {
        // Only a real file: a missing one answered with the app's page (or
        // an error) must not stay cached under that file's name.
        cacheWillUpdate: async ({ response }) =>
          response.status === 200 && !(response.headers.get('content-type') || '').includes('text/html') ? response : null,
      },
      new ExpirationPlugin({ maxEntries: 600, maxAgeSeconds: 60 * 24 * 60 * 60, purgeOnQuotaError: true }),
    ],
  }),
)
