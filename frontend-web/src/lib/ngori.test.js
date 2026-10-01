import { describe, expect, it } from 'vitest'
import { activeStreakBadge, effectivePlan, formatRemaining, includedInPlan, perkUntil } from './ngori.js'

const now = 1_000_000

describe('perkUntil', () => {
  it('returns the end of a running perk only', () => {
    expect(perkUntil({ perks: { callsUntil: now + 5000 } }, 'callsUntil', now)).toBe(now + 5000)
    expect(perkUntil({ perks: { callsUntil: now - 1 } }, 'callsUntil', now)).toBe(0)
    expect(perkUntil(null, 'callsUntil', now)).toBe(0)
  })
})

describe('effectivePlan', () => {
  it('folds running perks into the free plan', () => {
    const plan = effectivePlan({ perks: { unlimitedLikesUntil: now + 1, callsUntil: now - 1 } }, now)
    expect(plan.likesPerDay).toBe(Infinity)
    expect(plan.calls).toBe(false)
    expect(plan.seeLikes).toBe(false)
  })
})

describe('includedInPlan', () => {
  it('knows what a subscription already gives', () => {
    expect(includedInPlan('calls', { calls: true })).toBe(true)
    expect(includedInPlan('unlimited_likes', { likesPerDay: 20 })).toBe(false)
    expect(includedInPlan('boost', { calls: true })).toBe(false)
  })
})

describe('formatRemaining', () => {
  it('reads as minutes, then hours', () => {
    expect(formatRemaining(29 * 60000 + 1)).toBe('30 min')
    expect(formatRemaining(23 * 3600000 + 5 * 60000)).toBe('23 h 05')
    expect(formatRemaining(2 * 3600000)).toBe('2 h')
  })
})

describe('activeStreakBadge', () => {
  const day = Date.parse('2026-10-01T12:00:00Z')
  it('shows the badge while the streak is alive', () => {
    expect(activeStreakBadge({ streakBadge: 7, streakDay: '2026-10-01' }, day)).toBe(7)
    expect(activeStreakBadge({ streakBadge: 7, streakDay: '2026-09-30' }, day)).toBe(7)
  })
  it('hides it once a day was missed', () => {
    expect(activeStreakBadge({ streakBadge: 7, streakDay: '2026-09-29' }, day)).toBeNull()
    expect(activeStreakBadge({}, day)).toBeNull()
  })
})
