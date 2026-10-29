import { auth } from './config.js'
import { compressImage } from '../lib/compressImage.js'

export async function uploadProfilePhoto(uid, slotIndex, file) {
  const [idToken, upload] = await Promise.all([auth.currentUser?.getIdToken(), compressImage(file)])
  const formData = new FormData()
  formData.append('photo', upload)
  formData.append('slot', String(slotIndex))

  const res = await fetch('/api/photos', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
    body: formData,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const err = new Error(body?.message || 'upload failed')
    err.code = body?.code
    // A refused photo is kept privately for a while: with this id, its owner
    // can ask a moderator to look at it (appealPhoto).
    err.refusalId = body?.refusalId || null
    throw err
  }
  const data = await res.json()
  return data.url
}

export async function uploadProfilePhotos(uid, files) {
  return Promise.all(files.map((file, i) => (file ? uploadProfilePhoto(uid, i, file) : null)))
}

// "Ce n'est pas correct, demander une vérification": { refusalId, slot } for a
// photo refused on upload, { url } for a refused photo of the profile.
export async function appealPhoto(request) {
  const idToken = await auth.currentUser?.getIdToken()
  const res = await fetch('/api/photos/appeal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(request),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message || 'Impossible d’envoyer la demande, réessaie.')
  }
  return res.json()
}

// → { minSide, minPhotos, deadline, lowRes: [urls not HD],
//     rejected: [{ url, code, message, human }] (refused: by the analysis,
//       waiting for a moderator — human: false — or by a moderator),
//     review: [urls a moderator will check, accepted meanwhile],
//     missing: photos to add, suspended }
export async function getPhotoQuality() {
  const idToken = await auth.currentUser?.getIdToken()
  const res = await fetch('/api/photos/quality', { headers: { Authorization: `Bearer ${idToken}` } })
  if (!res.ok) throw new Error('request failed')
  return res.json()
}
