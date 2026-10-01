import { auth } from './config.js'

// NGORI RUN — see backend/src/controllers/ngoriRunController.js. The server
// hands out each run's seed and replays the recorded gestures to pay out.

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

// → { runId, seed, earnedToday, dailyCap }
export function startNgoriRun() {
  return api('/api/ngori-run/start', { method: 'POST' })
}

// → { result, credited, balance, earnedToday, dailyCap, anomaly, newBestScore, newBestDistance }
export function finishNgoriRun(runId, { inputs, endTick, claimed }) {
  return api('/api/ngori-run/finish', { method: 'POST', body: JSON.stringify({ runId, inputs, endTick, claimed }) })
}

// → { week, top: [{ rank, isMe, firstName, photo, score, distance, ngoriEarned }], me }
export function getNgoriRunLeaderboard() {
  return api('/api/ngori-run/leaderboard')
}

// → { stats: { games, bestDistance, bestScore, bestCombo, totalCollected, totalEarned }, earnedToday, dailyCap }
export function getMyNgoriRunStats() {
  return api('/api/ngori-run/me')
}
