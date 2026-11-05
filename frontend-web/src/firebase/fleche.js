import { auth } from './config.js'

// FLÈCHE D'ÉBÈNE — see backend/src/controllers/flecheController.js. The server
// hands out each game's seed, and replays the recorded arrows to pay out and
// rank.

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

// → { best, bestStars, runs, leaderboard, earnedToday, dailyCap }
export function getFleche() {
  return api('/api/fleche')
}

// → { runId, seed, earnedToday, dailyCap }
export function startFlecheGame() {
  return api('/api/fleche/start', { method: 'POST' })
}

// → { result, credited, balance, earnedToday, newBest, best, anomaly, dailyCap }
export function finishFlecheGame(runId, { inputs, endTick, claimed }) {
  return api('/api/fleche/finish', { method: 'POST', body: JSON.stringify({ runId, inputs, endTick, claimed }) })
}
