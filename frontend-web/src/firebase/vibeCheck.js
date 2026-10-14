import { auth } from './config.js'

// VIBE CHECK — see backend/src/controllers/vibeCheckController.js. Answers are
// compared on the server; sending a vibe is a like (same quotas as Discover).

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

// → { day, questions: [{ id, text, a, b }], myAnswers, pref, gender, playedToday, rewards }
export function getVibeCheck() {
  return api('/api/vibe-check')
}

// → { credited }
export function submitVibeAnswers(day, pref, answers) {
  return api('/api/vibe-check/answers', { method: 'POST', body: JSON.stringify({ day, pref, answers }) })
}

// → { needsPlay, received: [card], top: [card] }
export function getVibeResults() {
  return api('/api/vibe-check/results')
}

// → { matchId, photo, percent, credited }
export function sendVibe(targetId) {
  return api('/api/vibe-check/vibe', { method: 'POST', body: JSON.stringify({ targetId }) })
}
