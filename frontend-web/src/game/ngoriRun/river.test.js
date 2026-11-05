import { describe, expect, it } from 'vitest'
import { OBSTACLES, RIVER_FIRST_M, createRun, riverAt, step } from '../../../../shared/ngori-run/engine.mjs'

describe('NGORI RUN river', () => {
  it('swims slower across the river, among its own obstacles', () => {
    const state = createRun(5)
    let swamAt = null
    while (state.dist < (RIVER_FIRST_M + 100) * 100) {
      state.grace = 999 // a ghost runner, just to get there
      step(state)
      if (state.swim && swamAt === null) swamAt = Math.floor(state.dist / 100)
    }
    expect(swamAt).toBeGreaterThanOrEqual(RIVER_FIRST_M)
    for (const o of state.obstacles) {
      const inRiver = riverAt(Math.floor(o.z / 100))
      expect(!!OBSTACLES[o.type].water).toBe(inRiver)
    }
  })

  it('never lays a motorbike in the river', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const state = createRun(seed)
      while (!state.over) {
        state.grace = 999 // a ghost runner, for a whole run's road
        step(state)
        if (state.tick % 300) continue
        expect(state.powerups.some((p) => p.type === 'moto' && riverAt(Math.floor(p.z / 100)))).toBe(false)
      }
    }
  }, 20000)
})
