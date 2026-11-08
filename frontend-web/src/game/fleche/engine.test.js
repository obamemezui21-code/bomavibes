import { describe, expect, it } from 'vitest'
import {
  BOW,
  FP,
  GAME_TICKS,
  GROUND,
  LIVES,
  NOCK_TICKS,
  PULL_MAX,
  PULL_MIN,
  STAR_SCORES,
  W,
  createGame,
  drawOf,
  flightPath,
  simulateGame,
  starsFor,
  step,
  summarize,
  validateInputs,
} from '../../../../shared/fleche-ebene/engine.mjs'
import { aimAt, playGame } from './bot.js'

// A game with nothing in it but what the test puts there.
function emptyGame() {
  const state = createGame(1)
  state.nextSpawn = 1e9
  state.nextGold = 1e9
  return state
}

function put(state, fields) {
  const target = { id: state.nextId++, variant: 0, hp: 1, state: 'go', t: 0, y: 0, vx: 0, facing: -1, ...fields }
  state.targets.push(target)
  return target
}

function fly(state, ticks = 200) {
  for (let i = 0; i < ticks && !state.over && state.arrows.length; i++) step(state)
}

// Shoots at a standing target with the bot's aim.
function shootAt(state, target) {
  const shot = aimAt(target, state.wind)
  step(state, [[shot.ax, shot.ay]])
  fly(state)
}

