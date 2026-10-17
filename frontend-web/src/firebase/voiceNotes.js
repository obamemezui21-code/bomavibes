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

// Voice prompt on the profile → { question, url, duration }
export async function uploadVoicePrompt(blob, question, duration) {
  const idToken = await auth.currentUser?.getIdToken()
  const formData = new FormData()
  formData.append('question', question)
  formData.append('duration', String(duration))
  formData.append('voice', blob, 'voice-prompt.webm')
  const res = await fetch('/api/voice/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
    body: formData,
  })
  if (!res.ok) throw new Error('upload failed')
  return (await res.json()).voicePrompt
}

export async function deleteVoicePrompt() {
  const idToken = await auth.currentUser?.getIdToken()
  const res = await fetch('/api/voice/profile', { method: 'DELETE', headers: { Authorization: `Bearer ${idToken}` } })
  if (!res.ok) throw new Error('delete failed')
}
