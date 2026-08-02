import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from './config.js'

export async function uploadProfilePhoto(uid, slotIndex, file) {
  const path = `profile-photos/${uid}/photo-${slotIndex}.jpg`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, { contentType: file.type })
  return getDownloadURL(storageRef)
}

export async function uploadProfilePhotos(uid, files) {
  return Promise.all(files.map((file, i) => (file ? uploadProfilePhoto(uid, i, file) : null)))
}
