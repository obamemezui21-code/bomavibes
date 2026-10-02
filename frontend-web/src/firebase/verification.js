import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from './config.js'

// Identity verification (ID document + selfie, the "Profil vérifié" badge)
// — see backend/src/controllers/verificationController.js for the flow.

// Identity documents accepted (same keys as the backend's ID_TYPES).
export const ID_TYPES = [
  { value: 'cni', label: "Carte d'identité", emoji: '🪪' },
  { value: 'passport', label: 'Passeport', emoji: '🛂' },
  { value: 'permis', label: 'Permis de conduire', emoji: '🚗' },
  { value: 'sejour', label: 'Titre de séjour', emoji: '📄' },
]

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

// Both photos together: the identity document and the pose selfie.
export async function submitIdentityVerification({ idType, document, selfie }) {
  const body = new FormData()
  body.append('idType', idType)
  body.append('document', document)
  body.append('selfie', selfie)
  const res = await fetch('/api/verification/submit', { method: 'POST', headers: await authHeader(), body })
  if (!res.ok) throw await readError(res, "Impossible d'envoyer les photos.")
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

export async function fetchVerificationIdUrl(uid) {
  const res = await fetch(`/api/admin/verifications/${encodeURIComponent(uid)}/id-document`, { headers: await authHeader() })
  if (!res.ok) throw await readError(res, "Pièce d'identité introuvable.")
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
