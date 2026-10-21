import { auth } from './config.js'

// ESCADRILLE OGOUÉ — see backend/src/controllers/escadrilleController.js. The
// server hands out each sortie's seed and jet, and replays the recorded
// gestures to pay out and rank.

async function api(path, options = {}) {
  const idToken = await auth.currentUser?.getIdToken()
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}`, ...options.headers },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(body?.message || 'request failed')
    err.status = res.status
    throw err
  }
  return body
}

// → { best, bestStars, runs, wins, leaderboard, earnedToday, dailyCap }
export function getEscadrille() {
  return api('/api/escadrille')
}

// → { runId, seed, options: { jet }, earnedToday, dailyCap }
export function startEscadrilleGame(jet) {
  return api('/api/escadrille/start', { method: 'POST', body: JSON.stringify({ jet }) })
}

// → { result, credited, balance, earnedToday, newBest, best, anomaly, dailyCap }
export function finishEscadrilleGame(runId, { inputs, endTick, claimed }) {
  return api('/api/escadrille/finish', { method: 'POST', body: JSON.stringify({ runId, inputs, endTick, claimed }) })
}
