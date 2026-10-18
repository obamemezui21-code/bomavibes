import { describe, expect, it } from 'vitest'
import {
  GAME_TICKS,
  LIVES,
  RIFLES,
  baseOf,
  createGame,
  isAiming,
  simulateGame,
  sizeOf,
  starsFor,
  step,
  validateInputs,
} from '../../../../shared/oeil-de-panthere/engine.mjs'

// Steps until a target matching `test` stands fully up.
function waitFor(state, test, limit = 3000) {
  for (let i = 0; i < limit && !state.over; i++) {
    const t = state.targets.find((x) => x.state === 'up' && test(x))
    if (t) return t
    step(state)
  }
  return null
}

function centreOf(t) {
  const { w, h } = sizeOf(t)
  const x = Math.trunc(t.x / 16)
  if (t.kind === 'or') return [x, t.y]
  if (t.kind === 'cible') return [x, baseOf(t) - h + Math.trunc(w / 2)]
  return [x, baseOf(t) - Math.trunc(h / 2)]
}

describe('ŒIL DE PANTHÈRE engine', () => {
  it('is deterministic for a seed', () => {
    const a = createGame(42)
    const b = createGame(42)
    for (let i = 0; i < 1200; i++) {
      step(a)
      step(b)
    }
    expect(JSON.stringify(a.targets)).toBe(JSON.stringify(b.targets))
  })

  it('scores a hit and replays it identically', () => {
    const state = createGame(7)
    const inputs = []
    const target = waitFor(state, (t) => t.kind !== 'animal' && t.row >= 0 && !t.moving)
    expect(target).toBeTruthy()
    const [x, y] = centreOf(target)
    inputs.push([state.tick, x, y])
    step(state, [[x, y]])
    expect(state.hits).toBe(1)
    expect(state.score).toBeGreaterThan(0)
    const replay = simulateGame(7, {}, inputs, state.tick)
    expect(replay.score).toBe(state.score)
  })

  it('costs a life and points to shoot a protected animal', () => {
    const state = createGame(11)
    const animal = waitFor(state, (t) => t.kind === 'animal' && !t.moving)
    expect(animal).toBeTruthy()
    step(state, [centreOf(animal)])
    expect(state.lives).toBe(LIVES - 1)
    expect(state.kills.animal).toBe(1)
  })

  it('lets a threat left standing attack after its warning', () => {
    const state = createGame(5)
    const threat = waitFor(state, (t) => (t.kind === 'braconnier' || t.kind === 'monstre') && !t.moving)
    expect(threat).toBeTruthy()
    let warned = false
    const lives = state.lives
    while (state.targets.includes(threat) && threat.state === 'up') {
      warned ||= isAiming(threat)
      step(state)
    }
    expect(warned).toBe(true)
    expect(state.lives).toBeLessThan(lives)
  })

  it('reloads when the magazine is empty', () => {
    const state = createGame(3, { rifle: 'precision' })
    const mag = RIFLES.precision.mag
    for (let i = 0; i < mag; i++) {
      step(state, [[1, 1]])
      while (state.cooldown > 0) step(state)
    }
    expect(state.ammo).toBe(0)
    expect(state.reload).toBeGreaterThan(0)
    while (state.reload > 0) step(state)
    expect(state.ammo).toBe(mag)
  })

  it('ends after 90 seconds', () => {
    const r = simulateGame(9, {}, [], GAME_TICKS + 30)
    expect(r.ticks).toBeLessThanOrEqual(GAME_TICKS)
  })

  it('validates the recorded gestures', () => {
    expect(validateInputs([[0, 10, 10], [5, 'R'], [5, 639, 359]], 10)).toBe(true)
    expect(validateInputs([[0, 640, 10]], 10)).toBe(false)
    expect(validateInputs([[5, 1, 1], [2, 1, 1]], 10)).toBe(false)
    expect(validateInputs([[0, 'X']], 10)).toBe(false)
    expect(validateInputs([[10, 1, 1]], 10)).toBe(false)
  })

  it('gives stars by score', () => {
    expect(starsFor(0)).toBe(0)
    expect(starsFor(1000)).toBe(1)
    expect(starsFor(99999)).toBe(3)
  })
})
