import { auth } from './config.js'

// Subscriber perks and manual plan activation — see
// backend/src/controllers/subscriptionController.js.

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

// → { boostedUntil } (ms)
export function boostMyProfile() {
  return api('/api/me/boost', { method: 'POST' })
}

export function setInvisibleMode(enabled) {
  return api('/api/me/invisible', { method: 'POST', body: JSON.stringify({ enabled }) })
}

// Admin: plan = 'vip' | 'diamant' | 'jade' | null (cancel), days = duration
export function adminSetUserPlan(uid, plan, days) {
  return api(`/api/admin/subscriptions/${encodeURIComponent(uid)}`, {
    method: 'PATCH',
    body: JSON.stringify({ plan, days }),
  })
}

// Online payment (SingPay Mobile Money, Gabon) — see
// backend/src/controllers/paymentController.js.
export async function getPaymentConfig() {
  const res = await fetch('/api/payments/config')
  return res.ok ? res.json() : { singpay: false }
}

// → { reference, status: 'pending', ... } once the USSD Push is sent.
export function startMobileMoneyPayment(plan, phone) {
  return api('/api/payments/singpay', { method: 'POST', body: JSON.stringify({ plan, phone }) })
}

// → { status: 'pending' | 'paid' | 'failed' | 'expired', message, planExpiresAt }
export function getPayment(reference) {
  return api(`/api/payments/${encodeURIComponent(reference)}`)
}
