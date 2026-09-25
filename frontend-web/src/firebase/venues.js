import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from './config.js'

// No `where('status', '==', 'published')` clause needed: firestore.rules
// already filters out drafts per-document for anyone who isn't an Editor/
// Admin/Super Admin, same pattern as fetchPublishedEvents.
export async function fetchPublishedVenues() {
  const q = query(collection(db, 'venues'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
