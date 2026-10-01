import { describe, expect, it } from 'vitest'
import { DISTRICTS, LANDMARKS, STALL_EVERY, districtAt, passerbyFor, placeVenues, stallFor, stallIndexAt } from './libreville.js'

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

describe('stallFor', () => {
  it('places a stall every STALL_EVERY m, in the order of VENDOR_STALLS', () => {
    const stalls = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => stallFor(k)).filter(Boolean)
    expect(stalls.length).toBeGreaterThan(4)
    for (const s of stalls) expect((s.at - 30) % STALL_EVERY).toBe(0)
  })

  it('keeps clear of landmark signs, district arches and billboards', () => {
    for (let k = 0; k < 200; k++) {
      const s = stallFor(k, [{ at: 470 }])
      if (!s) continue
      expect(LANDMARKS.every((l) => Math.abs(l.at - s.at) >= 10)).toBe(true)
      expect(DISTRICTS.every(([from]) => Math.abs(from - s.at) >= 12)).toBe(true)
      expect(Math.abs(470 - s.at)).toBeGreaterThanOrEqual(10)
    }
  })

  it('finds the next stall from a distance', () => {
    expect(stallIndexAt(30)).toBe(0)
    expect(stallIndexAt(31)).toBe(1)
  })
})

describe('passerbyFor', () => {
  it('stands halfway between two stalls, never on a landmark', () => {
    for (let k = 0; k < 200; k++) {
      const p = passerbyFor(k)
      if (!p) continue
      expect(p.sprite).toBeGreaterThanOrEqual(5)
      expect(LANDMARKS.every((l) => Math.abs(l.at - p.at) >= 10)).toBe(true)
      const stall = stallFor(k)
      if (stall) expect(p.at - stall.at).toBe(Math.round(STALL_EVERY / 2))
    }
  })
})
