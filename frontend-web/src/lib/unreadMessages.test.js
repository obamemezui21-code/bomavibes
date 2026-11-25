import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { countStart, latest, readSeenAt, rememberSeen, unreadIdsOf } from './unreadMessages.js'

const at = (ms) => ({ toMillis: () => ms })

beforeEach(() => {
  const store = new Map()
  vi.stubGlobal('localStorage', { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) })
})
afterEach(() => vi.unstubAllGlobals())

describe('unread messages', () => {
  it('start after the last reading, the emptying or "mark all read", whichever is latest', () => {
    const match = { id: 'm', lastReadAt: { me: at(10), other: at(99) }, clearedAt: { me: at(20) } }
    expect(countStart(match, 'me')).toBe(20)
    expect(countStart(match, 'me', { m: 30 })).toBe(30)
    expect(countStart({ id: 'm' }, 'me')).toBe(0)
  })

  it('leave out my own and the expired ephemeral ones', () => {
    const newestFirst = [
      { id: 'd', senderId: 'other', expiresAt: at(500) },
      { id: 'c', senderId: 'other', expiresAt: at(100) },
      { id: 'b', senderId: 'me' },
      { id: 'a', senderId: 'other' },
    ]
    expect(unreadIdsOf(newestFirst, 'me', 200)).toEqual(['a', 'd'])
  })

  it('keep the later of two moments', () => {
    const [a, b] = [at(1), at(2)]
    expect(latest(a, b)).toBe(b)
    expect(latest(b, a)).toBe(b)
    expect(latest(null, a)).toBe(a)
    expect(latest(a, undefined)).toBe(a)
  })

  it('remember what was marked as seen, per account', () => {
    rememberSeen('me', ['m1'], 5)
    rememberSeen('me', ['m2'], 6)
    expect(readSeenAt('me')).toEqual({ m1: 5, m2: 6 })
    expect(readSeenAt('someone')).toEqual({})
  })
})
