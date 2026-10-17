import { auth } from './config.js'

// COMMANDO OKOUMÉ — see backend/src/controllers/commandoController.js. The
// server hands out each mission's seed and options, and replays the
// recorded gestures to pay out, give XP and rank.

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

// → { progress: { xp, grade, missions, unlocked, totalScore }, leaderboard, earnedToday, dailyCap }
export function getCommando() {
  return api('/api/commando')
}

// → { runId, seed, mission, options: { character, maxHp }, earnedToday, dailyCap }
export function startCommandoMission(mission, character) {
  return api('/api/commando/start', { method: 'POST', body: JSON.stringify({ mission, character }) })
}

// → { result, credited, balance, earnedToday, xpGained, grade, promoted, newBest, unlocked, anomaly }
export function finishCommandoMission(runId, { inputs, endTick, claimed }) {
  return api('/api/commando/finish', { method: 'POST', body: JSON.stringify({ runId, inputs, endTick, claimed }) })
}
