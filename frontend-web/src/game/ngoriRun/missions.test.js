import { describe, expect, it } from 'vitest'
import { MISSIONS, missionsFor, missionsView, progressAfter } from '../../../../shared/ngori-run/missions.mjs'
import { createRun, simulateRun, step } from '../../../../shared/ngori-run/engine.mjs'

const run = (fields) => ({ distance: 0, coins: 0, bestCombo: 0, rivers: 0, flights: 0, powerups: 0, smashes: 0, ...fields })

describe('NGORI RUN daily missions', () => {
  it('picks one mission per tier, the same for everyone on a given day', () => {
    for (let d = 1; d <= 60; d++) {
      const day = `2026-11-${String((d % 28) + 1).padStart(2, '0')}`
      const picked = missionsFor(day)
      expect(picked.map((m) => m.tier)).toEqual([0, 1, 2])
      expect(missionsFor(day)).toEqual(picked)
      // never twice the same metric and mode
      expect(new Set(picked.map((m) => `${m.metric}/${m.mode}`)).size).toBe(3)
    }
  })

  it('varies from one day to the next', () => {
    const days = Array.from({ length: 30 }, (_, i) => missionsFor(`2026-12-${String(i + 1).padStart(2, '0')}`).map((m) => m.id).join())
    expect(new Set(days).size).toBeGreaterThan(10)
  })

  it('adds up "sum" missions and keeps the best run for "max" ones, capped at the goal', () => {
    const total = MISSIONS.find((m) => m.id === 'total3k')
    const single = MISSIONS.find((m) => m.id === 'dist1500')
    const games = MISSIONS.find((m) => m.id === 'games3')
    expect(progressAfter(total, 1200, run({ distance: 900 }))).toBe(2100)
    expect(progressAfter(total, 2500, run({ distance: 900 }))).toBe(3000)
    expect(progressAfter(single, 1200, run({ distance: 900 }))).toBe(1200)
    expect(progressAfter(single, 1200, run({ distance: 1800 }))).toBe(1500)
    expect(progressAfter(games, 2, run({}))).toBe(3)
  })

  it('shows progress, reward and done', () => {
    const [easy] = missionsFor('2026-10-19')
    const view = missionsView('2026-10-19', { progress: { [easy.id]: easy.goal } }, [1, 1, 2])
    expect(view[0]).toMatchObject({ id: easy.id, done: true, reward: 1 })
    expect(view[2]).toMatchObject({ progress: 0, done: false, reward: 2 })
  })

  it('every metric is counted by the engine', () => {
    const result = simulateRun(42, [], 60)
    for (const m of MISSIONS) if (m.metric !== 'games') expect(result).toHaveProperty(m.metric)
  })

  it('counts a flight and a river crossed', () => {
    const state = createRun(7)
    step(state, ['B'])
    expect(state.flights).toBe(1)
    // Jump straight to just before the end of the first river.
    state.dist = 1419 * 100
    state.swim = true
    state.obstacles = []
    state.nextRowZ = state.dist + 20000
    for (let i = 0; i < 20; i++) step(state)
    expect(state.rivers).toBe(1)
  })
})
