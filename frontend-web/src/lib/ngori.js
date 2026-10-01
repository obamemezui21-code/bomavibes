import { activePlan } from './plans.js'

// Ngori rewards — DISPLAY copy of backend/src/config/ngori.js, which is what
// the server actually charges and grants. Keep the numbers in sync with it.

export const STREAK_LENGTH = 7
export const STREAK_BONUS = 3

export const REWARDS = [
  {
    id: 'unlimited_likes',
    cost: 10,
    duration: '30 min',
    perk: 'unlimitedLikesUntil',
    emoji: '❤️',
    label: 'Likes illimités',
    description: 'Likez sans compter pendant 30 minutes.',
  },
  {
    id: 'boost',
    cost: 25,
    duration: '30 min',
    emoji: '🚀',
    label: 'Boost du profil',
    description: 'Votre profil passe en tête de Découvrir.',
  },
  {
    id: 'see_likes',
    cost: 35,
    duration: '24 h',
    perk: 'seeLikesUntil',
    emoji: '👀',
    label: 'Voir qui vous aime',
    description: 'Découvrez qui vous a liké et matchez en un geste.',
  },
  {
    id: 'calls',
    cost: 50,
    duration: '24 h',
    perk: 'callsUntil',
    emoji: '📞',
    label: 'Appels audio & vidéo',
    description: 'Appelez vos matchs, comme un abonné.',
  },
]

function toMillis(value) {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return Number(value) || 0
}

// End (ms) of a Ngori perk still running on the account, else 0.
export function perkUntil(account, perk, now = Date.now()) {
  const until = toMillis(account?.perks?.[perk])
  return until > now ? until : 0
}

// The plan with the running Ngori perks folded in — mirrors the backend's
// effectivePlanFor, for UI gating (e.g. the call buttons).
export function effectivePlan(account, now = Date.now()) {
  const plan = { ...activePlan(account, now) }
  if (perkUntil(account, 'unlimitedLikesUntil', now)) plan.likesPerDay = Infinity
  if (perkUntil(account, 'seeLikesUntil', now)) plan.seeLikes = true
  if (perkUntil(account, 'callsUntil', now)) plan.calls = true
  return plan
}

// Whether the subscription already gives what a reward would unlock.
export function includedInPlan(rewardId, plan) {
  if (rewardId === 'unlimited_likes') return plan.likesPerDay === Infinity
  if (rewardId === 'see_likes') return plan.seeLikes
  if (rewardId === 'calls') return plan.calls
  return false
}

export function formatRemaining(ms) {
  const totalMinutes = Math.ceil(ms / 60000)
  if (totalMinutes >= 60) {
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
  }
  return `${totalMinutes} min`
}

// The 🔥 login-streak badge on a public profile (3, 7, 14 or 30 days), or
// null once the streak has lapsed (last claim older than yesterday, UTC).
export function activeStreakBadge(profile, now = Date.now()) {
  if (!profile?.streakBadge || !profile.streakDay) return null
  const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return profile.streakDay >= yesterday ? profile.streakBadge : null
}
