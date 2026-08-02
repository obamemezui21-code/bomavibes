import { collection, getDocs, limit, query, startAfter, where } from 'firebase/firestore'
import { db } from './config.js'

const BATCH_SIZE = 30
const MAX_PAGES = 3
const MIN_CANDIDATES = 10

async function getSwipedIds(uid) {
  const snap = await getDocs(query(collection(db, 'swipes'), where('swiperId', '==', uid)))
  return new Set(snap.docs.map((d) => d.data().targetId))
}

export async function fetchDiscoverCandidates(uid, filters) {
  const swipedIds = await getSwipedIds(uid)
  const candidates = []
  let lastDoc = null

  for (let page = 0; page < MAX_PAGES; page++) {
    const constraints = []
    if (filters.gender && filters.gender !== 'TOUS') {
      constraints.push(where('gender', '==', filters.gender))
    }
    if (lastDoc) constraints.push(startAfter(lastDoc))
    constraints.push(limit(BATCH_SIZE))

    const snap = await getDocs(query(collection(db, 'profiles'), ...constraints))
    if (snap.empty) break
    lastDoc = snap.docs[snap.docs.length - 1]

    for (const docSnap of snap.docs) {
      const id = docSnap.id
      if (id === uid || swipedIds.has(id)) continue
      const data = docSnap.data()
      if (filters.minAge != null && data.age != null && data.age < filters.minAge) continue
      if (filters.maxAge != null && data.age != null && data.age > filters.maxAge) continue
      candidates.push({ id, ...data })
    }

    if (candidates.length >= MIN_CANDIDATES || snap.docs.length < BATCH_SIZE) break
  }

  return candidates
}
