import { collection, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from './config.js'

// Published events, soonest first. The status filter has to be in the
// query: Firestore rules are not filters, so for a regular user a query
// that could return a single draft is rejected as a whole. Sorted here
// (dates are "YYYY-MM-DD" strings) rather than with orderBy, which would
// need a composite (status, date) index.
export async function fetchPublishedEvents() {
  const snap = await getDocs(query(collection(db, 'events'), where('status', '==', 'published')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
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
