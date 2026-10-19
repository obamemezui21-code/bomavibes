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
})
