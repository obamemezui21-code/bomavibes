import { auth } from './config.js'

// "We Met" — see backend/src/controllers/weMetController.js. Private
// feedback after a match: the other person never sees it.

async function api(path, options = {}) {
  const idToken = await auth.currentUser?.getIdToken()
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}`, ...options.headers },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.message || 'request failed')
  return body
}

// → { ask } — whether to ask about this match now
export function getWeMet(matchId) {
  return api(`/api/we-met/${encodeURIComponent(matchId)}`)
}

// met: 'yes' | 'no' | 'not_yet'
export function answerWeMet(matchId, { met, seeAgain = null, uncomfortable = false }) {
  return api(`/api/we-met/${encodeURIComponent(matchId)}`, {
    method: 'POST',
    body: JSON.stringify({ met, seeAgain, uncomfortable }),
  })
}
