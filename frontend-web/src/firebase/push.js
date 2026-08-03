import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore'
import app, { VAPID_KEY, db } from './config.js'

let messagingInstance = null

async function getMessagingInstance() {
  if (messagingInstance !== null) return messagingInstance
  const supported = await isSupported().catch(() => false)
  messagingInstance = supported ? getMessaging(app) : false
  return messagingInstance
}

export async function enablePushForUser(uid) {
  const messaging = await getMessagingInstance()
  if (!messaging) throw new Error('Les notifications push ne sont pas supportées sur ce navigateur.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permission de notification refusée.')

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
  if (!token) throw new Error("Impossible d'obtenir un token de notification.")

  await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) })
  return token
}

export async function disablePushForUser(uid, token) {
  if (!token) return
  await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(token) })
}

export async function listenForegroundMessages(callback) {
  const messaging = await getMessagingInstance()
  if (!messaging) return () => {}
  return onMessage(messaging, callback)
}
