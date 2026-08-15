import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from './config.js'

const PAGE_SIZE = 20
const WINDOW_DAYS = 7
const WINDOW_LIMIT = 150

function windowCutoff() {
  return Timestamp.fromMillis(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
}

// documentId() 'in' queries are capped at 30 — a fetched page's unique-author
// count is always well under that (max PAGE_SIZE / WINDOW_LIMIT posts), so a
// single query per page is enough; chunk defensively anyway in case that
// assumption ever changes.
async function batchFetchAuthorProfiles(uids) {
  const uniqueIds = [...new Set(uids)].filter(Boolean)
  if (uniqueIds.length === 0) return {}

  const chunks = []
  for (let i = 0; i < uniqueIds.length; i += 30) chunks.push(uniqueIds.slice(i, i + 30))

  const profilesById = {}
  await Promise.all(
    chunks.map(async (chunk) => {
      const snap = await getDocs(query(collection(db, 'profiles'), where(documentId(), 'in', chunk)))
      snap.docs.forEach((d) => {
        profilesById[d.id] = { id: d.id, ...d.data() }
      })
    }),
  )
  return profilesById
}

function toPost(docSnap) {
  return { id: docSnap.id, ...docSnap.data() }
}

async function withAuthors(posts) {
  const authorsById = await batchFetchAuthorProfiles(posts.map((p) => p.authorId))
  return { posts, authorsById }
}

async function fetchFeedPage({ tab, cursor, pageSize = PAGE_SIZE }) {
  if (tab === 'questions') {
    const constraints = [where('type', '==', 'question'), orderBy('createdAt', 'desc'), limit(pageSize)]
    if (cursor) constraints.push(startAfter(cursor))
    const snap = await getDocs(query(collection(db, 'posts'), ...constraints))
    const posts = snap.docs.map(toPost)
    const { authorsById } = await withAuthors(posts)
    return { posts, authorsById, nextCursor: snap.docs[snap.docs.length - 1] || null }
  }

  if (tab === 'foryou' || tab === 'popular') {
    // A bounded recent window, ranked client-side — no server job, no stored
    // score field. Not truly paginated (see plan): one window fetch is
    // enough for a "for you"/"popular" feed at this scale.
    const snap = await getDocs(
      query(collection(db, 'posts'), where('createdAt', '>=', windowCutoff()), orderBy('createdAt', 'desc'), limit(WINDOW_LIMIT)),
    )
    const posts = snap.docs.map(toPost)
    const { authorsById } = await withAuthors(posts)
    return { posts, authorsById, nextCursor: null }
  }

  // 'recent' (default)
  const constraints = [orderBy('createdAt', 'desc'), limit(pageSize)]
  if (cursor) constraints.push(startAfter(cursor))
  const snap = await getDocs(query(collection(db, 'posts'), ...constraints))
  const posts = snap.docs.map(toPost)
  const { authorsById } = await withAuthors(posts)
  return { posts, authorsById, nextCursor: snap.docs[snap.docs.length - 1] || null }
}

const NEW_POSTS_LIMIT = 50

// Counts posts newer than `since` without fetching the feed itself — used to
// power the "X nouveaux posts" banner while the user stays on an older page
// of the list. Scoped to the questions filter when relevant so the count
// matches what that tab would actually show.
function subscribeToNewPostsCount(since, tab, cb) {
  if (!since) return () => {}
  const constraints = [where('createdAt', '>', since), orderBy('createdAt', 'desc'), limit(NEW_POSTS_LIMIT)]
  if (tab === 'questions') constraints.unshift(where('type', '==', 'question'))
  const q = query(collection(db, 'posts'), ...constraints)
  return onSnapshot(q, (snap) => cb(snap.size))
}

async function getPost(postId) {
  const snap = await getDoc(doc(db, 'posts', postId))
  if (!snap.exists()) return null
  const post = toPost(snap)
  const { authorsById } = await withAuthors([post])
  return { post, author: authorsById[post.authorId] || null }
}

function subscribeToPost(postId, cb) {
  return onSnapshot(doc(db, 'posts', postId), (snap) => {
    cb(snap.exists() ? toPost(snap) : null)
  })
}

async function createPost(authorId, { type, text, photoUrl, photoThumbUrl }) {
  const ref = await addDoc(collection(db, 'posts'), {
    authorId,
    type,
    text: text || null,
    photoUrl: photoUrl || null,
    photoThumbUrl: photoThumbUrl || null,
    likeCount: 0,
    commentCount: 0,
    createdAt: serverTimestamp(),
    editedAt: null,
  })
  return ref.id
}

async function deletePost(postId, authorId) {
  const snap = await getDoc(doc(db, 'posts', postId))
  if (snap.exists() && snap.data().authorId !== authorId) throw new Error('forbidden')
  await deleteDoc(doc(db, 'posts', postId))
}

async function updatePost(postId, authorId, text) {
  const postRef = doc(db, 'posts', postId)
  const snap = await getDoc(postRef)
  if (!snap.exists() || snap.data().authorId !== authorId) throw new Error('forbidden')
  await updateDoc(postRef, { text: text || null, editedAt: serverTimestamp() })
}

async function hasLiked(postId, uid) {
  const snap = await getDoc(doc(db, 'posts', postId, 'likes', uid))
  return snap.exists()
}

// One collection-group query across every post's likes subcollection,
// filtered to this user, instead of one read per visible post. Mirrors
// discovery.js's getMySwipes (an unbounded per-user query is already this
// app's established pattern for "which of these have I already reacted to").
// NOTE: unlike regular per-collection queries, Firestore does not
// auto-create collection-group indexes — a collection-group index on
// `likes.uid` must be created once in the Firebase console before this
// query works in production.
async function fetchMyLikedPostIds(uid) {
  const snap = await getDocs(query(collectionGroup(db, 'likes'), where('uid', '==', uid)))
  return new Set(snap.docs.map((d) => d.ref.parent.parent.id))
}

// Toggles like/unlike, bumping likeCount ±1 in the same transaction as the
// like doc write — the counter is always derived from a real write, never
// an assumed value.
async function toggleLike(postId, uid, wasLiked) {
  const postRef = doc(db, 'posts', postId)
  const likeRef = doc(db, 'posts', postId, 'likes', uid)

  await runTransaction(db, async (tx) => {
    const postSnap = await tx.get(postRef)
    if (!postSnap.exists()) return
    if (wasLiked) {
      tx.delete(likeRef)
      tx.update(postRef, { likeCount: increment(-1) })
    } else {
      tx.set(likeRef, { uid, createdAt: serverTimestamp() })
      tx.update(postRef, { likeCount: increment(1) })
    }
  })
}

function subscribeToComments(postId, cb) {
  const q = query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'), limit(500))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

async function addComment(postId, authorId, text, parentCommentId = null) {
  const postRef = doc(db, 'posts', postId)
  const commentRef = doc(collection(db, 'posts', postId, 'comments'))

  await runTransaction(db, async (tx) => {
    const postSnap = await tx.get(postRef)
    if (!postSnap.exists()) throw new Error('not-found')
    tx.set(commentRef, {
      authorId,
      text,
      parentCommentId,
      createdAt: serverTimestamp(),
    })
    tx.update(postRef, { commentCount: increment(1) })
  })

  return commentRef.id
}

async function deleteComment(postId, commentId, authorId) {
  const postRef = doc(db, 'posts', postId)
  const commentRef = doc(db, 'posts', postId, 'comments', commentId)

  await runTransaction(db, async (tx) => {
    const commentSnap = await tx.get(commentRef)
    if (!commentSnap.exists()) return
    if (commentSnap.data().authorId !== authorId) throw new Error('forbidden')
    tx.delete(commentRef)
    tx.update(postRef, { commentCount: increment(-1) })
  })
}

async function uploadFeedPhoto(file) {
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

export {
  addComment,
  batchFetchAuthorProfiles,
  createPost,
  deleteComment,
  deletePost,
  fetchFeedPage,
  fetchMyLikedPostIds,
  getPost,
  hasLiked,
  subscribeToComments,
  subscribeToNewPostsCount,
  subscribeToPost,
  toggleLike,
  updatePost,
  uploadFeedPhoto,
}
