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
  if (!res.ok) throw new Error('upload failed')
  const data = await res.json()
  return data.url
}

export async function uploadProfilePhotos(uid, files) {
  return Promise.all(files.map((file, i) => (file ? uploadProfilePhoto(uid, i, file) : null)))
}
