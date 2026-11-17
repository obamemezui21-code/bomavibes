import { auth } from './config.js'

// LE MOT DU JOUR — see backend/src/controllers/motDuJourController.js. The
// server keeps the word secret and marks each guess.

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

// → { day, length, hint, hints, hintsUsed, maxHints, maxTries, guesses, marks,
//     status, credited, reveal, stats, rewards }
// hints: the ones asked for so far, [{ level, label, text, pattern? }]
export function getMotDuJour() {
  return api('/api/mot-du-jour')
}

// → the same game, with the guess marked
export function submitMotDuJourGuess(day, guess) {
  return api('/api/mot-du-jour/guess', { method: 'POST', body: JSON.stringify({ day, guess }) })
}

// → the same game, with the next hint shown
export function takeMotDuJourHint(day) {
  return api('/api/mot-du-jour/hint', { method: 'POST', body: JSON.stringify({ day }) })
}
