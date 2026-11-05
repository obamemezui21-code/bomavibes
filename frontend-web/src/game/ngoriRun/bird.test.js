import { describe, expect, it } from 'vitest'
import { BIRD_TICKS, birdHigh, createRun, simulateRun, step, validateInputs } from '../../../../shared/ngori-run/engine.mjs'

describe('NGORI RUN bird', () => {
  it('flies over the obstacles, then lands', () => {
    const state = createRun(7)
    for (let i = 0; i < 20; i++) step(state)
    step(state, ['B'])
    expect(state.bird).toBeGreaterThan(0)
    expect(state.birdCharges).toBe(0)
    expect(state.coinsOnRoad.some((c) => c.sky)).toBe(true)
    let wasHigh = false
    for (let i = 0; i < BIRD_TICKS && !state.over; i++) {
      wasHigh ||= birdHigh(state)
      step(state)
    }
    expect(wasHigh).toBe(true)
    expect(state.crashed).toBe(false)
    expect(state.bird).toBe(0)
  })

  it('needs a charge and replays identically', () => {
    const state = createRun(3)
    step(state, ['B'])
    step(state, ['B']) // already flying: ignored
    expect(state.birdCharges).toBe(0)
    const inputs = [[0, 'B'], [1, 'B']]
    expect(validateInputs(inputs, 200)).toBe(true)
    const a = simulateRun(3, inputs, 200)
    const b = simulateRun(3, inputs, 200)
    expect(a).toEqual(b)
  })

  it('can reach the whole sky trail at the slowest speed', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const state = createRun(seed)
      step(state, ['B'])
      let gold = 0
      while (state.bird > 0) {
        const next = state.coinsOnRoad.filter((c) => c.sky && !c.taken && c.z >= state.dist).sort((a, b) => a.z - b.z)[0]
        step(state, next && next.lane < state.lane ? ['L'] : next && next.lane > state.lane ? ['R'] : [])
        gold += state.events.filter((e) => e.type === 'coin' && e.gold).length
      }
      expect(gold).toBeGreaterThanOrEqual(1)
    }
  })

  it('keeps the combo over road coins flown over, not those missed on foot', () => {
    const state = createRun(11)
    state.combo = 7
    step(state, ['B'])
    state.coinsOnRoad = [{ id: 'road', z: state.dist + 100, lane: (state.lane + 1) % 3, gold: false, taken: false }]
    while (state.bird > 0) step(state)
    expect(state.combo).toBe(7)

    state.grace = 999
    state.coinsOnRoad.push({ id: 'road2', z: state.dist + 100, lane: (state.lane + 1) % 3, gold: false, taken: false })
    for (let i = 0; i < 30; i++) step(state)
    expect(state.combo).toBe(0)
  })
})
