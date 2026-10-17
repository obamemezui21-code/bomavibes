import { auth } from './config.js'

// CrushTime — see backend/src/controllers/crushTimeController.js.

async function api(path, options = {}) {
  const idToken = await auth.currentUser?.getIdToken()
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}`, ...options.headers },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(body?.message || 'request failed')
    err.code = body?.code || null
    err.status = res.status
    throw err
  }
  return body
}

// → { playsLeft, waiting, round: { options: [{ id, firstName, age, city, photo, verified }] } | null }
export function getCrushTime() {
  return api('/api/crush-time')
}

// → { correct, matchId, crush }
export function guessCrush(targetId) {
  return api('/api/crush-time/guess', { method: 'POST', body: JSON.stringify({ targetId }) })
}
