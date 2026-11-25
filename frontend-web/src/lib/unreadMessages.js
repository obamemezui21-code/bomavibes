// Which messages of a conversation count as unread (useUnreadMessages.js).

const millis = (ts) => ts?.toMillis?.() ?? 0

// Conversations marked as seen without being opened ("Tout marquer lu"), on
// this device: { [matchId]: ms }. The other member isn't told they were read,
// so lastReadAt can't hold it; without it, the next message would bring the
// old ones back into the count.
const KEY = 'bv.seenAt.'

export function readSeenAt(uid) {
  try {
    return JSON.parse(localStorage.getItem(KEY + uid)) || {}
  } catch {
    return {}
  }
}

export function rememberSeen(uid, matchIds, at = Date.now()) {
  if (!matchIds.length) return
  try {
    localStorage.setItem(KEY + uid, JSON.stringify({ ...readSeenAt(uid), ...Object.fromEntries(matchIds.map((id) => [id, at])) }))
  } catch {
    // Private window: the older messages are counted again.
  }
}

// From when messages are unread: last opened, emptied, or marked as seen.
export function countStart(match, uid, seenAt = {}) {
  return Math.max(millis(match.lastReadAt?.[uid]), millis(match.clearedAt?.[uid]), seenAt[match.id] || 0)
}

export const latest = (a, b) => (millis(b) > millis(a) ? b : a)

// `messages` newest first, as queried; the ids come oldest first.
export function unreadIdsOf(messages, uid, now) {
  return messages
    .filter((m) => m.senderId !== uid && !(m.expiresAt && millis(m.expiresAt) <= now))
    .map((m) => m.id)
    .reverse()
}
