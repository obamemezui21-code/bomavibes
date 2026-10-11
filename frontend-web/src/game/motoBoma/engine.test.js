import { describe, expect, it } from 'vitest'
import {
  MAX_TICKS,
  NITRO_TICKS,
  PLAYER_LEN,
  createRace,
  decodeInputs,
  encodeInputs,
  medalFor,
  simulateRace,
  step,
  summarize,
  validateInputs,
} from '../../../../shared/moto-boma/engine.mjs'
import { playBot } from './bot.js'

const play = (seed, options) => playBot(createRace, step, summarize, seed, 'bord-de-mer', options)

describe('MOTO BOMA engine', () => {
  it('replays a race identically from its gestures (what the server does)', () => {
    for (const seed of [1, 42, 123456789, 0xdeadbeef]) {
      const { state, inputs, result } = play(seed)
      expect(simulateRace(seed, 'bord-de-mer', inputs, state.tick)).toEqual(result)
    }
  })

  it('can be finished with a medal by riding well', () => {
    const results = Array.from({ length: 20 }, (_, i) => play(i + 1).result)
    expect(results.every((r) => r.finished)).toBe(true)
    expect(results.filter((r) => r.medal).length).toBeGreaterThan(10)
  })

  it('gives no medal to a rider who never steers', () => {
    const result = simulateRace(5, 'bord-de-mer', [], MAX_TICKS)
    expect(result.finished).toBe(true)
    expect(result.medal).toBe(null)
    expect(result.bumps).toBeGreaterThan(5)
  })

  it('ignores a forged time: only the gestures count', () => {
    const { state, inputs, result } = play(99)
    const lazy = simulateRace(99, 'bord-de-mer', inputs.slice(0, 2), state.tick)
    expect(lazy.finished === false || lazy.finishTick > result.finishTick).toBe(true)
  })

  it('slows the bike down on hitting a car', () => {
    const state = createRace(1)
    for (let i = 0; i < 200; i++) step(state)
    const before = state.speed
    state.vehicles.push({ id: 9001, lane: 1, z: state.dist + PLAYER_LEN - 10, speed: 0, type: 'car', hit: false })
    step(state)
    expect(state.bumps).toBe(1)
    expect(state.speed).toBeLessThanOrEqual(before / 2)
  })

  it('finishes a lane change on its own after a short tap (lane assist)', () => {
    const state = createRace(1)
    const ride = (n, actions) => {
      for (let i = 0; i < n; i++) {
        state.vehicles = []
        step(state, i === 0 ? actions : [])
      }
    }
    ride(1, ['R'])
    ride(2, ['S'])
    expect(state.x).toBeGreaterThan(100)
    ride(30)
    expect(state.x).toBe(200)
    ride(1, ['L'])
    ride(40, ['S'])
    expect(state.x).toBe(100)
  })

  it('fires a nitro on demand, faster for a while, and only with a charge left', () => {
    const state = createRace(1)
    // An empty road: no car in the way, no nitro to pick up.
    const ride = (n, actions) => {
      for (let i = 0; i < n; i++) {
        state.vehicles = []
        state.pickups = []
        step(state, i === 0 ? actions : [])
      }
    }
    ride(300)
    const cruise = state.speed
    ride(1, ['N'])
    expect(state.nitroCharges).toBe(0)
    ride(60)
    expect(state.speed).toBeGreaterThan(cruise)
    ride(NITRO_TICKS + 200)
    expect(state.speed).toBe(cruise)
    ride(1, ['N']) // no charge left
    expect(state.nitro).toBe(0)
  })

  it('awards medals by finish time', () => {
    expect(medalFor('bord-de-mer', 5000)).toBe('gold')
    expect(medalFor('bord-de-mer', 5400)).toBe('silver')
    expect(medalFor('bord-de-mer', 5600)).toBe('bronze')
    expect(medalFor('bord-de-mer', 7000)).toBe(null)
  })

  it('stores a race compactly and replays it as the same ghost', () => {
    const { state, inputs, result } = play(2024)
    const stored = encodeInputs(inputs)
    expect(typeof stored).toBe('string')
    expect(decodeInputs(stored)).toEqual(inputs)
    expect(simulateRace(2024, 'bord-de-mer', decodeInputs(stored), state.tick)).toEqual(result)
    expect(decodeInputs('')).toEqual([])
  })

  it('rejects malformed gesture lists', () => {
    expect(validateInputs([[0, 'L'], [5, 'S'], [9, 'N']], 100)).toBe(true)
    expect(validateInputs([[5, 'L'], [3, 'S']], 100)).toBe(false)
    expect(validateInputs([[0, 'U']], 100)).toBe(false)
    expect(validateInputs([[100, 'L']], 100)).toBe(false)
    expect(validateInputs([], MAX_TICKS + 1)).toBe(false)
  })
})
