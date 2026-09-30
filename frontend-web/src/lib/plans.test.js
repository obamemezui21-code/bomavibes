import { describe, expect, it } from 'vitest'
import { activePlan, isActiveUntil } from './plans.js'

describe('activePlan', () => {
  const now = Date.UTC(2026, 8, 30)
  it('is free without a plan, with an unknown plan or once expired', () => {
    expect(activePlan(null, now).id).toBe('free')
    expect(activePlan({ plan: 'gold', planExpiresAt: now + 1000 }, now).id).toBe('free')
    expect(activePlan({ plan: 'vip', planExpiresAt: now - 1 }, now).id).toBe('free')
  })

  it('returns the plan while it runs (Timestamp-like or number)', () => {
    expect(activePlan({ plan: 'vip', planExpiresAt: now + 1000 }, now).id).toBe('vip')
    expect(activePlan({ plan: 'jade', planExpiresAt: { toMillis: () => now + 1000 } }, now).invisible).toBe(true)
  })

  it('checks perk end dates', () => {
    expect(isActiveUntil(now + 1, now)).toBe(true)
    expect(isActiveUntil(null, now)).toBe(false)
  })
})
