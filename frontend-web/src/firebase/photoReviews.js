import { auth } from './config.js'

// The photo moderation queue — see backend/src/controllers/photoReviewController.js.

async function authHeader() {
  const idToken = await auth.currentUser?.getIdToken()
  return { Authorization: `Bearer ${idToken}` }
}

async function readError(res, fallback) {
  const body = await res.json().catch(() => null)
  return new Error(body?.message || fallback)
}

// → { reviews: [{ id, uid, firstName, source, onProfile, code, reason, details,
//     appealed, createdAt, decidedAt, decisionCode }], reasons: { [code]: text } }
export async function fetchPhotoReviews(status) {
  const res = await fetch(`/api/admin/photo-reviews?status=${encodeURIComponent(status)}`, { headers: await authHeader() })
  if (!res.ok) throw await readError(res, 'Impossible de charger les photos à vérifier.')
  return res.json()
}

// The photo itself (private: loaded with the moderator's token) → an object URL.
export async function fetchPhotoReviewImageUrl(id) {
  const res = await fetch(`/api/admin/photo-reviews/${encodeURIComponent(id)}/image`, { headers: await authHeader() })
  if (!res.ok) throw await readError(res, 'Photo introuvable.')
  return URL.createObjectURL(await res.blob())
}

export async function decidePhotoReview(id, decision, code) {
  const res = await fetch(`/api/admin/photo-reviews/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ decision, code }),
  })
  if (!res.ok) throw await readError(res, 'Impossible d’enregistrer la décision.')
  return res.json()
}
