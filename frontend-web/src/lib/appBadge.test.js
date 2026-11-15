import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addUnread, badgeKeyOf, setUnreadConversations } from './appBadge.js'

// A Cache Storage holding plain Responses, and the Badging API's two calls.
function fakeCaches() {
  const store = new Map()
  const cache = {
    match: async (key) => (store.has(key) ? new Response(store.get(key)) : undefined),
    put: async (key, response) => store.set(key, await response.text()),
  }
  return { open: async () => cache }
}

let badge

beforeEach(() => {
  badge = null
  vi.stubGlobal('caches', fakeCaches())
  vi.stubGlobal('navigator', {
    setAppBadge: vi.fn(async (n) => (badge = n)),
    clearAppBadge: vi.fn(async () => (badge = 0)),
  })
})

afterEach(() => vi.unstubAllGlobals())

describe('badgeKeyOf', () => {
  it('counts a message or a call under its conversation', () => {
    expect(badgeKeyOf({ data: { conversationId: 'abc' }, messageId: 'm1' })).toBe('c:abc')
  })

  it('counts any other notification on its own', () => {
    expect(badgeKeyOf({ data: {}, messageId: 'm1' })).toBe('n:m1')
  })
})

describe('the counter on the icon', () => {
  it('shows the number of conversations the app reports', async () => {
    await setUnreadConversations(['a', 'b', 'b'])
    expect(badge).toBe(2)
  })

  it('clears when nothing is left unread', async () => {
    await setUnreadConversations(['a'])
    await setUnreadConversations([])
    expect(badge).toBe(0)
    expect(navigator.clearAppBadge).toHaveBeenCalled()
  })

  it('adds one per new conversation notified, not per message', async () => {
    await setUnreadConversations(['a'])
    await addUnread('c:a')
    await addUnread('c:b')
    await addUnread('c:b')
    await addUnread('n:like-1')
    expect(badge).toBe(3)
  })

  it('loses none of several notifications arriving together', async () => {
    await Promise.all([addUnread('c:a'), addUnread('c:b'), addUnread('c:c')])
    expect(badge).toBe(3)
  })

  it('is rewritten by the app when the member comes back', async () => {
    await addUnread('c:a')
    await addUnread('n:like-1')
    await setUnreadConversations(['a'])
    expect(badge).toBe(1)
  })

  it('does nothing where the Badging API is missing', async () => {
    vi.stubGlobal('navigator', {})
    await expect(setUnreadConversations(['a'])).resolves.toBeUndefined()
  })
})
