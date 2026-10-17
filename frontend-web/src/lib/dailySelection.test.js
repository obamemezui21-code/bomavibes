import { describe, expect, it } from 'vitest'
import { pickDailySelection, timeUntilTomorrow } from './dailySelection.js'

const me = { interests: ['Musique', 'Cuisine'], datingGoal: 'Amitié' }

describe('pickDailySelection', () => {
  it('ranks by compatibility, then Discover score, and skips swiped profiles', () => {
    const candidates = [
      { id: 'low', interests: ['Sport'], score: 200 },
      { id: 'best', interests: ['Musique', 'Cuisine'], datingGoal: 'Amitié', score: 10 },
      { id: 'swiped', interests: ['Musique', 'Cuisine'], alreadySwiped: true },
      { id: 'blank-high', score: 90 },
      { id: 'blank-low', score: 5 },
    ]
    expect(pickDailySelection(me, candidates, 4)).toEqual(['best', 'low', 'blank-high', 'blank-low'])
  })
})

describe('timeUntilTomorrow', () => {
  it('counts down to local midnight', () => {
    expect(timeUntilTomorrow(new Date(2026, 9, 17, 18, 48))).toBe('5 h 12')
    expect(timeUntilTomorrow(new Date(2026, 9, 17, 23, 30))).toBe('30 min')
  })
})
