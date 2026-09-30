import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from './config.js'

// Selfie verification (the "Profil vérifié" badge) — see
// backend/src/controllers/verificationController.js for the whole flow.

async function authHeader() {
  const idToken = await auth.currentUser?.getIdToken()
  return { Authorization: `Bearer ${idToken}` }
}

async function readError(res, fallback) {
  const body = await res.json().catch(() => null)
  return new Error(body?.message || fallback)
}

// Asks the server for a random pose to reproduce on the selfie.
export async function startVerification() {
  const res = await fetch('/api/verification/start', { method: 'POST', headers: await authHeader() })
  if (!res.ok) throw await readError(res, 'Impossible de démarrer la vérification.')
  return res.json() // { pose, instruction }
}

export async function submitVerificationSelfie(file) {
  const body = new FormData()
  body.append('selfie', file)
  const res = await fetch('/api/verification/selfie', { method: 'POST', headers: await authHeader(), body })
  if (!res.ok) throw await readError(res, "Impossible d'envoyer la photo.")
  return res.json()
}

// The user's own request, live (null when they never asked).
export function subscribeToMyVerification(uid, onChange) {
  return onSnapshot(
    doc(db, 'verificationRequests', uid),
    (snap) => onChange(snap.exists() ? snap.data() : null),
    () => onChange(null),
  )
}

// ——— Moderation ———

export async function fetchVerificationRequests(status = 'pending') {
  const res = await fetch(`/api/admin/verifications?status=${encodeURIComponent(status)}`, { headers: await authHeader() })
  if (!res.ok) throw await readError(res, 'Impossible de charger les demandes.')
  return (await res.json()).requests
}

// Selfies are private: fetched with the moderator's token and shown through
// a temporary object URL (a plain <img src> can't send the token).
export async function fetchVerificationSelfieUrl(uid) {
  const res = await fetch(`/api/admin/verifications/${encodeURIComponent(uid)}/selfie`, { headers: await authHeader() })
  if (!res.ok) throw await readError(res, 'Selfie introuvable.')
  return URL.createObjectURL(await res.blob())
}

export async function reviewVerification(uid, decision, reason) {
  const res = await fetch(`/api/admin/verifications/${encodeURIComponent(uid)}`, {
    method: 'PATCH',
    headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, reason }),
  })
  if (!res.ok) throw await readError(res, "Impossible d'enregistrer la décision.")
  return res.json()
}

export async function revokeVerification(uid) {
  const res = await fetch(`/api/admin/verifications/${encodeURIComponent(uid)}/badge`, {
    method: 'DELETE',
    headers: await authHeader(),
  })
  if (!res.ok) throw await readError(res, 'Impossible de retirer le badge.')
  return res.json()
}
