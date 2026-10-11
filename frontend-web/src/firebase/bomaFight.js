import { auth } from './config.js'

// BOMA FIGHT — see backend/src/controllers/bomaFightController.js. The server
// hands out each fight's seed and replays the recorded gestures to pay out.

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

// → { fightId, seed, fighter, level, opponent, earnedToday, dailyCap }
export function startFight(fighter, level) {
  return api('/api/boma-fight/start', { method: 'POST', body: JSON.stringify({ fighter, level }) })
}

// → { result, credited, balance, earnedToday, dailyCap, anomaly }
export function finishFight(fightId, { inputs, endTick, claimed }) {
  return api('/api/boma-fight/finish', { method: 'POST', body: JSON.stringify({ fightId, inputs, endTick, claimed }) })
}

// → { week, top: [{ rank, isMe, firstName, photo, points, wins, fighter }], me }
export function getFightLeaderboard() {
  return api('/api/boma-fight/leaderboard')
}

// → { stats: { fights, wins, losses, winsByLevel, perfects, totalEarned }, earnedToday, dailyCap }
export function getMyFightStats() {
  return api('/api/boma-fight/me')
}
