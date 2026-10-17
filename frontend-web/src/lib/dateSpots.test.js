import { describe, expect, it } from 'vitest'
import { rankDateSpots, scoreDateSpot } from './dateSpots.js'

const me = { city: 'Libreville', interests: ['Cuisine', 'Musique'] }
const them = { city: 'Libreville', interests: ['Cuisine', 'Danse'] }

describe('scoreDateSpot', () => {
  it('rewards a venue in both cities that fits shared interests', () => {
    const { score, reason } = scoreDateSpot({ city: 'Libreville', category: 'Restaurant' }, me, them)
    expect(score).toBe(8)
    expect(reason).toBe('À Libreville, chez vous deux · Vous aimez tous les deux : cuisine')
  })

  it('gives nothing to a venue elsewhere with no matching interest', () => {
    expect(scoreDateSpot({ city: 'Oyem', category: 'Lounge' }, { interests: [] }, { interests: [] })).toEqual({
      score: 0,
      reason: null,
    })
  })
})

describe('rankDateSpots', () => {
  it('puts the best fit first', () => {
    const venues = [
      { id: 'far', city: 'Port-Gentil', category: 'Bar' },
      { id: 'resto', city: 'Libreville', category: 'Restaurant' },
      { id: 'bar', city: 'Libreville', category: 'Bar' },
    ]
    expect(rankDateSpots(venues, me, them).map((r) => r.venue.id)).toEqual(['resto', 'bar', 'far'])
  })
})
