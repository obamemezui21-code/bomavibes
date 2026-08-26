import { describe, expect, it } from 'vitest'
import { Tag } from 'lucide-react'
import { iconForInterest, matchPercent } from './interests.js'

describe('matchPercent', () => {
  it('returns null when either side has no interests', () => {
    expect(matchPercent([], ['Cuisine'])).toBeNull()
    expect(matchPercent(['Cuisine'], [])).toBeNull()
    expect(matchPercent(null, ['Cuisine'])).toBeNull()
    expect(matchPercent(['Cuisine'], undefined)).toBeNull()
  })

  it('is 100% when the smaller list is fully contained in the other', () => {
    expect(matchPercent(['Cuisine', 'Voyages'], ['Cuisine', 'Voyages', 'Musique'])).toBe(100)
  })

  it('is 0% when there is no overlap at all', () => {
    expect(matchPercent(['Cuisine'], ['Musique'])).toBe(0)
  })

  it('divides by the smaller list, not the union, so it can still read 100%', () => {
    // 1 shared interest, but "my" list only has 1 — matches from the
    // perspective of "how much of what I'm into do they share".
    expect(matchPercent(['Cuisine'], ['Cuisine', 'Musique', 'Sport'])).toBe(100)
  })

  it('rounds to the nearest percent', () => {
    // 1 shared out of a 3-length smaller list = 33.33...%
    expect(matchPercent(['Cuisine', 'Musique', 'Sport'], ['Cuisine', 'Art', 'Danse'])).toBe(33)
  })
})

describe('iconForInterest', () => {
  it('returns the mapped icon for a known interest', () => {
    expect(iconForInterest('Cuisine')).toBeDefined()
  })

  it('falls back to the generic tag icon for an unknown interest', () => {
    expect(iconForInterest('Astrophysique nucléaire')).toBe(Tag)
  })
})
