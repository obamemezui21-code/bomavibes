// The red counter on BomaVibes' icon once installed, like WhatsApp's: on the
// computer's taskbar or dock (Chrome, Edge) and on the iPhone's home screen
// (iOS 16.4+, notifications allowed). Android draws its own dot or number on
// the icon from the notifications waiting in the tray.
//
// It counts what the bell in the top bar counts: the conversations with
// something unread (a new match or a message), each one once. Shared by:
// - the app (ConversationsContext.jsx), which knows the exact list and
//   rewrites it whenever it changes or the member comes back to the app;
// - the service worker (firebase-messaging-sw.js), which adds one to it for
//   each notification received while the app is closed or out of sight.
// Both reach the list through the Cache Storage, which a page and its service
// worker share (a page's localStorage is out of a service worker's reach).

const CACHE = 'bv-badge'
const ENTRY = '/__badge'

// One change at a time: two notifications arriving together each read the
// list before the other wrote it, and one was lost.
let queue = Promise.resolve()
function serially(task) {
  queue = queue.then(task, task)
  return queue
}

async function readKeys() {
  try {
    const response = await (await globalThis.caches.open(CACHE)).match(ENTRY)
    const keys = response ? await response.json() : []
    return Array.isArray(keys) ? keys : []
  } catch {
    return []
  }
}

async function writeKeys(keys) {
  try {
    const body = JSON.stringify(keys)
    await (await globalThis.caches.open(CACHE)).put(ENTRY, new Response(body, { headers: { 'content-type': 'application/json' } }))
  } catch {
    // No Cache Storage (private window…): the counter is still shown below.
  }
}

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
// call (a second message in the same conversation doesn't add one), otherwise
// the notification itself.
export function badgeKeyOf(payload) {
  const conversationId = payload?.data?.conversationId
  if (conversationId) return `c:${conversationId}`
  return `n:${payload?.messageId || Date.now()}`
}

// From the app: the ids of the conversations with something unread.
export function setUnreadConversations(ids) {
  return serially(async () => {
    const keys = [...new Set(ids)].map((id) => `c:${id}`)
    await writeKeys(keys)
    await show(keys.length)
  })
}

// From the service worker: a notification arrived.
export function addUnread(key) {
  return serially(async () => {
    const keys = await readKeys()
    if (!keys.includes(key)) keys.push(key)
    await writeKeys(keys)
    await show(keys.length)
  })
}
