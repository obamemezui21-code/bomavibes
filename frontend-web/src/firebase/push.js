import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore'
import app, { VAPID_KEY, db } from './config.js'

// Firestore (`users/{uid}.fcmTokens`) is the only authoritative record of
// which tokens are valid for a user — this just remembers what THIS browser
// last synced, so a silent sync on every load doesn't rewrite the doc when
// nothing changed. Losing it just costs one extra write, never correctness.
const LAST_SYNCED_TOKEN_KEY = 'bomavibes-fcm-token'

let messagingInstance = null

// Loaded on demand: most page loads never touch push, and this file is part of
// what every visitor downloads.
const loadMessaging = () => import('firebase/messaging')

async function getMessagingInstance() {
  if (messagingInstance !== null) return messagingInstance
  const { getMessaging, isSupported } = await loadMessaging()
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
  const { getToken } = await loadMessaging()
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration })
  if (!token) throw new Error("Impossible d'obtenir un token de notification.")
  return token
}

// Reconciles Firestore with the token FCM just handed back for this device:
// registers it if new, and — only when we're sure it replaces a token we
// ourselves registered on this exact browser — drops the stale one so a
// rotated token doesn't leave dead entries for the reactive cleanup in
// notifyController.js to eventually prune on a failed send.
// `known`: the account's tokens, when loaded. What this browser remembers isn't
// enough: the server may have dropped the token since, or another account
// may have registered it, and this device would never be notified again.
async function persistTokenIfChanged(uid, token, known) {
  const previous = readCachedToken()
  if (previous === token && known?.includes(token)) return token

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
export async function syncPushToken(uid, known) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null
  try {
    const token = await requestDeviceToken()
    return await persistTokenIfChanged(uid, token, known)
  } catch {
    return null
  }
}

// Signing out: this device no longer shows (nor counts on its icon) the
// account's messages. Best effort, never holds the signing out for long.
const SIGN_OUT_WAIT_MS = 2000

export async function forgetDevice(uid) {
  const token = readCachedToken()
  if (!uid || !token) return
  writeCachedToken(null)
  const removed = updateDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(token) }).catch(() => {})
  await Promise.race([removed, new Promise((resolve) => setTimeout(resolve, SIGN_OUT_WAIT_MS))])
}

// This device's answer: 'granted', 'denied', 'default' (not asked yet) or
// 'unsupported' (e.g. iPhone before the app is on the home screen).
export function pushPermission() {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

export async function listenForegroundMessages(callback) {
  const messaging = await getMessagingInstance()
  if (!messaging) return () => {}
  const { onMessage } = await loadMessaging()
  return onMessage(messaging, callback)
}
