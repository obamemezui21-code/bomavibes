import { auth } from './config.js'

export async function uploadMusicFile(file) {
  const idToken = await auth.currentUser?.getIdToken()
  const formData = new FormData()
  formData.append('track', file, file.name)

  const res = await fetch('/api/music', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
    body: formData,
  })
  if (!res.ok) throw new Error('upload failed')
  return res.json()
}

export async function deleteMusicFile(url) {
  const idToken = await auth.currentUser?.getIdToken()
  await fetch('/api/music', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ url }),
  })
}
