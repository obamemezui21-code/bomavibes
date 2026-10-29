import { deleteLocation, fetchDistances, saveLocation } from '../firebase/location.js'

// The member's position, for "à 5 km de toi". It's only ever asked for when
// the member taps "Activer ma position" (never on its own), sent to the
// server, and never shown to anyone: other members get a rounded distance.

const SENT_KEY = 'bv.location.sentAt'
// Set when the member wipes their position: it then stays off, even if the
// browser still allows it, until they turn it back on themselves.
const OFF_KEY = 'bv.location.off'
const RESEND_MS = 30 * 60 * 1000
const DISTANCE_TTL_MS = 10 * 60 * 1000
const BATCH = 60

// uid → { value: { km, label } | null, at }
const distanceCache = new Map()

// Why the browser gave no position, in words for the member.
export const LOCATION_ERRORS = {
  denied:
    'Position refusée. Pour voir les distances, autorise la localisation pour bomavibes.tech dans les réglages de ton navigateur. En attendant, la distance est estimée depuis ta ville.',
  unavailable: 'Impossible de trouver ta position pour le moment (GPS ou réseau). Réessaie dehors ou un peu plus tard.',
  timeout: 'La recherche de ta position a pris trop de temps. Réessaie.',
  unsupported: 'Ton navigateur ne permet pas la localisation. La distance est estimée depuis ta ville.',
}

// 'granted' | 'denied' | 'prompt' | 'unsupported' — without asking anything.
export async function locationPermission() {
  if (!('geolocation' in navigator)) return 'unsupported'
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' })
    return status?.state || 'prompt'
  } catch {
    return 'prompt' // Safari before 16: no way to know without asking
  }
}

function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(Object.assign(new Error('unsupported'), { reason: 'unsupported' }))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => {
        const reason = err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable'
        reject(Object.assign(new Error(reason), { reason }))
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    )
  })
}

function storage(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key)
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // private mode
  }
  return null
}

export function isLocationOff() {
  return storage(OFF_KEY) === '1'
}

function lastSent() {
  try {
    return Number(localStorage.getItem(SENT_KEY)) || 0
  } catch {
    return 0
  }
}

function markSent(at) {
  try {
    if (at) localStorage.setItem(SENT_KEY, String(at))
    else localStorage.removeItem(SENT_KEY)
  } catch {
    // private mode
  }
}

/**
 * Sends the member's position to the server.
 * @param {{ ask?: boolean }} options ask: the member tapped the button (the
 *   browser may show its permission prompt); otherwise it's only sent when
 *   already allowed, and not more than every 30 minutes.
 * @returns {Promise<{ ok: true } | { ok: false, reason: keyof LOCATION_ERRORS | 'skipped' }>}
 */
export async function shareLocation({ ask = false } = {}) {
  if (!ask) {
    if (isLocationOff() || Date.now() - lastSent() < RESEND_MS) return { ok: false, reason: 'skipped' }
    if ((await locationPermission()) !== 'granted') return { ok: false, reason: 'skipped' }
  }
  try {
    const { latitude, longitude } = await currentPosition()
    await saveLocation(latitude, longitude).catch((err) => {
      if (err.status !== 429) throw err // already sent a moment ago: fine
    })
    markSent(Date.now())
    storage(OFF_KEY, null)
    distanceCache.clear()
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err.reason || 'unavailable' }
  }
}

export async function forgetLocation() {
  await deleteLocation()
  storage(OFF_KEY, '1')
  markSent(0)
  distanceCache.clear()
}

/**
 * Rounded distances to these members, from the server (cached 10 min).
 * @returns {Promise<Record<string, { km: number, label: string } | null>>}
 *   null: unknown (no recent position on one side, or hidden)
 */
export async function distancesTo(uids) {
  const now = Date.now()
  const missing = [...new Set(uids)].filter((u) => u && !(now - (distanceCache.get(u)?.at || 0) < DISTANCE_TTL_MS))
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH)
    const res = await fetchDistances(batch).catch(() => null)
    if (!res) continue
    for (const u of batch) distanceCache.set(u, { value: res.distances[u] || null, at: now })
  }
  return Object.fromEntries(uids.map((u) => [u, distanceCache.get(u)?.value ?? null]))
}
