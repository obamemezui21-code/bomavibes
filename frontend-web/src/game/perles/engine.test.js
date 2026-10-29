import { describe, expect, it } from 'vitest'
import {
  BALL,
  FP,
  LEVELS,
  LIVES,
  SHOOTER,
  aimHit,
  createGame,
  pathOf,
  pointAt,
  simulateGame,
  starsFor,
  step,
  validateInputs,
} from '../../../../shared/perles-punu/engine.mjs'
import { playBot } from './bot.js'

const D = BALL * FP

// A game in the middle of stage 1, with the river set by hand.
function stagedGame(beads, { current = 0 } = {}) {
  const state = createGame(7)
  state.phase = 'play'
  state.spawned = LEVELS[0].beads // nothing more rolls in
  state.chain = beads.map(([c, pos], i) => ({ id: 1000 + i, c, pos }))
  state.current = current
  state.next = current
  return state
}

function throwAt(state, beadIndex) {
  const p = pointAt(pathOf(state.level), state.chain[beadIndex].pos)
  const actions = [[Math.round(p.x / FP), Math.round(p.y / FP)]]
  const events = []
  for (let i = 0; i < 80 && (i === 0 || state.shots.length); i++) {
    step(state, i === 0 ? actions : [])
    events.push(...state.events)
  }
  return events
}

describe('PERLES PUNU engine', () => {
  it('is deterministic for a seed', () => {
    const a = createGame(42)
    const b = createGame(42)
    for (let i = 0; i < 4000; i++) {
      const act = i % 45 === 0 ? [[(i * 7) % 360, (i * 13) % 640]] : []
      step(a, act)
      step(b, act)
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('replays a whole game to the same result', () => {
    const run = playBot(1234, 100, 30)
    expect(validateInputs(run.inputs, run.endTick)).toBe(true)
    expect(simulateGame(1234, run.inputs, run.endTick)).toEqual(run.result)
    expect(run.result.levelsCleared).toBeGreaterThan(0)
  })

  it('keeps every river away from the mask, its rings apart', () => {
    for (let level = 0; level < LEVELS.length; level++) {
      const path = pathOf(level)
      const xs = Array.from(path.xs, (v) => v / FP)
      const ys = Array.from(path.ys, (v) => v / FP)
      let toMask = Infinity
      let between = Infinity
      for (let i = 0; i < xs.length; i += 3) {
        if (xs[i] > 0 && xs[i] < 360 && ys[i] > 0 && ys[i] < 640) toMask = Math.min(toMask, Math.hypot(xs[i] - SHOOTER.x, ys[i] - SHOOTER.y))
        for (let j = i + 80; j < xs.length; j += 3) between = Math.min(between, Math.hypot(xs[i] - xs[j], ys[i] - ys[j]))
      }
      expect(toMask).toBeGreaterThan(60)
      expect(between).toBeGreaterThan(BALL * 1.8)
    }
  })

  it('bursts three beads of one colour, not two', () => {
    const base = 700 * FP
    // red red | yellow, the bead in hand is red: thrown at the 2nd red.
    const state = stagedGame([[0, base], [0, base + D], [1, base + 2 * D], [1, base + 3 * D], [2, base + 4 * D]])
    const events = throwAt(state, 1)
    const burst = events.find((e) => e.type === 'burst')
    expect(burst).toBeTruthy()
    expect(burst.beads).toHaveLength(3)
    expect(state.chain.map((b) => b.c)).toEqual([1, 1, 2])
    expect(state.score).toBe(30)

    const two = stagedGame([[0, base], [1, base + D], [1, base + 2 * D], [2, base + 3 * D]])
    throwAt(two, 0)
    expect(two.chain).toHaveLength(5)
    expect(two.score).toBe(0)
  })

  it('closes a gap on matching beads and bursts them again, as a combo', () => {
    const base = 700 * FP
    // blue | gap | blue blue  — the beads ahead roll back onto the blue one.
    const state = stagedGame([[1, base], [3, base + D], [3, base + 4 * D], [3, base + 5 * D], [2, base + 6 * D]])
    let burst = null
    for (let i = 0; i < 120 && !burst; i++) {
      step(state, [])
      burst = state.events.find((e) => e.type === 'burst')
    }
    expect(burst).toBeTruthy()
    expect(burst.combo).toBe(1)
    expect(state.chain.map((b) => b.c)).toEqual([1, 2])
  })

  it('a bead reaching the falls costs a life and starts the stage again', () => {
    const end = pathOf(0).end
    const state = stagedGame([[0, end - 2 * D], [1, end - D]])
    let lost = null
    for (let i = 0; i < 400 && !lost; i++) {
      step(state, [])
      lost = state.events.find((e) => e.type === 'lost')
    }
    expect(lost.lives).toBe(LIVES - 1)
    for (let i = 0; i < 200; i++) step(state, [])
    expect(state.phase).toBe('rush')
    expect(state.level).toBe(0)
    expect(state.lives).toBe(LIVES - 1)
  })

  it('shows where a bead will land', () => {
    const base = 700 * FP
    const state = stagedGame([[0, base], [1, base + D]])
    const p = pointAt(pathOf(0), base + D)
    const hit = aimHit(state, Math.round(p.x / FP), Math.round(p.y / FP))
    expect(hit.index).toBeGreaterThanOrEqual(0)
    expect(aimHit(state, SHOOTER.x, SHOOTER.y)).toBeNull()
  })

  it('refuses gestures the app cannot send', () => {
    expect(validateInputs([[5, 100, 100], [9, 'S']], 100)).toBe(true)
    expect(validateInputs([[5, 100, 100], [4, 'S']], 100)).toBe(false) // out of order
    expect(validateInputs([[5, 400, 100]], 100)).toBe(false) // off the field
    expect(validateInputs([[5, 'B']], 100)).toBe(false)
    expect(validateInputs([[150, 1, 1]], 100)).toBe(false)
    expect(validateInputs(Array.from({ length: 200 }, (_, i) => [i, 10, 10]), 400)).toBe(false) // too many throws
  })

  it('gives stars for the score', () => {
    expect(starsFor(0)).toBe(0)
    expect(starsFor(10000)).toBe(1)
    expect(starsFor(22000)).toBe(2)
    expect(starsFor(1000000)).toBe(3)
  })
})
