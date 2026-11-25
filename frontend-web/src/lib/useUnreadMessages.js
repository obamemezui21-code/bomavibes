import { useEffect, useRef, useState } from 'react'
import { collection, getDocs, limit, orderBy, query, Timestamp, where } from 'firebase/firestore'
import { db } from '../firebase/config.js'
import { countStart, latest, readSeenAt, unreadIdsOf } from './unreadMessages.js'

// The ids of the unread messages of each conversation ({ [matchId]: [ids] }),
// for the counters: the match itself only says whether something is unread.
// A conversation is read from where the member left it, then only what came
// since: each unread message is fetched once. Not in the result yet: still
// being counted.
const MAX_UNREAD = 99

export function useUnreadMessages(uid, matches) {
  const [result, setResult] = useState({ uid: null, ids: {} })
  // { [matchId]: { start, upTo, lastMessageAt, ids } } for this uid.
  const known = useRef({ uid: null, byId: {} })

  useEffect(() => {
    if (!uid) return
    if (known.current.uid !== uid) known.current = { uid, byId: {} }
    const { byId } = known.current
    const seenAt = readSeenAt(uid)

    for (const match of matches) {
      if (match.seen?.[uid] !== false || !match.lastMessage) {
        delete byId[match.id]
        continue
      }
      const start = countStart(match, uid, seenAt)
      const lastMessageAt = match.lastMessageAt?.toMillis?.() ?? 0
      let entry = byId[match.id]
      if (entry?.start !== start) entry = byId[match.id] = { start, upTo: null, lastMessageAt: -1, ids: null }
      if (entry.lastMessageAt >= lastMessageAt) continue
      const before = entry.lastMessageAt
      entry.lastMessageAt = lastMessageAt

      const from = entry.upTo || Timestamp.fromMillis(start)
      getDocs(
        query(
          collection(db, 'matches', match.id, 'messages'),
          where('createdAt', '>', from),
          orderBy('createdAt', 'desc'),
          limit(MAX_UNREAD),
        ),
      )
        .then((snap) => {
          if (known.current.uid !== uid || byId[match.id] !== entry) return // read meanwhile
          const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          entry.upTo = latest(entry.upTo, messages[0]?.createdAt)
          entry.ids = [...new Set([...(entry.ids || []), ...unreadIdsOf(messages, uid, Date.now())])].slice(-MAX_UNREAD)
          setResult((prev) => ({ uid, ids: { ...(prev.uid === uid ? prev.ids : {}), [match.id]: entry.ids } }))
        })
        .catch(() => {
          // Network: tried again at the next change.
          entry.lastMessageAt = before
        })
    }
  }, [uid, matches])

  return result.uid === uid ? result.ids : {}
}
