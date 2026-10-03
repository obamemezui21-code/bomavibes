import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './config.js'

// No `where('actif', '==', true)` combined with the `orderBy('ordre')` below
// — that pairing (equality filter + orderBy on a different field) needs a
// Firestore composite index this repo has no pipeline to deploy (same
// lesson as events/tickets elsewhere in this app). Sorted by Firestore,
// filtered to active partners in JS instead.
// categorie: 'ia' (Studio IA) or 'streaming' (Ciné & Séries); partners
// without one are older Studio IA entries.
export async function fetchActiveAiPartners(categorie = 'ia') {
  const q = query(collection(db, 'aiPartners'), orderBy('ordre', 'asc'))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.actif && (p.categorie || 'ia') === categorie)
}

// Fire-and-forget: never awaited before opening the affiliate link, and
// errors are swallowed — a failed click log must never stop the user from
// reaching the partner's site.
export function recordAiPartnerClick(partnerId) {
  addDoc(collection(db, 'aiClicks'), {
    partnerId,
    userId: auth.currentUser?.uid || null,
    date: serverTimestamp(),
  }).catch(() => {})
}
