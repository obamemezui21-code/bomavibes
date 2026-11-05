import { auth } from './config.js'

// Inviting friends — see backend/src/services/referralService.js.

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

// → { code, reward, monthlyCap, pending, verified, earned }
export function getMyReferral() {
  return api('/api/referrals/me')
}

// → { recorded }
export function claimReferral(code) {
  return api('/api/referrals/claim', { method: 'POST', body: JSON.stringify({ code }) })
}
