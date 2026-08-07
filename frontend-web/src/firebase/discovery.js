import { collection, getDocs, limit, query, startAfter, where } from 'firebase/firestore'
import { db } from './config.js'
import { fetchBlockedIds } from './safety.js'
import { matchPercent } from '../lib/interests.js'

const BATCH_SIZE = 30
const MAX_PAGES = 3
const MIN_CANDIDATES = 10

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

// A like without a reply only resurfaces once it's plausible the other
// person will actually see it again: enough time has passed, or they've
// reconnected / updated their profile since the like.
const LIKE_COOLDOWN_HOURS = 12
const RECENTLY_UPDATED_HOURS = 72
const REFUSED_SCORE = -1000

function toMillis(value) {
  return value?.toMillis?.() ?? null
}

async function getMySwipes(uid) {
  const snap = await getDocs(query(collection(db, 'swipes'), where('swiperId', '==', uid)))
  const map = new Map()
  snap.docs.forEach((d) => {
    const data = d.data()
    map.set(data.targetId, { direction: data.direction, at: toMillis(data.createdAt) })
  })
  return map
}

// Higher score = shown first. Returns null when a candidate isn't eligible
// to resurface at all yet (e.g. liked too recently, still awaiting a reply).
function scoreCandidate(candidate, { mySwipe, hasSeenThisSession, myInterests, now }) {
  let score = 0

  if (!mySwipe) {
    score += hasSeenThisSession ? 60 : 100 // priority 1 / priority 2
  } else if (mySwipe.direction === 'like' || mySwipe.direction === 'superlike') {
    const hoursSinceLike = mySwipe.at ? (now - mySwipe.at) / HOUR_MS : Infinity
    const reconnectedSince = candidate.lastActiveAt && mySwipe.at && candidate.lastActiveAt > mySwipe.at
    const updatedSince = candidate.updatedAtMs && mySwipe.at && candidate.updatedAtMs > mySwipe.at
    const dueForRetry = hoursSinceLike >= LIKE_COOLDOWN_HOURS || reconnectedSince || updatedSince
    if (!dueForRetry) return null
    score += 30 // priority 3
  }

  if (candidate.lastActiveAt) {
    const minsSinceActive = (now - candidate.lastActiveAt) / MINUTE_MS
    if (minsSinceActive <= 10) score += 40 // priority 4: very recently online
    else if (now - candidate.lastActiveAt <= DAY_MS) score += 20 // active today
  }

  if (candidate.updatedAtMs && now - candidate.updatedAtMs <= RECENTLY_UPDATED_HOURS * HOUR_MS) {
    score += 20 // priority 5
  }

  const compat = matchPercent(myInterests, candidate.interests)
  if (compat != null && compat >= 50) score += 25 // compatibility bonus

  return score
}

/**
 * @param {object} options
 * @param {Set<string>} [options.seenIds] - candidate ids already shown this session (client-tracked, not persisted)
 * @param {boolean} [options.includeRefused] - re-include previously passed profiles ("Revoir les profils")
 * @param {string[]} [options.myInterests] - current user's interests, for the compatibility bonus
 */
export async function fetchDiscoverCandidates(uid, filters, options = {}) {
  const { seenIds = new Set(), includeRefused = false, myInterests = [] } = options
  const [mySwipes, blockedIds] = await Promise.all([getMySwipes(uid), fetchBlockedIds(uid)])
  const now = Date.now()

  const candidates = []
  let lastDoc = null

  for (let page = 0; page < MAX_PAGES; page++) {
    const constraints = []
    if (filters.gender && filters.gender !== 'TOUS') {
      constraints.push(where('gender', '==', filters.gender))
    }
    if (lastDoc) constraints.push(startAfter(lastDoc))
    constraints.push(limit(BATCH_SIZE))

    const snap = await getDocs(query(collection(db, 'profiles'), ...constraints))
    if (snap.empty) break
    lastDoc = snap.docs[snap.docs.length - 1]

    for (const docSnap of snap.docs) {
      const id = docSnap.id
      if (id === uid || blockedIds.has(id)) continue
      const data = docSnap.data()
      if (filters.minAge != null && data.age != null && data.age < filters.minAge) continue
      if (filters.maxAge != null && data.age != null && data.age > filters.maxAge) continue

      const mySwipe = mySwipes.get(id) || null
      const isRefused = mySwipe?.direction === 'pass'
      if (isRefused && !includeRefused) continue // priority 6, hidden unless explicitly reviewing

      const candidate = {
        id,
        ...data,
        lastActiveAt: toMillis(data.lastActive),
        updatedAtMs: toMillis(data.updatedAt),
      }

      if (isRefused) {
        candidate.score = REFUSED_SCORE
        candidates.push(candidate)
        continue
      }

      const score = scoreCandidate(candidate, { mySwipe, hasSeenThisSession: seenIds.has(id), myInterests, now })
      if (score == null) continue
      candidate.score = score
      candidates.push(candidate)
    }

    if (candidates.length >= MIN_CANDIDATES || snap.docs.length < BATCH_SIZE) break
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates
}