describe('FLÈCHE D’ÉBÈNE engine', () => {
  it('is deterministic for a seed', () => {
    const a = createGame(42)
    const b = createGame(42)
    for (let i = 0; i < 1500; i++) {
      step(a, i % 100 === 40 ? [[90, -40]] : [])
      step(b, i % 100 === 40 ? [[90, -40]] : [])
    }
    expect(summarize(a)).toEqual(summarize(b))
    expect(a.targets.map((t) => [t.id, t.kind, t.x])).toEqual(b.targets.map((t) => [t.id, t.kind, t.x]))
  })

  it('replays a game from its gestures', () => {
    const state = createGame(7)
    const inputs = []
    for (let tick = 0; tick < 900; tick++) {
      const actions = tick % 60 === 30 ? [[100, -45]] : []
      for (const a of actions) inputs.push([tick, ...a])
      step(state, actions)
    }
    expect(simulateGame(7, inputs, 900)).toEqual(summarize(state))
  })

  it('makes arrows fall and the wind push them', () => {
    const calm = flightPath(120, 0, 0, 60)
    expect(calm[59][1]).toBeGreaterThan(BOW.y + 100)
    const helped = flightPath(100, -60, 6, 60)
    const held = flightPath(100, -60, -6, 60)
    expect(helped[59][0]).toBeGreaterThan(flightPath(100, -60, 0, 60)[59][0])
    expect(held[59][0]).toBeLessThan(flightPath(100, -60, 0, 60)[59][0])
  })

  it('reaches the far end of the scene at a full draw', () => {
    const far = flightPath(85, -85, 0, 200).find(([, y]) => y >= GROUND)
    expect(far[0]).toBeGreaterThan(W)
  })

  it('needs a real draw, cuts a too long one, and takes time to nock', () => {
    expect(drawOf(PULL_MIN - 2, 0)).toBeNull()
    expect(drawOf(-80, -20)).toBeNull()
    const cut = drawOf(100, -100)
    expect(cut.ax * cut.ax + cut.ay * cut.ay).toBeLessThanOrEqual(PULL_MAX * PULL_MAX)
    const state = emptyGame()
    step(state, [[100, -30]])
    step(state, [[100, -30]])
    expect(state.shots).toBe(1)
    for (let i = 0; i < NOCK_TICKS; i++) step(state)
    step(state, [[100, -30]])
    expect(state.shots).toBe(2)
  })

  it('scores a hit, double from far away', () => {
    const near = emptyGame()
    shootAt(near, put(near, { kind: 'potamochere', x: 250 * FP }))
    expect(near.score).toBe(20)
    const far = emptyGame()
    shootAt(far, put(far, { kind: 'potamochere', x: 500 * FP }))
    expect(far.score).toBe(40)
    expect(far.longShots).toBe(1)
  })

  it('takes two arrows in the body to bring a monster down, one in the head', () => {
    const state = emptyGame()
    const monster = put(state, { kind: 'monstre', x: 200 * FP, hp: 2 })
    step(state, [[112, 30]]) // aimed low: into the body
    fly(state)
    expect(monster.hp).toBe(1)
    expect(state.kills.monstre).toBe(0)
    for (let i = 0; i < NOCK_TICKS; i++) step(state)
    step(state, [[112, 30]])
    fly(state)
    expect(state.kills.monstre).toBe(1)
    expect(state.score).toBe(45)

    // In the head: one is enough, for double.
    const head = emptyGame()
    put(head, { kind: 'monstre', x: 200 * FP, hp: 2 })
    step(head, [[PULL_MAX, 0]])
    fly(head)
    expect(head.kills.monstre).toBe(1)
    expect(head.perfect).toBe(1)
    expect(head.score).toBe(90)
  })

  it('costs a life when a monster gets through', () => {
    const state = emptyGame()
    put(state, { kind: 'monstre', x: 125 * FP, vx: -256, hp: 2 })
    for (let i = 0; i < 20; i++) step(state)
    expect(state.lives).toBe(LIVES - 1)
    expect(state.targets).toHaveLength(0)
  })

  it('costs a life when a poacher gets to fire, then he runs away', () => {
    const state = emptyGame()
    const poacher = put(state, { kind: 'braconnier', x: 400 * FP, vx: -200, stopX: 395 * FP, life: 30 })
    for (let i = 0; i < 60; i++) step(state)
    expect(state.lives).toBe(LIVES - 1)
    expect(poacher.state).toBe('leave')
    for (let i = 0; i < 120; i++) step(state)
    expect(state.lives).toBe(LIVES - 1) // only once
  })

  it('stops an arrow on a protected animal: points and combo lost, no life, it runs away', () => {
    const state = emptyGame()
    state.score = 100
    state.combo = 6
    const animal = put(state, { kind: 'animal', x: 300 * FP, vx: -120 })
    const monster = put(state, { kind: 'monstre', x: 340 * FP, hp: 2 })
    step(state, [[120, 0]])
    fly(state)
    expect(monster.hp).toBe(2) // the animal was in the way
    expect(animal.state).toBe('flee')
    expect(state.score).toBe(50)
    expect(state.combo).toBe(0)
    expect(state.lives).toBe(LIVES)
  })

  it('never hits an animal that already ran away', () => {
    const state = emptyGame()
    const animal = put(state, { kind: 'animal', x: 300 * FP, vx: -120, state: 'flee' })
    const monster = put(state, { kind: 'monstre', x: 300 * FP, hp: 2 })
    shootAt(state, monster)
    expect(state.kills.animal).toBe(0)
    expect(animal.state).toBe('flee')
  })

  it('resets the combo on a miss, and multiplies with it', () => {
    const state = emptyGame()
    state.combo = 8
    shootAt(state, put(state, { kind: 'potamochere', x: 250 * FP }))
    expect(state.score).toBe(60) // ×3
    expect(state.combo).toBe(9)
    for (let i = 0; i < NOCK_TICKS; i++) step(state)
    step(state, [[60, -10]])
    fly(state)
    expect(state.combo).toBe(0)
  })

  it('ends after 90 s or when the lives are gone', () => {
    const timed = createGame(3)
    timed.nextSpawn = 1e9
    timed.nextGold = 1e9
    for (let i = 0; i < GAME_TICKS + 5; i++) step(timed)
    expect(timed.over).toBe(true)
    expect(summarize(timed).completed).toBe(true)
    const dead = emptyGame()
    dead.lives = 1
    put(dead, { kind: 'monstre', x: 119 * FP, vx: -256, hp: 2 })
    for (let i = 0; i < 5; i++) step(dead)
    expect(dead.over).toBe(true)
    expect(summarize(dead).completed).toBe(false)
  })

  it('brings wind and a varied forest over a game', () => {
    const state = createGame(5)
    const kinds = new Set()
    const winds = new Set()
    while (!state.over) {
      state.lives = LIVES
      step(state)
      for (const t of state.targets) kinds.add(t.kind)
      winds.add(state.wind)
    }
    expect([...kinds].sort()).toEqual(['animal', 'braconnier', 'cible', 'monstre', 'or', 'pintade', 'potamochere'])
    expect(winds.size).toBeGreaterThan(2)
  })

  it('lets a careful archer hold out in the last, hardest seconds', () => {
    const state = createGame(9)
    state.tick = GAME_TICKS - 900
    let seed = 1
    const pick = (n) => (seed = (seed * 31 + 7) % 1009) % n
    playGame(state, step, { spread: 3, every: 15 }, pick)
    expect(state.lives).toBeGreaterThan(0)
    expect(state.hits).toBeGreaterThan(5)
  }, 20000)

  it('gives stars for the score', () => {
    expect(starsFor(STAR_SCORES[0] - 1)).toBe(0)
    expect(starsFor(STAR_SCORES[0])).toBe(1)
    expect(starsFor(STAR_SCORES[2])).toBe(3)
  })

  it('refuses malformed gestures', () => {
    expect(validateInputs([[5, 90, -30]], 100)).toBe(true)
    expect(validateInputs([], 0)).toBe(false)
    expect(validateInputs([], GAME_TICKS + 1000)).toBe(false)
    expect(validateInputs([[100, 90, -30]], 100)).toBe(false) // after the end
    expect(validateInputs([[9, 90, -30], [5, 90, -30]], 100)).toBe(false) // out of order
    expect(validateInputs([[5, PULL_MAX + 1, 0]], 100)).toBe(false)
    expect(validateInputs([[5, 1.5, 0]], 100)).toBe(false)
    expect(validateInputs([[5, 90]], 100)).toBe(false)
    expect(validateInputs('[]', 100)).toBe(false)
    const flood = Array.from({ length: 400 }, (_, i) => [i, 90, 0])
    expect(validateInputs(flood, 600)).toBe(false)
  })
})
