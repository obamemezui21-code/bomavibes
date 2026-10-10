import { describe, expect, it } from 'vitest'
import {
  JUMP_TICKS,
  MAX_TICKS,
  OBSTACLES,
  PLAYER_LEN,
  baseSpeed,
  createRun,
  simulateRun,
  step,
  summarize,
  validateInputs,
} from '../../../../shared/ngori-run/engine.mjs'

function laneClear(state, lane, from, to) {
  return !state.obstacles.some((o) => o.lane === lane && !o.hit && o.z < to && o.z + OBSTACLES[o.type].len > from)
}

// A simple autopilot: dodges what's coming in its lane, the way a decent
// player would. Used to prove every generated road can be survived.
function botActions(state) {
  const look = state.speed * 14
  const front = state.dist + PLAYER_LEN
  const danger = state.obstacles
    .filter((o) => o.lane === state.lane && !o.hit && o.z + OBSTACLES[o.type].len > state.dist && o.z < front + look)
    .sort((a, b) => a.z - b.z)[0]
  if (!danger) return []
  const def = OBSTACLES[danger.type]
  const moveTo = (lane) => Array(Math.abs(lane - state.lane)).fill(lane < state.lane ? 'L' : 'R')
  // Nearest free lane first (two quick swipes if needed)…
  const byDistance = [0, 1, 2].filter((l) => l !== state.lane).sort((a, b) => Math.abs(a - state.lane) - Math.abs(b - state.lane))
  for (const lane of byDistance) {
    if (laneClear(state, lane, state.dist - 50, front + look + 400)) return moveTo(lane)
  }
  // …else a lane where the obstacle can be jumped or slid under.
  if (!def.clear) {
    for (const lane of byDistance) {
      const there = state.obstacles.filter(
        (o) => o.lane === lane && !o.hit && o.z + OBSTACLES[o.type].len > state.dist && o.z < front + look,
      )
      if (there.length && there.every((o) => OBSTACLES[o.type].clear)) return moveTo(lane)
    }
  }
  const ahead = danger.z - front
  if (def.clear === 'jump' && !state.jump && ahead <= state.speed * 5) return ['U']
  if (def.clear === 'slide' && !state.slide && ahead <= state.speed * 6) return ['D']
  return []
}

function playBot(seed, maxTicks) {
  const state = createRun(seed)
  const inputs = []
  while (!state.over && state.tick < maxTicks) {
    const actions = botActions(state)
    for (const a of actions) inputs.push([state.tick, a])
    step(state, actions)
  }
  return { state, inputs, result: summarize(state) }
}

describe('NGORI RUN engine', () => {
  it('replays a run identically from its gestures (what the server does)', () => {
    for (const seed of [1, 42, 123456789, 0xdeadbeef]) {
      const { state, inputs, result } = playBot(seed, 60 * 60 * 3)
      expect(simulateRun(seed, inputs, state.tick)).toEqual(result)
    }
  })

  it('always leaves a way through: the autopilot survives long runs', () => {
    const distances = []
    for (let seed = 1; seed <= 40; seed++) distances.push(playBot(seed, 60 * 60 * 3).result.distance)
    const median = distances.sort((a, b) => a - b)[20]
    expect(median).toBeGreaterThan(2000)
  })

  it('crashes a runner who never moves', () => {
    const result = simulateRun(7, [], MAX_TICKS)
    expect(result.crashed).toBe(true)
    expect(result.distance).toBeLessThan(400)
  })

  it('ignores a forged score: only the gestures count', () => {
    const { state, inputs } = playBot(99, 60 * 60)
    // Dropping the dodges makes the replay crash early, whatever the client claims.
    const forged = simulateRun(99, inputs.slice(0, 2), state.tick)
    expect(forged.distance).toBeLessThan(summarize(state).distance)
  })

  it('pays combo and distance bonuses', () => {
    const { result } = playBot(5, 60 * 60 * 3)
    expect(result.distance).toBeGreaterThan(1000)
    expect(result.bonus).toBeGreaterThanOrEqual(3) // 500 m + 1 km
    expect(result.total).toBe(result.coins + result.bonus)
  })

  it('jumps last a fixed number of ticks', () => {
    const state = createRun(1)
    step(state, ['U'])
    for (let i = 0; i < JUMP_TICKS; i++) step(state)
    expect(state.jump).toBe(0)
  })

  it('rides the black panther: twice the speed, obstacles knocked away, then a short grace', () => {
    const state = createRun(3)
    for (let i = 0; i < 10; i++) step(state)
    state.powerups.push({ id: 9001, z: state.dist + PLAYER_LEN - 1, lane: state.lane, type: 'panther', taken: false })
    step(state)
    expect(state.panther).toBeGreaterThan(0)
    step(state) // the new speed applies from the next tick
    expect(state.speed).toBe(baseSpeed(state.tick) * 2)

    state.obstacles.push({ id: 9002, z: state.dist + PLAYER_LEN + 10, lane: state.lane, type: 'car' })
    for (let i = 0; i < 20; i++) step(state)
    expect(state.crashed).toBe(false)
    expect(state.obstacles.find((o) => o.id === 9002)?.hit).toBe(true)

    while (state.panther && !state.over) step(state)
    expect(state.grace).toBeGreaterThan(0)
  })

  it('places black panthers on the road, more rarely than the other power-ups', () => {
    const state = createRun(11)
    const seen = new Map()
    while (state.tick < 60 * 60 * 10) {
      state.dist += 400 // fly over the road: only the generated layout matters here
      state.grace = 2
      step(state)
      for (const p of state.powerups) seen.set(p.id, p.type)
    }
    const counts = {}
    for (const type of seen.values()) counts[type] = (counts[type] || 0) + 1
    expect(counts.panther).toBeGreaterThan(0)
    expect(counts.panther).toBeLessThan(counts.shield + counts.magnet + counts.multiplier + counts.boost)
  })

  it('rejects malformed gesture lists', () => {
    expect(validateInputs([[0, 'L'], [5, 'U']], 100)).toBe(true)
    expect(validateInputs([[5, 'L'], [3, 'U']], 100)).toBe(false) // out of order
    expect(validateInputs([[0, 'X']], 100)).toBe(false)
    expect(validateInputs([[100, 'L']], 100)).toBe(false) // after the end
    expect(validateInputs([], MAX_TICKS + 1)).toBe(false)
    expect(validateInputs(Array.from({ length: 200 }, (_, i) => [i, 'L']), 200)).toBe(false) // too fast
  })
})
