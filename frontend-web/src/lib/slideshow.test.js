import { describe, expect, it } from 'vitest'
import { gestureFor, nextIndex } from './slideshow.js'

describe('profile photo slideshow', () => {
  it('loops at both ends', () => {
    expect(nextIndex(0, 1, 3)).toBe(1)
    expect(nextIndex(2, 1, 3)).toBe(0)
    expect(nextIndex(0, -1, 3)).toBe(2)
    expect(nextIndex(0, 1, 1)).toBe(0)
    expect(nextIndex(0, -1, 0)).toBe(0)
  })

  it('a tap on the left half goes back, on the right half goes on', () => {
    expect(gestureFor({ dx: 0, dy: 0, x: 50, width: 400, held: false })).toBe(-1)
    expect(gestureFor({ dx: 3, dy: -2, x: 300, width: 400, held: false })).toBe(1)
  })

  it('a hold only pauses: letting go changes nothing', () => {
    expect(gestureFor({ dx: 0, dy: 0, x: 300, width: 400, held: true })).toBe(0)
  })

  it('a sideways swipe changes photo, like turning a page', () => {
    expect(gestureFor({ dx: -80, dy: 10, x: 100, width: 400, held: false })).toBe(1)
    expect(gestureFor({ dx: 80, dy: 10, x: 300, width: 400, held: true })).toBe(-1)
  })

  it('scrolling the profile up or down never changes photo', () => {
    expect(gestureFor({ dx: 20, dy: -120, x: 300, width: 400, held: false })).toBe(0)
    expect(gestureFor({ dx: -45, dy: 90, x: 300, width: 400, held: false })).toBe(0)
  })
})
