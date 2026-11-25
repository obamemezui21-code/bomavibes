// The red counter on BomaVibes' icon once installed, like WhatsApp's: on the
// computer's taskbar or dock (Chrome, Edge) and on the iPhone's home screen
// (iOS 16.4+, notifications allowed). Android draws its own dot or number on
// the icon from the notifications waiting in the tray.
//
// It counts the unread messages, one by one; a new match with no message yet,
// or a notification about something else, counts for one. Shared by:
// - the app (ConversationsContext.jsx), which knows the exact list and
//   rewrites it whenever it changes or the member comes back to the app;
// - the service worker (firebase-messaging-sw.js), which adds to it each
//   notification received while the app is closed or out of sight.
// Both reach the list through the Cache Storage, which a page and its service
// worker share (a page's localStorage is out of a service worker's reach).
//
// The list holds the messages' ids, not a number: the app and the service
// worker may both learn of a message (window open but out of sight), and it
// must count once.
// { 'c:<conversation>': [message ids], 'n:<notification>': [] }

const CACHE = 'bv-badge'
const ENTRY = '/__badge'
// Far past what any icon shows ("99+").
const MAX_IDS = 200

// One change at a time: two notifications arriving together each read the
// list before the other wrote it, and one was lost.
let queue = Promise.resolve()
function serially(task) {
  queue = queue.then(task, task)
  return queue
}

async function readList() {
  try {
    const response = await (await globalThis.caches.open(CACHE)).match(ENTRY)
    const list = response ? await response.json() : {}
    // Before messages were counted one by one, it was an array of keys.
    if (Array.isArray(list)) return Object.fromEntries(list.map((key) => [key, []]))
    return list && typeof list === 'object' ? list : {}
  } catch {
    return {}
  }
}

async function writeList(list) {
  try {
    const body = JSON.stringify(list)
    await (await globalThis.caches.open(CACHE)).put(ENTRY, new Response(body, { headers: { 'content-type': 'application/json' } }))
  } catch {
    // No Cache Storage (private window…): the counter is still shown below.
  }
}

const countOf = (list) => Object.values(list).reduce((sum, ids) => sum + Math.max(1, ids?.length || 0), 0)

async function show(count) {
  const nav = globalThis.navigator
  if (!nav?.setAppBadge) return
  try {
    if (count > 0) await nav.setAppBadge(count)
    else await nav.clearAppBadge()
  } catch {
    // Not installed, or the system refuses: nothing to show it on.
  }
}

// The key a notification counts under: its conversation for a message or a
// call, otherwise the notification itself.
export function badgeKeyOf(payload) {
  const conversationId = payload?.data?.conversationId
  if (conversationId) return `c:${conversationId}`
  return `n:${payload?.messageId || Date.now()}`
}

// What it adds under that key: the chat message's id (the notification's own
// id stands for a call). Nothing more for a notification of another kind.
export function badgeItemOf(payload) {
  if (!payload?.data?.conversationId) return null
  return payload.data.messageId || payload.data.callId || payload.messageId || null
}

// From the app: what is unread, as [conversation id, its unread message ids].
// ids null: not counted yet, what the service worker noted is kept meanwhile.
export function setUnreadConversations(entries) {
  return serially(async () => {
    const before = await readList()
    const list = Object.fromEntries(
      entries.map(([id, ids]) => [`c:${id}`, (ids || before[`c:${id}`] || []).slice(-MAX_IDS)]),
    )
    await writeList(list)
    await show(countOf(list))
  })
}

// From the service worker: a notification arrived.
export function addUnread(key, item) {
  return serially(async () => {
    const list = await readList()
    const ids = list[key] || []
    if (item && !ids.includes(item)) ids.push(item)
    list[key] = ids.slice(-MAX_IDS)
    await writeList(list)
    await show(countOf(list))
  })
}

// The conversation a notification in the tray is about (a message or a call).
export const conversationOf = (notification) =>
  notification.data?.FCM_MSG?.data?.conversationId || notification.data?.conversationId || null

async function closeNotifications(registration, isRead) {
  try {
    for (const notification of (await registration?.getNotifications()) || []) {
      const id = conversationOf(notification)
      if (id && isRead(id)) notification.close()
    }
  } catch {
    // Not supported here: they stay until swiped away.
  }
}

// From the service worker: one notification of this conversation was tapped,
// its other messages' go with it.
export function closeConversationNotifications(registration, conversationId) {
  return closeNotifications(registration, (id) => id === conversationId)
}

// From the app: takes out of the tray the notifications of conversations that
// are read by now (opened from the app rather than from the notification),
// here or on another device. Android's counter comes from the tray: without
// this it stayed on the icon.
export async function closeReadNotifications(unreadIds) {
  const registration = await globalThis.navigator?.serviceWorker?.getRegistration().catch(() => null)
  await closeNotifications(registration, (id) => !unreadIds.includes(id))
}
