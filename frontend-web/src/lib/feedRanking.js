import { matchPercent } from './interests.js'

const HOUR_MS = 60 * 60 * 1000

function toMillis(value) {
  return value?.toMillis?.() ?? null
}

// Higher score = shown first. Client-side only, computed over an already
// fetched window of posts — no stored score field, no server job.
export function scoreForYou(post, author, myInterests, now = Date.now()) {
  const createdAtMs = toMillis(post.createdAt)
  const hoursSince = createdAtMs != null ? (now - createdAtMs) / HOUR_MS : Infinity

  let recencyPoints = 0
  if (hoursSince <= 1) recencyPoints = 100
  else if (hoursSince <= 6) recencyPoints = 70
  else if (hoursSince <= 24) recencyPoints = 40
  else if (hoursSince <= 72) recencyPoints = 15

  const compat = matchPercent(myInterests, author?.interests)
  const interestPoints = compat != null ? compat * 0.6 : 0 // weighted ~2x a plain recency tier

  const engagement = (post.likeCount || 0) + (post.commentCount || 0)
  const popularityBonus = Math.min(20, Math.log2(engagement + 1) * 5)

  return recencyPoints + interestPoints + popularityBonus
}

export function sortForYou(posts, authorsById, myInterests) {
  const now = Date.now()
  return [...posts].sort(
    (a, b) => scoreForYou(b, authorsById[b.authorId], myInterests, now) - scoreForYou(a, authorsById[a.authorId], myInterests, now),
  )
}

export function sortPopular(posts) {
  return [...posts].sort((a, b) => {
    const engagementDiff = (b.likeCount || 0) + (b.commentCount || 0) - ((a.likeCount || 0) + (a.commentCount || 0))
    if (engagementDiff !== 0) return engagementDiff
    return (toMillis(b.createdAt) || 0) - (toMillis(a.createdAt) || 0)
  })
}
