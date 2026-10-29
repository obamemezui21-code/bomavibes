// Discover's filters (components/FilterSheet.jsx): what each one keeps, how
// many are on, and the sort orders. Pure functions, so they can be tested.
//
// Gender is applied in the Firestore query and the age while loading
// (firebase/discovery.js); everything else here, on each loaded profile.
// The distance comes from the server (lib/geolocation.js) or, failing that,
// from the two cities' centres.

export const AGE_RANGE = [18, 60]
export const HEIGHT_RANGE = [140, 210]
export const DISTANCE_MAX_KM = 100
export const ONLINE_MS = 150 * 1000 // as ConversationsContext's "En ligne"
export const RECENT_MS = 3 * 24 * 60 * 60 * 1000
export const NEW_MEMBER_MS = 7 * 24 * 60 * 60 * 1000

export const SORTS = [
  { value: 'relevance', label: 'Pertinence' },
  { value: 'distance', label: 'Distance' },
  { value: 'activity', label: 'Activité' },
  { value: 'new', label: 'Nouveauté' },
]

export const DEFAULT_FILTERS = {
  minAge: AGE_RANGE[0],
  maxAge: AGE_RANGE[1],
  gender: 'TOUS',
  maxDistanceKm: null, // null: any distance
  activity: 'all', // all | online | recent
  city: '',
  neighborhood: '',
  country: '',
  minHeight: null,
  maxHeight: null,
  relationshipStatuses: [],
  goals: [],
  interests: [],
  languages: [],
  religion: '',
  educations: [],
  job: '',
  withPhotoOnly: false,
  verifiedOnly: false,
  newOnly: false,
  travelingOnly: false,
  sort: 'relevance',
}

// What the Firestore query depends on: changing anything else doesn't need
// profiles to be read again... except that loading keeps going until enough
// profiles match, so the whole set of filters is part of the cache key.
export function loadKey(filters) {
  const { sort, maxDistanceKm, ...rest } = filters
  void sort
  void maxDistanceKm
  return JSON.stringify(rest)
}

// "Montréal" ~ "montreal ": case, accents and spaces don't matter.
export function normalize(text) {
  return (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

const hasAny = (wanted, values) => !wanted.length || (values || []).some((v) => wanted.includes(v))

/**
 * Whether a profile passes every filter except the distance (which needs the
 * server's answer, see passesDistance).
 * @param {object} p - a candidate (firebase/discovery.js): lastActiveAt / createdAtMs in ms
 */
export function matchesFilters(p, f, now = Date.now()) {
  if (f.minAge > AGE_RANGE[0] && (p.age == null || p.age < f.minAge)) return false
  if (f.maxAge < AGE_RANGE[1] && (p.age == null || p.age > f.maxAge)) return false
  if (f.activity === 'online' && !(p.lastActiveAt && now - p.lastActiveAt <= ONLINE_MS)) return false
  if (f.activity === 'recent' && !(p.lastActiveAt && now - p.lastActiveAt <= RECENT_MS)) return false
  if (f.city && !normalize(p.city).includes(normalize(f.city))) return false
  if (f.neighborhood && !normalize(p.neighborhood).includes(normalize(f.neighborhood))) return false
  if (f.country && p.country !== f.country) return false
  if (f.minHeight != null && !(p.height >= f.minHeight)) return false
  if (f.maxHeight != null && !(p.height <= f.maxHeight)) return false
  if (f.relationshipStatuses.length && !f.relationshipStatuses.includes(p.relationshipStatus)) return false
  if (f.goals.length && !f.goals.includes(p.datingGoal)) return false
  if (!hasAny(f.interests, p.interests)) return false
  if (!hasAny(f.languages, p.languages)) return false
  if (f.religion && p.religion !== f.religion) return false
  if (f.educations.length && !f.educations.includes(p.education)) return false
  if (f.job && !normalize([p.jobTitle, p.workplace].filter(Boolean).join(' ')).includes(normalize(f.job))) return false
  if (f.withPhotoOnly && !p.photos?.length) return false
  if (f.verifiedOnly && !p.verified) return false
  if (f.newOnly && !(p.createdAtMs && now - p.createdAtMs <= NEW_MEMBER_MS)) return false
  if (f.travelingOnly && !p.isTraveling) return false
  return true
}

// km: the profile's distance (server bucket or city estimate), null if unknown.
// With a maximum set, an unknown distance doesn't pass.
export function passesDistance(km, f) {
  if (f.maxDistanceKm == null) return true
  return km != null && km <= f.maxDistanceKm
}

/**
 * Sorted copy. Relevance keeps the loading order (firebase/discovery.js's
 * score); profiles with no known distance / activity / date go last.
 * @param {(p) => number|null} distanceOf
 */
export function sortProfiles(list, sort, distanceOf = () => null) {
  if (sort === 'relevance') return list
  const key =
    sort === 'distance'
      ? (p) => distanceOf(p) ?? Infinity
      : sort === 'activity'
        ? (p) => -(p.lastActiveAt || 0)
        : (p) => -(p.createdAtMs || 0)
  return list
    .map((p, i) => ({ p, i, k: key(p) }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.p)
}

// How many filters differ from the defaults (the badge on the Filtres
// button). The age range counts once, as does the height range.
export function activeFilterCount(f) {
  let n = 0
  if (f.minAge !== DEFAULT_FILTERS.minAge || f.maxAge !== DEFAULT_FILTERS.maxAge) n++
  if (f.gender !== DEFAULT_FILTERS.gender) n++
  if (f.maxDistanceKm != null) n++
  if (f.activity !== 'all') n++
  if (f.city.trim()) n++
  if (f.neighborhood.trim()) n++
  if (f.country) n++
  if (f.minHeight != null || f.maxHeight != null) n++
  for (const key of ['relationshipStatuses', 'goals', 'interests', 'languages', 'educations']) if (f[key].length) n++
  if (f.religion) n++
  if (f.job.trim()) n++
  for (const key of ['withPhotoOnly', 'verifiedOnly', 'newOnly', 'travelingOnly']) if (f[key]) n++
  if (f.sort !== 'relevance') n++
  return n
}
