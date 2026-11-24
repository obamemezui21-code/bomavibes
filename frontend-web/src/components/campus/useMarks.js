import { useCallback, useEffect, useRef, useState } from 'react'
import { saveMarks } from '../../firebase/campus.js'

// The marks of a sheet being entered: shown at once, sent a moment later.
// What hasn't reached the server yet is also kept on the device, so a lost
// connection or a closed page loses nothing.
//
// state: 'saved' | 'waiting' | 'saving' | 'offline' | 'refused'

const DELAY = 900
const RETRY = 5000

function readStored(key) {
  try {
    const list = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(list) ? list.filter((c) => c && typeof c.id === 'string') : []
  } catch {
    return []
  }
}

function writeStored(key, list) {
  try {
    if (list.length) localStorage.setItem(key, JSON.stringify(list))
    else localStorage.removeItem(key)
  } catch {
    // private window: kept in memory only
  }
}

// What a previous visit could not send, laid over the server's marks.
function restore(key, initial, rosterIds) {
  const known = new Set(rosterIds)
  const marks = { ...initial }
  const list = readStored(key).filter((c) => known.has(c.id))
  for (const c of list) marks[c.id] = { ...(marks[c.id] || { s: null, n: '' }), ...('s' in c ? { s: c.s } : {}), ...('n' in c ? { n: c.n } : {}) }
  return { marks, list }
}

// onRefused(err): the server said no (sheet validated meanwhile…).
// onLost(n): n entries kept on this device came too late to be sent.
export function useMarks({ sessionId, uid, initial, enabled, rosterIds, onRefused, onLost }) {
  const key = `campus-pending-${uid}-${sessionId}`
  const [first] = useState(() => (enabled ? restore(key, initial, rosterIds) : { marks: initial, list: [] }))
  const [marks, setMarks] = useState(first.marks)
  const [state, setState] = useState(first.list.length ? 'waiting' : 'saved')
  const [waiting, setWaiting] = useState(first.list.length)

  const queue = useRef(null) // { pending: Map, sending: Map | null, job, timer, gone }
  if (queue.current === null) queue.current = { pending: new Map(first.list.map((c) => [c.id, c])), sending: null, job: null, timer: null, gone: false }
  const callbacks = useRef({ onRefused, onLost })
  useEffect(() => {
    callbacks.current = { onRefused, onLost }
  })

  // On the device: what is waiting, and what is on its way.
  const store = useCallback(() => {
    const q = queue.current
    const all = new Map(q.sending || [])
    for (const [id, c] of q.pending) all.set(id, { ...(all.get(id) || {}), ...c })
    writeStored(key, [...all.values()])
    if (!q.gone) setWaiting(all.size)
  }, [key])

  const flushRef = useRef(() => Promise.resolve(true))

  // Sends what is waiting; true once nothing is left.
  const flush = useCallback(async () => {
    const q = queue.current
    clearTimeout(q.timer)
    while (q.job) await q.job
    if (!q.pending.size) return true
    const batch = q.pending
    q.sending = batch
    q.pending = new Map()
    if (!q.gone) setState('saving')
    let error = null
    q.job = saveMarks(sessionId, [...batch.values()]).then(
      () => {},
      (err) => {
        error = err
      },
    )
    await q.job
    q.job = null
    q.sending = null

    if (!error) {
      if (q.gone) {
        // Another screen may already have newer entries: only ours go.
        writeStored(
          key,
          readStored(key).filter((c) => JSON.stringify(batch.get(c.id)) !== JSON.stringify(c)),
        )
        return true
      }
      store()
      setState(q.pending.size ? 'waiting' : 'saved')
      return q.pending.size === 0
    }
    const refused = error.status && error.status !== 429 && error.status !== 401 && error.status < 500
    if (q.gone) {
      if (refused) writeStored(key, [])
      return false
    }
    if (refused) {
      store()
      setState('refused')
      callbacks.current.onRefused?.(error)
      return false
    }
    // Newer presses win over what was being sent.
    for (const [id, c] of batch) q.pending.set(id, { ...c, ...(q.pending.get(id) || {}) })
    store()
    setState('offline')
    q.timer = setTimeout(() => flushRef.current(), RETRY)
    return false
  }, [key, sessionId, store])
  useEffect(() => {
    flushRef.current = flush
  }, [flush])

  // patch: { s } and / or { n }
  const setMark = useCallback(
    (id, patch) => {
      const q = queue.current
      setMarks((m) => ({ ...m, [id]: { ...(m[id] || { s: null, n: '' }), ...patch } }))
      q.pending.set(id, { ...(q.pending.get(id) || { id }), ...patch })
      store()
      setState((s) => (s === 'offline' ? s : 'waiting'))
      clearTimeout(q.timer)
      q.timer = setTimeout(() => flushRef.current(), DELAY)
    },
    [store],
  )

  useEffect(() => {
    const q = queue.current
    if (!enabled) {
      const late = readStored(key).length
      if (late) {
        writeStored(key, [])
        callbacks.current.onLost?.(late)
      }
      return undefined
    }
    q.gone = false
    if (q.pending.size) q.timer = setTimeout(() => flushRef.current(), 100)
    const now = () => flushRef.current()
    const warn = (e) => {
      if (!q.pending.size && !q.job) return
      now()
      e.preventDefault()
    }
    const hidden = () => document.visibilityState === 'hidden' && now()
    window.addEventListener('beforeunload', warn)
    window.addEventListener('online', now)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      clearTimeout(q.timer)
      window.removeEventListener('beforeunload', warn)
      window.removeEventListener('online', now)
      document.removeEventListener('visibilitychange', hidden)
      // Leaving for another screen: send what's left.
      q.gone = true
      flushRef.current()
    }
  }, [enabled, key])

  return { marks, setMark, flush, state, waiting, restored: first.list.length }
}
