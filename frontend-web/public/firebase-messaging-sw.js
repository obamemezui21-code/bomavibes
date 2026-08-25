importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyB-Z6Txp7GBbNEKYr5KmrH5bT8TKQPtFOE',
  authDomain: 'bomavibes-cd139.firebaseapp.com',
  projectId: 'bomavibes-cd139',
  storageBucket: 'bomavibes-cd139.firebasestorage.app',
  messagingSenderId: '463929414106',
  appId: '1:463929414106:web:3cd8b8df8ed840e90570e3',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {}
  self.registration.showNotification(title || 'BomaVibes', {
    body: body || '',
    icon: '/bomavibes-logo.jpeg',
    // Carried through to the notificationclick handler below — lets it
    // route to the right conversation instead of just opening the app.
    data: payload.data || {},
  })
})

// Implementing onBackgroundMessage ourselves means FCM's built-in
// click-to-link behavior (webpush.fcmOptions.link) no longer fires
// automatically, so this replaces it: focus an already-open tab and hand
// it the destination (see the service-worker message listener in App.jsx),
// or open a fresh one if the app isn't open anywhere.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const conversationId = event.notification.data?.conversationId
  const url = conversationId ? `/chat/${conversationId}` : '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.postMessage({ type: 'notification-click', url })
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
      return undefined
    }),
  )
})
