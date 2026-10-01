import { collection, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from './config.js'

// User-made chat stickers — see backend/src/controllers/stickerController.js.

async function authed(path, options = {}) {
  const idToken = await auth.currentUser?.getIdToken()
  const res = await fetch(path, { ...options, headers: { Authorization: `Bearer ${idToken}`, ...options.headers } })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.message || 'request failed')
  return body
}

// "Mes stickers", newest first. Sorted here: an orderBy next to the
// ownerId filter would need a composite index.
export async function listMyStickers(uid) {
  const snap = await getDocs(query(collection(db, 'customStickers'), where('ownerId', '==', uid)))
  const millis = (t) => (typeof t?.toMillis === 'function' ? t.toMillis() : Date.now())
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => millis(b.createdAt) - millis(a.createdAt))
}

// `blob`: the finished transparent PNG. → { id, url }
export function uploadSticker(blob) {
  const formData = new FormData()
  formData.append('sticker', blob, 'sticker.png')
  return authed('/api/stickers', { method: 'POST', body: formData })
}

export function deleteSticker(id) {
  return authed(`/api/stickers/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
