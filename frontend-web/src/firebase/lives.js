import { collection, doc, limitToLast, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { auth, db } from './config.js'

// Lives — see backend/src/controllers/liveController.js. Every change goes
// through the API; Firestore is only read here.

async function api(path, { method = 'POST', body } = {}) {
  const idToken = await auth.currentUser?.getIdToken()
  const res = await fetch(`/api/lives${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) }),
  }).catch(() => null)
  const data = await res?.json().catch(() => null)
  if (!res?.ok) {
    const err = new Error(data?.message || 'Connexion impossible, réessayez.')
    err.code = data?.code || null
    throw err
  }
  return data
}

export const fetchLivesAvailable = () => api('/status', { method: 'GET' }).then((d) => !!d.available).catch(() => false)
export const startLive = (title) => api('', { body: { title } }) // → { liveId }
export const joinLive = (liveId) => api(`/${liveId}/join`) // → { url, token, isHost }
export const endLive = (liveId) => api(`/${liveId}/end`)
export const commentLive = (liveId, text) => api(`/${liveId}/comments`, { body: { text } })

// Lives on right now, most watched first.
export function subscribeToLivesNow(cb) {
  return onSnapshot(
    query(collection(db, 'lives'), where('status', '==', 'live')),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.viewers || 0) - (a.viewers || 0))),
    () => cb([]),
  )
}

export function subscribeToLive(liveId, cb) {
  return onSnapshot(
    doc(db, 'lives', liveId),
    (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    () => cb(null),
  )
}

export function subscribeToLiveComments(liveId, cb) {
  return onSnapshot(
    query(collection(db, 'lives', liveId, 'comments'), orderBy('createdAt', 'asc'), limitToLast(40)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([]),
  )
}
