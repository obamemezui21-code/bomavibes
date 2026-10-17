// "Idées de rendez-vous" in the chat: the Coins Chics (published venues)
// that suit both people of a match best — in their city, and of a kind that
// fits the interests they share.

// Which interests point to which kind of venue.
const CATEGORY_INTERESTS = {
  Restaurant: ['Cuisine', 'Café', 'Famille', 'Voyages', 'Culture africaine', 'Lecture'],
  Bar: ['Musique', 'Football', 'Sport', 'Danse', 'Jeux vidéo', 'Cinéma'],
  Lounge: ['Danse', 'Musique', 'Mode', 'Business', 'Entrepreneuriat', 'Art', 'Photo'],
}

const sameText = (a, b) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * @param {object} venue - { city, category, … }
 * @param {object} me - my public profile
 * @param {object} them - the match's profile
 * @returns {{ score: number, reason: string | null }}
 */
export function scoreDateSpot(venue, me, them) {
  let score = 0
  let reason = null

  const inMyCity = sameText(venue.city, me?.city)
  const inTheirCity = sameText(venue.city, them?.city)
  if (inMyCity && inTheirCity) {
    score += 6
    reason = `À ${venue.city}, chez vous deux`
  } else if (inMyCity || inTheirCity) {
    score += 3
    reason = `À ${venue.city}`
  }

  const fits = CATEGORY_INTERESTS[venue.category] || []
  const mine = me?.interests || []
  const theirs = them?.interests || []
  const shared = fits.filter((i) => mine.includes(i) && theirs.includes(i))
  const oneSided = fits.filter((i) => !shared.includes(i) && (mine.includes(i) || theirs.includes(i)))
  score += shared.length * 2 + oneSided.length
  if (shared.length) {
    const why = `Vous aimez tous les deux : ${shared.slice(0, 2).join(', ').toLowerCase()}`
    reason = reason ? `${reason} · ${why}` : why
  }

  if (venue.image) score += 0.5 // a photo makes the invite card nicer
  return { score, reason }
}

/** Venues sorted best first, each with its { score, reason }. */
export function rankDateSpots(venues, me, them) {
  return venues
    .map((venue) => ({ venue, ...scoreDateSpot(venue, me, them) }))
    .sort((a, b) => b.score - a.score)
}

// The nudge above the input shows once a conversation is going, until the
// member sends an invite or closes it (remembered per conversation).
export const DATE_NUDGE_MIN_MESSAGES = 12
const NUDGE_KEY = 'bv:dateNudgeClosed'

export function isDateNudgeClosed(matchId) {
  try {
    return JSON.parse(localStorage.getItem(NUDGE_KEY) || '[]').includes(matchId)
  } catch {
    return false
  }
}

export function closeDateNudge(matchId) {
  try {
    const closed = JSON.parse(localStorage.getItem(NUDGE_KEY) || '[]')
    localStorage.setItem(NUDGE_KEY, JSON.stringify([...closed.filter((id) => id !== matchId), matchId].slice(-200)))
  } catch {
    // storage unavailable: the nudge just comes back next time
  }
}
