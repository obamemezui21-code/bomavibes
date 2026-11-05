import { beforeEach, describe, expect, it, vi } from 'vitest'
import { captureReferral, clearReferral, pendingReferral } from './referral.js'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000

describe('referral', () => {
  beforeEach(() => {
    const store = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k),
    })
  })

  it('keeps a valid code from the address', () => {
    captureReferral('?ref=ABCD2345', NOW)
    expect(pendingReferral(NOW)).toBe('ABCD2345')
  })

  it('ignores what is not a code', () => {
    for (const search of ['', '?x=1', '?ref=', '?ref=short', '?ref=abcd2345', '?ref=ABCD0000', '?ref=%3Cscript%3E']) {
      captureReferral(search, NOW)
      expect(pendingReferral(NOW), search).toBeNull()
    }
  })

  it('keeps the first invitation', () => {
    captureReferral('?ref=ABCD2345', NOW)
    captureReferral('?ref=WXYZ6789', NOW + DAY)
    expect(pendingReferral(NOW + DAY)).toBe('ABCD2345')
  })

  it('forgets it after 30 days, or once used', () => {
    captureReferral('?ref=ABCD2345', NOW)
    expect(pendingReferral(NOW + 29 * DAY)).toBe('ABCD2345')
    expect(pendingReferral(NOW + 31 * DAY)).toBeNull()
    clearReferral()
    expect(pendingReferral(NOW)).toBeNull()
  })

  it('survives a storage that fails or holds junk', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => '{not json',
      setItem: () => {
        throw new Error('denied')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    })
    expect(() => captureReferral('?ref=ABCD2345', NOW)).not.toThrow()
    expect(pendingReferral(NOW)).toBeNull()
    expect(() => clearReferral()).not.toThrow()
  })
})
