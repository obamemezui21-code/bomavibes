import { describe, expect, it } from 'vitest'
import { DISTRICTS, districtAt } from './libreville.js'

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
