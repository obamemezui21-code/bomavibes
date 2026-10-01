import { describe, expect, it } from 'vitest'
import { coordsForProfile, distanceKmBetween, groupProfilesByCity } from './nearby.js'

const TABLE = {
  'GA|Libreville': [0.4087, 9.4419],
  'GA|Oyem': [1.599, 11.5793],
}

describe('coordsForProfile', () => {
  it('looks the city up by country code', () => {
    expect(coordsForProfile({ countryCode: 'GA', city: 'Libreville' }, TABLE)).toEqual([0.4087, 9.4419])
  })

  it('falls back to the country name when there is no code', () => {
    expect(coordsForProfile({ country: 'gabon', city: 'Oyem' }, TABLE)).toEqual([1.599, 11.5793])
  })

  it('returns null for unknown or missing cities', () => {
    expect(coordsForProfile({ countryCode: 'GA', city: 'Atlantis' }, TABLE)).toBeNull()
    expect(coordsForProfile({ countryCode: 'GA' }, TABLE)).toBeNull()
    expect(coordsForProfile({ city: 'Libreville' }, TABLE)).toBeNull()
  })
})

describe('groupProfilesByCity', () => {
  it('groups by city, biggest first, skipping profiles without coordinates', () => {
    const groups = groupProfilesByCity(
      [
        { id: 'a', countryCode: 'GA', city: 'Oyem' },
        { id: 'b', countryCode: 'GA', city: 'Libreville' },
        { id: 'c', country: 'Gabon', city: 'Libreville' },
        { id: 'd', countryCode: 'GA', city: 'Atlantis' },
      ],
      TABLE,
    )
    expect(groups.map((g) => [g.city, g.profiles.map((p) => p.id)])).toEqual([
      ['Libreville', ['b', 'c']],
      ['Oyem', ['a']],
    ])
    expect(groups[0]).toMatchObject({ lat: 0.4087, lng: 9.4419 })
  })
})

describe('distanceKmBetween', () => {
  it('is zero within the same city', () => {
    expect(distanceKmBetween({ countryCode: 'GA', city: 'Libreville' }, { countryCode: 'GA', city: 'Libreville' }, TABLE)).toBe(0)
  })

  it('measures the straight line between two city centres', () => {
    const km = distanceKmBetween({ countryCode: 'GA', city: 'Libreville' }, { countryCode: 'GA', city: 'Oyem' }, TABLE)
    expect(km).toBeGreaterThan(260)
    expect(km).toBeLessThan(275)
  })

  it('is null when a city is unknown', () => {
    expect(distanceKmBetween({ countryCode: 'GA', city: 'Libreville' }, { countryCode: 'GA', city: 'Atlantis' }, TABLE)).toBeNull()
  })
})
