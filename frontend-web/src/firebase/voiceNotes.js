import { auth } from './config.js'

export async function uploadVoiceNote(blob) {
  const idToken = await auth.currentUser?.getIdToken()
  const formData = new FormData()
  formData.append('voice', blob, 'voice-note.webm')

  const res = await fetch('/api/voice', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
    body: formData,
  })
  if (!res.ok) throw new Error('upload failed')
  const data = await res.json()
  return data.url
}
