import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from './config.js'

// Audio/video calls: WebRTC media, with Firestore as the signaling channel.
//
// calls/{callId}
//   callerId, calleeId, matchId, type ('audio' | 'video'),
//   status: 'ringing' → 'accepted' → 'ended'
//           'ringing' → 'declined' | 'missed' | 'busy' | 'cancelled'
//   offer / answer ({ type, sdp }), caller/callee display info,
//   createdAt, answeredAt, endedAt
// calls/{callId}/callerCandidates, calls/{callId}/calleeCandidates
//   ICE candidates each side publishes for the other.

export const RING_TIMEOUT_MS = 40 * 1000

const FALLBACK_ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]

// STUN + short-lived TURN credentials from our backend (see
// backend/src/controllers/callController.js). Falls back to public STUN so a
// backend hiccup degrades calls instead of blocking them.
export async function fetchIceServers() {
  try {
    const idToken = await auth.currentUser?.getIdToken()
    const res = await fetch('/api/calls/ice-servers', { headers: { Authorization: `Bearer ${idToken}` } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { iceServers } = await res.json()
    return iceServers?.length ? iceServers : FALLBACK_ICE_SERVERS
  } catch {
    return FALLBACK_ICE_SERVERS
  }
}

export async function createCall({ callerId, calleeId, matchId, type, offer, caller, callee }) {
  const ref = await addDoc(collection(db, 'calls'), {
    callerId,
    calleeId,
    matchId,
    type,
    status: 'ringing',
    offer,
    callerName: caller.firstName || '',
    callerPhoto: caller.photo || null,
    calleeName: callee.firstName || '',
    calleePhoto: callee.photo || null,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export function answerCall(callId, answer) {
  return updateDoc(doc(db, 'calls', callId), { answer, status: 'accepted', answeredAt: serverTimestamp() })
}

export function setCallStatus(callId, status) {
  return updateDoc(doc(db, 'calls', callId), { status, endedAt: serverTimestamp() })
}

export function addCandidate(callId, role, candidate) {
  const json = candidate.toJSON()
  // Firestore rejects `undefined` fields, which some browsers leave here.
  return addDoc(collection(db, 'calls', callId, role === 'caller' ? 'callerCandidates' : 'calleeCandidates'), {
    candidate: json.candidate ?? '',
    sdpMid: json.sdpMid ?? null,
    sdpMLineIndex: json.sdpMLineIndex ?? null,
    usernameFragment: json.usernameFragment ?? null,
    createdAt: serverTimestamp(),
  })
}

// Candidates published by the *other* side.
export function subscribeToRemoteCandidates(callId, role, onCandidate) {
  const sub = role === 'caller' ? 'calleeCandidates' : 'callerCandidates'
  return onSnapshot(collection(db, 'calls', callId, sub), (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type !== 'added') return
      const { candidate, sdpMid, sdpMLineIndex, usernameFragment } = change.doc.data()
      onCandidate({ candidate, sdpMid, sdpMLineIndex, usernameFragment })
    })
  })
}

export function subscribeToCall(callId, onChange) {
  return onSnapshot(doc(db, 'calls', callId), (snap) => {
    if (snap.exists()) onChange({ id: snap.id, ...snap.data() })
  })
}

// Calls ringing for this user. Stale "ringing" docs (caller's tab died before
// it could mark the call missed) are filtered out by age.
export function subscribeToIncomingCalls(uid, onCalls) {
  const q = query(collection(db, 'calls'), where('calleeId', '==', uid), where('status', '==', 'ringing'))
  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now()
      const calls = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => {
          const created = c.createdAt?.toMillis?.()
          // Pending server timestamp (just created) counts as fresh.
          return !created || now - created < RING_TIMEOUT_MS + 5000
        })
      onCalls(calls)
    },
    () => onCalls([]),
  )
}
