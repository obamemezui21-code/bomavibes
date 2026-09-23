import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { auth, db } from './config.js'

// No `where('status', '==', 'published')` clause needed: firestore.rules
// already filters out drafts per-document for anyone who isn't an Editor/
// Admin/Super Admin, so a plain orderBy query already returns only what
// the signed-in user is allowed to see.
export async function fetchPublishedEvents() {
  const q = query(collection(db, 'events'), orderBy('date', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

async function authedFetch(path, options = {}) {
  const idToken = await auth.currentUser?.getIdToken()
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}`, ...options.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message || 'request failed')
  }
  return res.json()
}

export function reserveEventTicket(eventId, attendee) {
  return authedFetch(`/api/events/${eventId}/tickets`, { method: 'POST', body: JSON.stringify(attendee) })
}

export function cancelEventTicket(eventId) {
  return authedFetch(`/api/events/${eventId}/tickets`, { method: 'DELETE' })
}

export function fetchMyTickets() {
  return authedFetch('/api/events/tickets/mine')
}
