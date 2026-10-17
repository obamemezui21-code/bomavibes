import { describe, expect, it } from 'vitest'
import { compatibility, pickMostCompatible } from './mostCompatible.js'

const me = {
  interests: ['Musique', 'Cuisine', 'Voyage'],
  datingGoal: 'Relation sérieuse',
  city: 'Libreville',
  country: 'Gabon',
  languages: ['Français'],
}

describe('compatibility', () => {
  it('is 100 when everything matches', () => {
    const result = compatibility(me, { ...me })
    expect(result.score).toBe(100)
    expect(result.reasons).toContain("3 centres d'intérêt en commun")
  })

  it('only counts what both profiles filled in', () => {
    expect(compatibility(me, { interests: ['Musique', 'Cuisine', 'Voyage'] }).score).toBe(100)
    expect(compatibility(me, {})).toBeNull()
  })

  it('gives half the place points for the same country', () => {
    expect(compatibility({ country: 'Gabon', city: 'Libreville' }, { country: 'Gabon', city: 'Oyem' }).score).toBe(50)
  })
})

describe('pickMostCompatible', () => {
  it('skips profiles already swiped and weak matches', () => {
    const candidates = [
      { id: 'a', ...me, alreadySwiped: true },
      { id: 'b', interests: ['Sport'], datingGoal: 'Amitié', country: 'Congo' },
      { id: 'c', interests: ['Musique'], datingGoal: 'Relation sérieuse', country: 'Gabon', city: 'Libreville' },
    ]
    expect(pickMostCompatible(me, candidates).profile.id).toBe('c')
    expect(pickMostCompatible(me, candidates.slice(0, 2))).toBeNull()
  })

  it('prefers a verified profile on a tie', () => {
    const p = { interests: ['Musique'] }
    expect(pickMostCompatible(me, [{ id: 'x', ...p }, { id: 'y', ...p, verified: true }]).profile.id).toBe('y')
  })
})
