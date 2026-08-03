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
  })
})
