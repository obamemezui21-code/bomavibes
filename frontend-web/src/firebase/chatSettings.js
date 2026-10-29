import { auth } from './config.js'

// Conversation settings only the server writes — see
// backend/src/controllers/ephemeralController.js.

// ttl: 0 (off), 86400 (24 h) or 604800 (7 days) → { ttl }
export async function setEphemeralMessages(matchId, ttl) {
  const idToken = await auth.currentUser?.getIdToken()
  const res = await fetch(`/api/chat/${encodeURIComponent(matchId)}/ephemeral`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ ttl }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.message || 'Impossible de changer ce réglage.')
  return body
}
