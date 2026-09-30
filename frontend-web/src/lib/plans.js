// What each subscription unlocks — DISPLAY copy of
// backend/src/config/plans.js, which is what's actually enforced (likes,
// super likes, boosts, calls, "voir qui vous aime", invisible mode). Keep
// the numbers in sync with it.

export const PLANS = {
  free: {
    id: 'free',
    label: 'Gratuit',
    likesPerDay: 20,
    superlikes: { count: 1, period: 'week' },
    boosts: null,
    calls: false,
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
