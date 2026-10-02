import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from './config.js'
import { sendPushNotification } from './notify.js'
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

// type: 'text' | 'photo' | 'video'. For a video, photoThumbUrl holds its
// poster frame and duration its length in seconds.
async function createStory(authorId, { type, text, photoUrl, photoThumbUrl, background, videoUrl, duration }) {
  const ref = await addDoc(collection(db, 'stories'), {
    authorId,
    type,
    text: text || null,
    background: background || null,
    photoUrl: photoUrl || null,
    photoThumbUrl: photoThumbUrl || null,
    videoUrl: videoUrl || null,
    duration: duration || null,
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

// Sends the video file as is (plus its poster frame, if one could be
// grabbed) — see backend/src/controllers/storyVideoController.js.
// → { videoUrl, posterUrl }
async function uploadStoryVideo(file, posterBlob) {
  const idToken = await auth.currentUser?.getIdToken()
  const formData = new FormData()
  formData.append('video', file)
  if (posterBlob) formData.append('poster', posterBlob, 'poster.jpg')

  const res = await fetch('/api/story-videos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
    body: formData,
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.message || (res.status === 413 ? 'Vidéo trop lourde.' : 'upload failed'))
  return body
}

// Reactions: one per viewer (❤️ is the "like"), at stories/{id}/reactions/{uid}.
// Only the viewer and the story's author can read it (see firestore.rules).
const STORY_REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👏']
const COMMENTS_LIMIT = 100

function subscribeToMyStoryReaction(storyId, uid, cb) {
  return onSnapshot(
    doc(db, 'stories', storyId, 'reactions', uid),
    (snap) => cb(snap.exists() ? snap.data().emoji : null),
    () => cb(null),
  )
}

// The author's side: every reaction on their story, { [uid]: emoji }.
function subscribeToStoryReactions(storyId, cb) {
  return onSnapshot(
    collection(db, 'stories', storyId, 'reactions'),
    (snap) => cb(Object.fromEntries(snap.docs.map((d) => [d.id, d.data().emoji]))),
    () => cb({}),
  )
}

// emoji null removes the reaction. The author gets a push for a new one.
async function setStoryReaction(story, uid, emoji) {
  const ref = doc(db, 'stories', story.id, 'reactions', uid)
  if (!emoji) {
    await deleteDoc(ref)
    return
  }
  await setDoc(ref, { emoji, createdAt: serverTimestamp() })
  sendPushNotification(story.authorId, 'story_reaction', { storyId: story.id, emoji })
}

// Comments, oldest first, with their authors' profiles.
function subscribeToStoryComments(storyId, cb) {
  const q = query(collection(db, 'stories', storyId, 'comments'), orderBy('createdAt', 'asc'), limit(COMMENTS_LIMIT))
  return onSnapshot(
    q,
    async (snap) => {
      const comments = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const authorsById = await batchFetchAuthorProfiles(comments.map((c) => c.authorId))
      cb(comments.map((c) => ({ ...c, author: authorsById[c.authorId] || null })))
    },
    () => cb([]),
  )
}

async function addStoryComment(story, uid, text) {
  await addDoc(collection(db, 'stories', story.id, 'comments'), { authorId: uid, text, createdAt: serverTimestamp() })
  if (story.authorId !== uid) sendPushNotification(story.authorId, 'story_comment', { storyId: story.id, text })
}

async function deleteStoryComment(storyId, commentId) {
  await deleteDoc(doc(db, 'stories', storyId, 'comments', commentId))
}

export {
  STORY_REACTIONS,
  addStoryComment,
  createStory,
  deleteStory,
  deleteStoryComment,
  markStoryViewed,
  setStoryReaction,
  subscribeToActiveStories,
  subscribeToMyStoryReaction,
  subscribeToStoryComments,
  subscribeToStoryReactions,
  uploadStoryPhoto,
  uploadStoryVideo,
}
