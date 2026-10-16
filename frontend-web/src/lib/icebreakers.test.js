import { describe, expect, it } from 'vitest'
import { icebreakersFor } from './icebreakers.js'

describe('icebreakersFor', () => {
  it('puts personal ideas first: prompts, shared interests, city', () => {
    const other = {
      city: 'Oyem',
      interests: ['Musique', 'Cuisine'],
      prompts: [{ question: 'Le plat qui me fait craquer…', answer: 'Le nyembwe' }],
    }
    const ideas = icebreakersFor(other, ['Musique'], 1, 3)
    expect(ideas).toHaveLength(3)
    expect(ideas.some((i) => i.includes('Le plat qui me fait craquer'))).toBe(true)
    expect(ideas.some((i) => i.includes('musique'))).toBe(true)
    expect(ideas.some((i) => i.includes('Oyem'))).toBe(true)
  })

  it('falls back to general ideas and changes with the seed', () => {
    const a = icebreakersFor({}, [], 1)
    const b = icebreakersFor({}, [], 2)
    expect(a).toHaveLength(3)
    expect(new Set(a).size).toBe(3)
    expect(a).not.toEqual(b)
  })
})
