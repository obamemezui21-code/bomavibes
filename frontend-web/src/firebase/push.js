import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore'
import app, { VAPID_KEY, db } from './config.js'

// Firestore (`users/{uid}.fcmTokens`) is the only authoritative record of
// which tokens are valid for a user — this just remembers what THIS browser
// last synced, so a silent sync on every load doesn't rewrite the doc when
// nothing changed. Losing it just costs one extra write, never correctness.
const LAST_SYNCED_TOKEN_KEY = 'bomavibes-fcm-token'

let messagingInstance = null

async function getMessagingInstance() {
  if (messagingInstance !== null) return messagingInstance
  const supported = await isSupported().catch(() => false)
  messagingInstance = supported ? getMessaging(app) : false
  return messagingInstance
}

function readCachedToken() {
  try {
    return localStorage.getItem(LAST_SYNCED_TOKEN_KEY)
  } catch {
    return null
  }
}

function writeCachedToken(token) {
  try {
    if (token) localStorage.setItem(LAST_SYNCED_TOKEN_KEY, token)
    else localStorage.removeItem(LAST_SYNCED_TOKEN_KEY)
  } catch {
    // Private browsing / storage disabled — Firestore write below still
    // went through, so the token is safely registered either way.
  }
}

// Shared by enablePushForUser (explicit opt-in) and syncPushToken (silent
// refresh): registers the service worker — a no-op if already registered —
// and asks FCM for this device's current token.
async function requestDeviceToken() {
  const messaging = await getMessagingInstance()
  if (!messaging) throw new Error('Les notifications push ne sont pas supportées sur ce navigateur.')

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
  if (!token) throw new Error("Impossible d'obtenir un token de notification.")
  return token
}

// Reconciles Firestore with the token FCM just handed back for this device:
// registers it if new, and — only when we're sure it replaces a token we
// ourselves registered on this exact browser — drops the stale one so a
// rotated token doesn't leave dead entries for the reactive cleanup in
// notifyController.js to eventually prune on a failed send.
async function persistTokenIfChanged(uid, token) {
  const previous = readCachedToken()
  if (previous === token) return token

  const ref = doc(db, 'users', uid)
  if (previous && previous !== token) {
    await updateDoc(ref, { fcmTokens: arrayRemove(previous) }).catch(() => {})
  }
  await updateDoc(ref, { fcmTokens: arrayUnion(token) })
  writeCachedToken(token)
  return token
}

export async function enablePushForUser(uid) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permission de notification refusée.')

  const token = await requestDeviceToken()
  return persistTokenIfChanged(uid, token)
}

// Call on every authenticated app load. Never prompts — if permission was
// never granted (or was denied) this silently does nothing, so it's always
// safe to call alongside the explicit opt-in prompt without duplicating it.
export async function syncPushToken(uid) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null
  try {
    const token = await requestDeviceToken()
    return await persistTokenIfChanged(uid, token)
  } catch {
    return null
  }
}

export async function disablePushForUser(uid, token) {
  if (!token) return
  await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(token) })
  if (readCachedToken() === token) writeCachedToken(null)
}

export async function listenForegroundMessages(callback) {
  const messaging = await getMessagingInstance()
  if (!messaging) return () => {}
  return onMessage(messaging, callback)
}
