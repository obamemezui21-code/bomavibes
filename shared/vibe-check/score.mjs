// VIBE CHECK — how two members' answers compare. Used by the server
// (backend/src/controllers/vibeCheckController.js) and tested in
// frontend-web/src/lib/vibeCheck.test.js.
//
// answers: { [questionId]: 0 | 1 } (0 = choice a, 1 = choice b)
// weights: { [questionId]: number } (missing = 1)

// Below this many questions answered by both, there is no vibe to show yet.
export const MIN_COMMON = 5

export function vibeScore(mine, theirs, weights = {}) {
  let common = 0
  let agree = 0
  let commonWeight = 0
  let agreeWeight = 0
  const agreedOn = []
  for (const [id, answer] of Object.entries(mine || {})) {
    const other = theirs?.[id]
    if (other !== 0 && other !== 1) continue
    const w = weights[id] || 1
    common++
    commonWeight += w
    if (other === answer) {
      agree++
      agreeWeight += w
      agreedOn.push(id)
    }
  }
  if (common < MIN_COMMON) return null
  return {
    percent: Math.round((agreeWeight / commonWeight) * 100),
    // Ranking: the % pulled toward 50 (as if 6 more questions were split
    // evenly), so 9 out of 10 in common outranks a lucky 5 out of 5.
    rank: (agreeWeight + 3) / (commonWeight + 6),
    common,
    agree,
    agreedOn,
  }
}

// GENDER: 'FEMME' | 'HOMME' | other; pref: 'FEMME' | 'HOMME' | 'TOUS'
export function wants(pref, gender) {
  return pref === 'TOUS' || (!!gender && pref === gender)
}

// Both ways: each one is looking for the other's gender.
export function mutualFit(a, b) {
  return wants(a.pref, b.gender) && wants(b.pref, a.gender)
}

// The questions of a given day: `perDay` of them, walking the list in order
// (wrapping around). dayNumber can be negative.
export function dayQuestionIndexes(dayNumber, total, perDay) {
  const first = (((dayNumber * perDay) % total) + total) % total
  return Array.from({ length: Math.min(perDay, total) }, (_, k) => (first + k) % total)
}
