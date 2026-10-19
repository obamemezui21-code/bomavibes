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
})
