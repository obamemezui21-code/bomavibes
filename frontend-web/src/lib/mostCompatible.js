// "Le plus compatible du jour" (Hinge's Most Compatible): once a day, the
// Discover candidate who fits the member best is put forward on its own card.

const MIN_SCORE = 40

function shared(a, b) {
  if (!a?.length || !b?.length) return []
  return b.filter((x) => a.includes(x))
}

/**
 * How well `them` fits `me`, from what both filled in on their profile.
 * Only criteria both of them answered count, so a sparse profile isn't
 * punished for what it left out.
 * @returns {{ score: number, reasons: string[] } | null} score 0–100, null when nothing can be compared
 */
export function compatibility(me, them) {
  const parts = []
  const reasons = []

  if (me?.interests?.length && them?.interests?.length) {
    const common = shared(me.interests, them.interests)
    parts.push([45, common.length / Math.min(me.interests.length, them.interests.length)])
    if (common.length) reasons.push(`${common.length} centre${common.length > 1 ? 's' : ''} d'intérêt en commun`)
  }
  if (me?.datingGoal && them?.datingGoal) {
    const same = me.datingGoal === them.datingGoal
    parts.push([20, same ? 1 : 0])
    if (same) reasons.push(`Vous cherchez tous les deux : ${them.datingGoal.toLowerCase()}`)
  }
  if (me?.country && them?.country) {
    const sameCity = !!me.city && me.city === them.city
    parts.push([15, sameCity ? 1 : me.country === them.country ? 0.5 : 0])
    if (sameCity) reasons.push(`Vous êtes tous les deux à ${them.city}`)
  }
  if (me?.languages?.length && them?.languages?.length) {
    const common = shared(me.languages, them.languages)
    parts.push([10, common.length ? 1 : 0])
  }
  if (me?.personalityTraits?.length && them?.personalityTraits?.length) {
    const common = shared(me.personalityTraits, them.personalityTraits)
    parts.push([10, common.length / Math.min(me.personalityTraits.length, them.personalityTraits.length)])
    if (common.length) reasons.push(`Même personnalité : ${common.slice(0, 2).join(', ').toLowerCase()}`)
  }

  const weight = parts.reduce((sum, [w]) => sum + w, 0)
  if (!weight) return null
  const score = Math.round((parts.reduce((sum, [w, v]) => sum + w * v, 0) / weight) * 100)
  return { score, reasons }
}

/**
 * The day's most compatible candidate among those not yet liked or passed.
 * @param {object} me - the member's public profile
 * @param {object[]} candidates - Discover candidates (fetchDiscoverCandidates)
 * @returns {{ profile: object, score: number, reasons: string[] } | null}
 */
export function pickMostCompatible(me, candidates) {
  let best = null
  for (const profile of candidates) {
    if (profile.alreadySwiped) continue
    const result = compatibility(me, profile)
    if (!result || result.score < MIN_SCORE) continue
    const better =
      !best ||
      result.score > best.score ||
      (result.score === best.score && !!profile.verified && !best.profile.verified)
    if (better) best = { profile, ...result }
  }
  return best
}

export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

// The pick stays the same all day on this device, even when the candidate
// list is reloaded; once that profile is liked or passed, nothing until tomorrow.
const STORAGE_KEY = 'bv:mostCompatible'

export function dailyMostCompatible(me, uid, candidates, now = new Date()) {
  const today = dayKey(now)
  let stored = null
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  } catch {
    stored = null
  }
  if (stored?.uid === uid && stored.day === today) {
    const profile = candidates.find((c) => c.id === stored.id && !c.alreadySwiped)
    if (!profile) return null
    return { profile, ...(compatibility(me, profile) || { score: 0, reasons: [] }) }
  }
  const pick = pickMostCompatible(me, candidates)
  if (pick) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ uid, day: today, id: pick.profile.id }))
    } catch {
      // private mode: the pick just isn't remembered
    }
  }
  return pick
}
