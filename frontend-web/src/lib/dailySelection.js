// Slow dating (as on Once): "Ma sélection du jour" in Discover — a handful of
// profiles chosen for the member each day, to take the time to look at them
// instead of swiping through dozens.
import { compatibility, dayKey } from './mostCompatible.js'

export const SELECTION_SIZE = 5

/**
 * The best-fitting candidates not yet liked or passed: compatibility first,
 * then Discover's own ranking (activity, verified…) to break ties or fill in
 * when profiles can't be compared.
 * @returns {string[]} candidate ids
 */
export function pickDailySelection(me, candidates, size = SELECTION_SIZE) {
  return candidates
    .filter((c) => !c.alreadySwiped)
    .map((c) => ({ id: c.id, compat: compatibility(me, c)?.score ?? -1, rank: c.score ?? 0 }))
    .sort((a, b) => b.compat - a.compat || b.rank - a.rank)
    .slice(0, size)
    .map((c) => c.id)
}

const STORAGE_KEY = 'bv:dailySelection'

/**
 * Today's selection, the same all day on this device.
 * @returns {{ ids: string[], remaining: object[] }} remaining = profiles of the selection still to answer
 */
export function dailySelection(me, uid, candidates, now = new Date()) {
  const today = dayKey(now)
  let stored
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  } catch {
    stored = null
  }
  let ids = stored?.uid === uid && stored.day === today && Array.isArray(stored.ids) ? stored.ids : null
  if (!ids) {
    ids = pickDailySelection(me, candidates)
    if (!ids.length) return { ids, remaining: [] }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ uid, day: today, ids }))
    } catch {
      // private mode: the selection just isn't remembered
    }
  }
  const byId = new Map(candidates.map((c) => [c.id, c]))
  const remaining = ids.map((id) => byId.get(id)).filter((c) => c && !c.alreadySwiped)
  return { ids, remaining }
}

// "5 h 12" until the next selection (local midnight).
export function timeUntilTomorrow(now = new Date()) {
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  const minutes = Math.max(1, Math.ceil((midnight - now) / 60000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`
}
