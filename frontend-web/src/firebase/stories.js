import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from './config.js'
import { batchFetchAuthorProfiles } from './feed.js'

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000

function activeCutoff() {
  return Timestamp.fromMillis(Date.now() - STORY_LIFETIME_MS)
}

function toStory(docSnap) {
  return { id: docSnap.id, ...docSnap.data() }
}

// Live view of every story from the last 24h, newest first. No server job
// prunes expired ones — they simply fall out of this window query on their
// own once older than a day, the same "bounded window, no stored state"
// approach already used for the feed's popular/for-you ranking.
function subscribeToActiveStories(cb) {
  const q = query(collection(db, 'stories'), where('createdAt', '>=', activeCutoff()), orderBy('createdAt', 'desc'))
  return onSnapshot(q, async (snap) => {
    const stories = snap.docs.map(toStory)
    const authorsById = await batchFetchAuthorProfiles(stories.map((s) => s.authorId))
    cb(stories, authorsById)
  })
}

async function createStory(authorId, { type, text, photoUrl, photoThumbUrl, background }) {
  const ref = await addDoc(collection(db, 'stories'), {
    authorId,
    type,
    text: text || null,
    background: background || null,
    photoUrl: photoUrl || null,
    photoThumbUrl: photoThumbUrl || null,
    viewedBy: [],
    createdAt: serverTimestamp(),
  })
  return ref.id
}

async function deleteStory(storyId, authorId) {
  const snap = await getDoc(doc(db, 'stories', storyId))
  if (snap.exists() && snap.data().authorId !== authorId) throw new Error('forbidden')
  await deleteDoc(doc(db, 'stories', storyId))
}

// viewedBy is a plain array on the story doc (not a subcollection) — a story
// only needs a yes/no "have I seen this" per viewer, not a full audit trail,
// so arrayUnion here avoids a second query just to compute the ring color.
async function markStoryViewed(storyId, uid) {
  await updateDoc(doc(db, 'stories', storyId), { viewedBy: arrayUnion(uid) })
}

async function uploadStoryPhoto(file) {
  const idToken = await auth.currentUser?.getIdToken()
  const formData = new FormData()
  formData.append('photo', file)

  const res = await fetch('/api/feed-photos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
    body: formData,
  })
  if (!res.ok) throw new Error('upload failed')
  return res.json()
}

export { createStory, deleteStory, markStoryViewed, subscribeToActiveStories, uploadStoryPhoto }
