import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addUnread, badgeItemOf, badgeKeyOf, closeConversationNotifications, closeReadNotifications, setUnreadConversations } from './appBadge.js'

// A Cache Storage holding plain Responses, and the Badging API's two calls.
let store

function fakeCaches() {
  store = new Map()
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

describe('what a notification counts as', () => {
  it('a message: its own id, in its conversation', () => {
    const payload = { data: { conversationId: 'abc', messageId: 'msg' }, messageId: 'fcm' }
    expect(badgeKeyOf(payload)).toBe('c:abc')
    expect(badgeItemOf(payload)).toBe('msg')
  })

  it('a call: its id, in its conversation', () => {
    expect(badgeItemOf({ data: { conversationId: 'abc', callId: 'call' }, messageId: 'fcm' })).toBe('call')
  })

  it('any other notification: itself', () => {
    expect(badgeKeyOf({ data: {}, messageId: 'm1' })).toBe('n:m1')
    expect(badgeItemOf({ data: {}, messageId: 'm1' })).toBe(null)
  })
})

describe('the counter on the icon', () => {
  it('counts the messages, and one for a conversation without any', async () => {
    await setUnreadConversations([['a', ['1', '2', '3']], ['b', []]])
    expect(badge).toBe(4)
  })

  it('clears when nothing is left unread', async () => {
    await setUnreadConversations([['a', ['1']]])
    await setUnreadConversations([])
    expect(badge).toBe(0)
    expect(navigator.clearAppBadge).toHaveBeenCalled()
  })

  it('goes up with each message received while the app is closed', async () => {
    await setUnreadConversations([['a', ['1']]])
    await addUnread('c:a', '2')
    await addUnread('c:b', '3')
    await addUnread('c:b', '4')
    await addUnread('n:like-1', null)
    expect(badge).toBe(5)
  })

  it('counts a message once when the app and the service worker both see it', async () => {
    await setUnreadConversations([['a', ['1', '2']]])
    await addUnread('c:a', '2')
    expect(badge).toBe(2)
  })

  it('loses none of several notifications arriving together', async () => {
    await Promise.all([addUnread('c:a', '1'), addUnread('c:a', '2'), addUnread('c:c', '3')])
    expect(badge).toBe(3)
  })

  it('is rewritten by the app when the member comes back', async () => {
    await addUnread('c:a', '1')
    await addUnread('n:like-1', null)
    await setUnreadConversations([['a', ['1']]])
    expect(badge).toBe(1)
  })

  it('keeps what was noted until the app has counted', async () => {
    await addUnread('c:a', '1')
    await addUnread('c:a', '2')
    await setUnreadConversations([['a', null]])
    expect(badge).toBe(2)
  })

  it('reads the list kept by the previous version', async () => {
    store.set('/__badge', JSON.stringify(['c:a', 'n:x']))
    await addUnread('c:b', '1')
    expect(badge).toBe(3)
  })

  it('does nothing where the Badging API is missing', async () => {
    vi.stubGlobal('navigator', {})
    await expect(setUnreadConversations([['a', null]])).resolves.toBeUndefined()
  })
})

describe('notifications of conversations already read', () => {
  it('leave the tray, the others stay', async () => {
    const shown = [
      { data: { FCM_MSG: { data: { conversationId: 'read' } } }, close: vi.fn() },
      { data: { conversationId: 'read' }, close: vi.fn() },
      { data: { FCM_MSG: { data: { conversationId: 'unread' } } }, close: vi.fn() },
      { data: null, close: vi.fn() },
    ]
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration: async () => ({ getNotifications: async () => shown }) } })
    await closeReadNotifications(['unread'])
    expect(shown.map((n) => n.close.mock.calls.length)).toEqual([1, 1, 0, 0])
  })

  it('tapping one takes the others of its conversation away', async () => {
    const shown = ['a', 'a', 'b'].map((id) => ({ data: { FCM_MSG: { data: { conversationId: id } } }, close: vi.fn() }))
    await closeConversationNotifications({ getNotifications: async () => shown }, 'a')
    expect(shown.map((n) => n.close.mock.calls.length)).toEqual([1, 1, 0])
  })

  it('nothing happens without a service worker', async () => {
    await expect(closeReadNotifications([])).resolves.toBeUndefined()
  })
})
