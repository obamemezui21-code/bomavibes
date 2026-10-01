import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './config.js'

const millis = (t) => (typeof t?.toMillis === 'function' ? t.toMillis() : 0)

// Published venues, newest first. The status filter has to be in the query:
// Firestore rules are not filters, so for a regular user a query that could
// return a single draft is rejected as a whole. Sorted here rather than with
// orderBy, which would need a composite (status, createdAt) index.
export async function fetchPublishedVenues() {
  const snap = await getDocs(query(collection(db, 'venues'), where('status', '==', 'published')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => millis(b.createdAt) - millis(a.createdAt))
}
