// NGORI RUN — finished runs the server hasn't confirmed yet. A run is kept on
// the phone until then, so a bad connection or a closed app doesn't lose it:
// the lobby sends it again. The server still replays it and can only pay it
// once, so nothing kept here can be worth more than the run itself.

const KEY = 'ngoriRun.pending'
const MAX_KEPT = 5
// Same as NGORI_RUN.maxRunMs (backend/src/config/ngori.js): later, it pays nothing.
const MAX_AGE_MS = 24 * 60 * 60 * 1000

function read() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    return true
  } catch {
    return false // private mode or full storage
  }
}

// → whether the run could be kept.
export function keepPendingRun(uid, runId, data, now = Date.now()) {
  return write([...read().filter((p) => p.runId !== runId), { uid, runId, data, savedAt: now }].slice(-MAX_KEPT))
}

export function forgetPendingRun(runId) {
  write(read().filter((p) => p.runId !== runId))
}

// This player's runs still worth sending; the too-old ones are dropped.
export function pendingRunsOf(uid, now = Date.now()) {
  const fresh = read().filter((p) => now - p.savedAt < MAX_AGE_MS)
  write(fresh)
  return fresh.filter((p) => p.uid === uid)
}

// The server's answer is final (saved already, invalid, unknown): trying again
// can't help. Anything else (no network, 5xx, expired session) is worth a retry.
export function isFinalRefusal(err) {
  return [400, 404, 409].includes(err?.status)
}
