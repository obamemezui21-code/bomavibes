import { auth } from './config.js'

// ŒIL DE PANTHÈRE — see backend/src/controllers/pantherController.js. The
// server hands out each game's seed and rifle, and replays the recorded
// shots to pay out and rank.

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
export function getPanther() {
  return api('/api/panthere')
}

// → { runId, seed, options: { rifle }, earnedToday, dailyCap }
export function startPantherGame(rifle) {
  return api('/api/panthere/start', { method: 'POST', body: JSON.stringify({ rifle }) })
}

// → { result, credited, balance, earnedToday, newBest, best, anomaly, dailyCap }
export function finishPantherGame(runId, { inputs, endTick, claimed }) {
  return api('/api/panthere/finish', { method: 'POST', body: JSON.stringify({ runId, inputs, endTick, claimed }) })
}
