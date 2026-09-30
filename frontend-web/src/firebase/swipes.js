import { auth } from './config.js'
import { rememberSwipe } from './discovery.js'

// Likes, matches and "who liked you" go through the backend
// (backend/src/controllers/swipeController.js): that's where plan quotas
// are enforced, and Firestore rules don't let the app write them directly.

async function api(path, options = {}) {
  const idToken = await auth.currentUser?.getIdToken()
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}`, ...options.headers },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const err = new Error(body?.message || 'request failed')
    // LIKE_LIMIT / SUPERLIKE_LIMIT → the caller shows the paywall
    err.code = body?.code || null
    err.status = res.status
    throw err
  }
  return body
}

export function isQuotaError(err) {
  return err?.code === 'LIKE_LIMIT' || err?.code === 'SUPERLIKE_LIMIT'
}

export async function countIncomingLikes() {
  return (await api('/api/swipes/likes-count')).count
}

// { locked, count, likers } — likers are only filled for subscribers.
export function getIncomingLikers() {
  return api('/api/swipes/likers')
}

// { remaining: { likes (null = unlimited), superlikes } }
export function getSwipeQuota() {
  return api('/api/swipes/quota')
}

// Returns the match id when this like completes a match, else null.
// Throws an error with `code` LIKE_LIMIT / SUPERLIKE_LIMIT when the plan's
// quota is used up (nothing is recorded then).
// eslint-disable-next-line no-unused-vars
export async function recordSwipeAndMatch(uid, targetId, direction, _firstName) {
  const { matchId } = await api('/api/swipes', { method: 'POST', body: JSON.stringify({ targetId, direction }) })
  rememberSwipe(uid, targetId, direction)
  return matchId || null
}
