import { collection, doc, onSnapshot, query, where } from 'firebase/firestore'
import { auth, db } from './config.js'

// Group calls — see backend/src/controllers/groupCallController.js. Every
// change goes through the API; Firestore is only read here.
export const MAX_GROUP_CALL_MEMBERS = 8
// Mirrors the backend's RING_TIMEOUT_MS: an older invitation no longer rings.
const RING_TIMEOUT_MS = 45 * 1000

async function api(path, body) {
  const idToken = await auth.currentUser?.getIdToken()
  const res = await fetch(`/api/group-calls${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body || {}),
  }).catch(() => null)
  const data = await res?.json().catch(() => null)
  if (!res?.ok) throw new Error(data?.message || 'Connexion impossible, réessayez.')
  return data
}

export const createGroupCall = (type, inviteeIds) => api('', { type, inviteeIds })
export const inviteToGroupCall = (callId, inviteeIds) => api(`/${callId}/invite`, { inviteeIds })
export const joinGroupCall = (callId) => api(`/${callId}/join`) // → { url, token }
export const declineGroupCall = (callId) => api(`/${callId}/decline`)
export const leaveGroupCall = (callId) => api(`/${callId}/leave`)

// false until the LiveKit media server is set up on the VPS.
export async function fetchGroupCallsAvailable() {
  const idToken = await auth.currentUser?.getIdToken()
  const res = await fetch('/api/group-calls/status', { headers: { Authorization: `Bearer ${idToken}` } }).catch(() => null)
  const data = await res?.json().catch(() => null)
  return !!data?.available
}

// Invitations ringing for this user right now (newest first).
export function subscribeToGroupInvites(uid, cb) {
  const q = query(collection(db, 'groupCalls'), where('ringing', 'array-contains', uid))
  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now()
      const invites = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => c.status === 'active' && now - (c.invitedAt?.[uid] || 0) < RING_TIMEOUT_MS)
        .sort((a, b) => (b.invitedAt?.[uid] || 0) - (a.invitedAt?.[uid] || 0))
      cb(invites)
    },
    () => cb([]),
  )
}

export function subscribeToGroupCall(callId, cb) {
  return onSnapshot(
    doc(db, 'groupCalls', callId),
    (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    () => cb(null),
  )
}
