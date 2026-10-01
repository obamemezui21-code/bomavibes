import { auth } from './config.js'

// Ngori wallet — see backend/src/controllers/ngoriController.js. Balances
// and perks are only ever written by the server.

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

// → { gained (0 if already claimed today), bonus, balance, streak, streakLength, claimedToday }
export function claimDailyNgori() {
  return api('/api/ngori/claim', { method: 'POST' })
}

// → { reward, until (ms), balance }
export function redeemNgori(reward) {
  return api('/api/ngori/redeem', { method: 'POST', body: JSON.stringify({ reward }) })
}
