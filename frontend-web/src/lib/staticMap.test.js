import { describe, expect, it } from 'vitest'
import { mapsLink, tilesAround, worldPixel } from './staticMap.js'

describe('worldPixel', () => {
  it('puts (0, 0) at the centre of the world map', () => {
    expect(worldPixel(0, 0, 0)).toEqual({ x: 128, y: 128 })
  })
})

describe('tilesAround', () => {
  it('covers the whole box around Libreville, the point sitting at its centre', () => {
    const [w, h] = [240, 140]
    const tiles = tilesAround(0.4087, 9.4419, 16, w, h)
    expect(tiles.length).toBeGreaterThanOrEqual(1)
    expect(tiles.length).toBeLessThanOrEqual(4)
    // Every pixel of the box is covered by some tile.
    for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [w / 2, h / 2]]) {
      expect(tiles.some((t) => x >= t.left && x < t.left + 256 && y >= t.top && y < t.top + 256)).toBe(true)
    }
    expect(tiles[0].url).toMatch(/^https:\/\/tile\.openstreetmap\.org\/16\/\d+\/\d+\.png$/)
  })
})

describe('mapsLink', () => {
  it('opens the coordinates in a maps app', () => {
    expect(mapsLink(0.4, 9.44)).toBe('https://www.google.com/maps/search/?api=1&query=0.4,9.44')
  })
})
