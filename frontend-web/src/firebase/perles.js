import { auth } from './config.js'

// PERLES PUNU — see backend/src/controllers/perlesController.js. The server
// hands out each game's seed, and replays the recorded throws to pay out
// and rank.

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

// → { best, bestStars, bestLevels, runs, wins, leaderboard, earnedToday, dailyCap }
export function getPerles() {
  return api('/api/perles')
}

// → { runId, seed, earnedToday, dailyCap }
export function startPerlesGame() {
  return api('/api/perles/start', { method: 'POST', body: JSON.stringify({}) })
}

// → { result, credited, balance, earnedToday, newBest, best, anomaly, dailyCap }
export function finishPerlesGame(runId, { inputs, endTick, claimed }) {
  return api('/api/perles/finish', { method: 'POST', body: JSON.stringify({ runId, inputs, endTick, claimed }) })
}
