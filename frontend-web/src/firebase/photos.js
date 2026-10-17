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
    throw err
  }
  const data = await res.json()
  return data.url
}

export async function uploadProfilePhotos(uid, files) {
  return Promise.all(files.map((file, i) => (file ? uploadProfilePhoto(uid, i, file) : null)))
}

// → { minSide, minPhotos, deadline, lowRes: [urls not HD],
//     rejected: [{ url, code, message }] (not a real photo of me), missing: photos to add }
export async function getPhotoQuality() {
  const idToken = await auth.currentUser?.getIdToken()
  const res = await fetch('/api/photos/quality', { headers: { Authorization: `Bearer ${idToken}` } })
  if (!res.ok) throw new Error('request failed')
  return res.json()
}
