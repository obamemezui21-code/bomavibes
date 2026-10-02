// What each subscription unlocks — DISPLAY copy of
// backend/src/config/plans.js, which is what's actually enforced (likes,
// super likes, boosts, calls, "voir qui vous aime", invisible mode). Keep
// the numbers in sync with it.

// Calls temporarily free for everyone — mirror of FREE_CALLS in
// backend/src/config/plans.js (and freeCalls in firestore.rules).
export const FREE_CALLS = true

// Free plan likes per day, doubled for a verified identity — mirror of
// backend/src/config/plans.js.
export const FREE_LIKES_PER_DAY = 15
export const VERIFIED_LIKES_PER_DAY = 30

export const PLANS = {
  free: {
    id: 'free',
    label: 'Gratuit',
    likesPerDay: FREE_LIKES_PER_DAY,
    superlikes: { count: 1, period: 'week' },
    boosts: null,
    calls: FREE_CALLS,
    seeLikes: false,
    invisible: false,
  },
  vip: {
    id: 'vip',
    label: 'VIP',
    emoji: '👑',
    likesPerDay: Infinity,
    superlikes: { count: 5, period: 'week' },
    boosts: { count: 1, period: 'week' },
    calls: true,
    seeLikes: true,
    invisible: false,
  },
  diamant: {
    id: 'diamant',
    label: 'Diamant Rouge',
    emoji: '💎',
    likesPerDay: Infinity,
    superlikes: { count: 3, period: 'day' },
    boosts: { count: 3, period: 'week' },
    calls: true,
    seeLikes: true,
    invisible: false,
  },
  jade: {
    id: 'jade',
    label: 'Jadéite Impériale',
    emoji: '💚',
    likesPerDay: Infinity,
    superlikes: { count: 10, period: 'day' },
    boosts: { count: 1, period: 'day' },
    calls: true,
    seeLikes: true,
    invisible: true,
  },
}

function toMillis(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return Number(value) || 0
}

// `account` is the user's own users/{uid} document (AuthContext's `profile`).
export function activePlan(account, now = Date.now()) {
  const id = account?.plan
  if (!PLANS[id] || id === 'free') return PLANS.free
  return toMillis(account.planExpiresAt) > now ? PLANS[id] : PLANS.free
}

export function planExpiry(account) {
  const ms = toMillis(account?.planExpiresAt)
  return ms ? new Date(ms) : null
}

export function isActiveUntil(value, now = Date.now()) {
  return toMillis(value) > now
}

export function periodLabel(period) {
  return period === 'day' ? 'par jour' : 'par semaine'
}
