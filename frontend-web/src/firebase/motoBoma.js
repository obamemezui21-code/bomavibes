import { auth } from './config.js'

// MOTO BOMA — see backend/src/controllers/motoBomaController.js. The server
// hands out each race's seed and replays the recorded gestures to pay out.

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

// → { raceId, seed, course, earnedToday, dailyCap }
export function startMotoRace(course) {
  return api('/api/moto-boma/start', { method: 'POST', body: JSON.stringify({ course }) })
}

// → { result, credited, balance, earnedToday, dailyCap, anomaly, newBest }
export function finishMotoRace(raceId, { inputs, endTick, claimed }) {
  return api('/api/moto-boma/finish', { method: 'POST', body: JSON.stringify({ raceId, inputs, endTick, claimed }) })
}

// → { week, course, top: [{ rank, isMe, firstName, photo, bestTicks, medal }], me }
export function getMotoLeaderboard(course) {
  return api(`/api/moto-boma/leaderboard?course=${encodeURIComponent(course)}`)
}

// → { stats: { races, finished, medals, bestTicks, totalEarned }, earnedToday, dailyCap }
export function getMyMotoStats() {
  return api('/api/moto-boma/me')
}

// Ghost duels between matches (see motoBomaController.js).
// → { challengeId } — posts the challenge card in the chat.
export function createMotoChallenge(raceId, matchId, runner) {
  return api('/api/moto-boma/challenges', { method: 'POST', body: JSON.stringify({ raceId, matchId, runner }) })
}

// → { id, mine, fromName, toName, course, runner, finishTick, status, opponentTicks, winner: 'me'|'them'|'draw'|null }
export function getMotoChallenge(id) {
  return api(`/api/moto-boma/challenges/${encodeURIComponent(id)}`)
}

// → { raceId, seed, course, ghost: { inputs, runner, name, finishTick } } — one attempt.
export function acceptMotoChallenge(id) {
  return api(`/api/moto-boma/challenges/${encodeURIComponent(id)}/accept`, { method: 'POST' })
}
