import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from './config.js'
import { sendPushNotification } from './notify.js'

export async function countIncomingLikes(uid) {
  const snap = await getDocs(
    query(collection(db, 'swipes'), where('targetId', '==', uid), where('direction', 'in', ['like', 'superlike'])),
  )
  return snap.size
}

export async function recordSwipeAndMatch(uid, targetId, direction, firstName) {
  await setDoc(doc(db, 'swipes', `${uid}_${targetId}`), {
    swiperId: uid,
    targetId,
    direction,
    createdAt: serverTimestamp(),
  })

  if (direction === 'pass') return null

  const reciprocal = await getDoc(doc(db, 'swipes', `${targetId}_${uid}`))
  const reciprocalLiked = reciprocal.exists() && ['like', 'superlike'].includes(reciprocal.data().direction)
  if (!reciprocalLiked) return null

  const matchId = [uid, targetId].sort().join('_')
  const matchRef = doc(db, 'matches', matchId)

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(matchRef)
    if (existing.exists()) return
    tx.set(matchRef, {
      users: [uid, targetId].sort(),
      createdAt: serverTimestamp(),
      lastMessage: null,
      lastMessageAt: serverTimestamp(),
      seen: { [uid]: true, [targetId]: false },
    })
  })

  sendPushNotification(targetId, 'match', { firstName })

  return matchId
}
