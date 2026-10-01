import { describe, expect, it } from 'vitest'
import { DISTRICTS, districtAt, placeVenues } from './libreville.js'

describe('districtAt', () => {
  it('follows the route as the distance grows', () => {
    expect(districtAt(0)).toBe('Bord de mer')
    expect(districtAt(299)).toBe('Bord de mer')
    expect(districtAt(300)).toBe('Louis')
    expect(districtAt(1500)).toBe('La Sablière')
    expect(districtAt(4200)).toBe('Cap Estérias')
    expect(districtAt(99999)).toBe('Owendo')
  })

  it('lists districts in increasing distance', () => {
    for (let i = 1; i < DISTRICTS.length; i++) expect(DISTRICTS[i][0]).toBeGreaterThan(DISTRICTS[i - 1][0])
  })
})

describe('placeVenues', () => {
  const louis = { name: 'Chez Test', category: 'Bar', lat: 0.415, lng: 9.436 }
  const glass = { name: 'Le Glass Test', category: 'Restaurant', lat: 0.376, lng: 9.444 }

  it('drops each venue in its own district', () => {
    const placed = placeVenues([louis, glass], 0)
    expect(placed.find((p) => p.name === 'Chez Test').at).toBeGreaterThanOrEqual(300)
    expect(placed.find((p) => p.name === 'Chez Test').at).toBeLessThan(700)
    const g = placed.find((p) => p.name === 'Le Glass Test').at
    expect(g).toBeGreaterThanOrEqual(5100)
    expect(g).toBeLessThan(5800)
  })

  it('ignores venues outside Libreville or without a position', () => {
    const portGentil = { name: 'Ailleurs', lat: -0.72, lng: 8.78 }
    expect(placeVenues([portGentil, { name: 'Sans GPS' }], 0)).toEqual([])
  })

  it('brings venues back in turn past Owendo', () => {
    const placed = placeVenues([louis], 9000)
    expect(placed.filter((p) => p.at >= 7200).length).toBeGreaterThan(1)
  })
})
