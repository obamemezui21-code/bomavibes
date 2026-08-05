import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from './config.js'

export async function reportUser(reporterId, reportedUserId, reason, description) {
  await addDoc(collection(db, 'reports'), {
    reporterId,
    reportedUserId,
    reason,
    description: description || null,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
}

export async function blockUser(blockerId, blockedId) {
  await setDoc(doc(db, 'blocks', `${blockerId}_${blockedId}`), {
    blockerId,
    blockedId,
    createdAt: serverTimestamp(),
  })
}

export async function unblockUser(blockerId, blockedId) {
  await deleteDoc(doc(db, 'blocks', `${blockerId}_${blockedId}`))
}

// Every uid this user has blocked, or that has blocked this user — either
// direction should hide the two people from each other everywhere.
export async function fetchBlockedIds(uid) {
  const [blockedByMe, blockingMe] = await Promise.all([
    getDocs(query(collection(db, 'blocks'), where('blockerId', '==', uid))),
    getDocs(query(collection(db, 'blocks'), where('blockedId', '==', uid))),
  ])
  const ids = new Set()
  blockedByMe.docs.forEach((d) => ids.add(d.data().blockedId))
  blockingMe.docs.forEach((d) => ids.add(d.data().blockerId))
  return ids
}

// Only the people this user has actively blocked (for an "unblock" list —
// unlike fetchBlockedIds, this excludes people who blocked this user).
export async function fetchMyBlockedIds(uid) {
  const snap = await getDocs(query(collection(db, 'blocks'), where('blockerId', '==', uid)))
  return snap.docs.map((d) => d.data().blockedId)
}
