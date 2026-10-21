import { describe, expect, it } from 'vitest'
import {
  BOSS_TICK,
  FP,
  JETS,
  KINDS,
  bossOf,
  createGame,
  simulateGame,
  starsFor,
  step,
  validateInputs,
} from '../../../../shared/escadrille-ogooue/engine.mjs'
import { playBot } from './bot.js'

describe('ESCADRILLE OGOUÉ engine', () => {
  it('is deterministic for a seed', () => {
    const a = createGame(42)
    const b = createGame(42)
    for (let i = 0; i < 3000; i++) {
      step(a, i % 90 === 0 ? [[(i * 7) % 360, 400]] : [])
      step(b, i % 90 === 0 ? [[(i * 7) % 360, 400]] : [])
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('replays a whole sortie to the same result', () => {
    for (const jet of Object.keys(JETS)) {
      const run = playBot(1234, { jet })
      expect(validateInputs(run.inputs, run.endTick)).toBe(true)
      const replay = simulateGame(1234, { jet }, run.inputs, run.endTick)
      expect(replay).toEqual(run.result)
    }
  })

  it('flies the jet toward the point it is given, at its top speed', () => {
    const state = createGame(1, { jet: 'faucon' })
    const x0 = state.player.x
    step(state, [[0, 600]])
    expect(state.player.x).toBe(x0 - JETS.faucon.speed * FP)
  })

  it('fires on its own and shoots enemies down', () => {
    const state = createGame(3)
    let guard = 0
    while (!state.kills.drone && !state.over && guard++ < 6000) {
      const target = state.enemies.find((e) => e.y > 0 && !KINDS[e.kind].ground)
      step(state, target ? [[Math.trunc(target.x / FP), 560]] : [])
    }
    expect(state.score).toBeGreaterThan(0)
  })

  it('clears the bullets and damages everything with a bomb', () => {
    const state = createGame(5)
    const shield = () => (state.player.inv = 1000) // the test is about the bomb, not dodging
    while (!state.bullets.length && state.tick < 6000) {
      shield()
      step(state)
    }
    const bombs = state.bombs
    step(state, [['B']])
    expect(state.bombs).toBe(bombs - 1)
    expect(state.bullets.length).toBe(0)
    expect(state.bombing).toBeGreaterThan(0)
  })

  it('loses a heart when hit, then blinks', () => {
    const state = createGame(8)
    const hp = state.hp
    state.bullets.push({ x: state.player.x, y: state.player.y, vx: 0, vy: 0 })
    step(state)
    expect(state.hp).toBe(hp - 1)
    expect(state.player.inv).toBeGreaterThan(0)
    state.bullets.push({ x: state.player.x, y: state.player.y, vx: 0, vy: 0 })
    step(state)
    expect(state.hp).toBe(hp - 1)
  })

  it('sends the Condor Noir after the waves, and wins once it is down', () => {
    const state = createGame(11, { jet: 'calao' })
    const shield = () => (state.player.inv = 1000) // the test is about the sortie's script, not dodging
    while (!bossOf(state) && state.tick < BOSS_TICK + 1200) {
      shield()
      step(state)
    }
    const boss = bossOf(state)
    expect(boss).toBeTruthy()
    expect(state.tick).toBeGreaterThanOrEqual(BOSS_TICK)
    while (!state.over) {
      shield()
      step(state, [[Math.trunc(boss.x / FP), 560]])
    }
    expect(state.won).toBe(true)
    expect(state.kills.boss).toBe(1)
  })

  it('validates the recorded gestures', () => {
    expect(validateInputs([[0, 10, 10], [5, 'B'], [5, 360, 640]], 10)).toBe(true)
    expect(validateInputs([[0, 361, 10]], 10)).toBe(false)
    expect(validateInputs([[5, 1, 1], [2, 1, 1]], 10)).toBe(false)
    expect(validateInputs([[0, 'X']], 10)).toBe(false)
    expect(validateInputs([[10, 1, 1]], 10)).toBe(false)
    expect(validateInputs(Array.from({ length: 100 }, (_, i) => [i, 1, 1]), 100)).toBe(false)
  })

  it('gives stars by score', () => {
    expect(starsFor(0)).toBe(0)
    expect(starsFor(15000)).toBe(1)
    expect(starsFor(999999)).toBe(3)
  })
})
