import { describe, expect, it } from 'vitest'
import {
  BARROWS,
  BREAK_COST,
  COLS,
  CRACK_COST,
  GOLD,
  LEVELS,
  MAX_SOLIDITY,
  MAX_TICKS,
  ROWS,
  STAR_SCORES,
  bestPlacement,
  bricksOf,
  createGame,
  isBrick,
  landing,
  planAt,
  simulateGame,
  step,
  summarize,
  turned,
  validateInputs,
} from '../../../../shared/chantier-boma/engine.mjs'
import { playBot } from './bot.js'

// Puts this load under the crane.
function hold(state, cells, mats, x = 4) {
  const top = Math.min(...cells.map((c) => c[1]))
  state.load = { id: 999, shape: 'test', cells, mats, x, y: -top, every: 40, fall: 0, lock: 0, resets: 0, dropped: 0 }
}

function run(state, ticks) {
  for (let i = 0; i < ticks && !state.over; i++) step(state)
}

describe('CHANTIER BOMA plans', () => {
  it('are all in the grid, and never hang in the air', () => {
    LEVELS.forEach((lv, level) => {
      expect(lv.plan.length).toBeLessThanOrEqual(ROWS - 4)
      for (const row of lv.plan) expect(row).toMatch(/^[TBPRVo#.]{9}$/)
      for (let x = 0; x < COLS; x++) {
        let above = false
        for (let y = 0; y < ROWS; y++) {
          const c = planAt(level, x, y)
          if (c !== '.') above = true
          else expect(above, `${lv.id} ${x},${y}`).toBe(false)
        }
      }
      expect(bricksOf(level)).toBeGreaterThan(30)
    })
  })
})

describe('CHANTIER BOMA engine', () => {
  it('is deterministic for a seed', () => {
    const a = playBot(42, { care: 70, pace: 30 })
    const b = playBot(42, { care: 70, pace: 30 })
    expect(a).toEqual(b)
  })

  it('replays a game from its gestures', () => {
    for (const seed of [3, 11, 2 ** 31 + 5]) {
      const game = playBot(seed, { care: 80, pace: 40 })
      expect(validateInputs(game.inputs, game.endTick)).toBe(true)
      expect(simulateGame(seed, game.inputs, game.endTick)).toEqual(game.result)
    }
  })

  it('replays the same without the gestures that did nothing', () => {
    const all = createGame(9)
    const kept = []
    for (let tick = 0; tick < 1500; tick++) {
      const actions = tick % 7 === 0 ? ['L', 'L', 'T'] : []
      step(all, actions)
      for (const a of all.applied) kept.push([tick, a])
    }
    expect(simulateGame(9, kept, 1500)).toEqual(summarize(all))
  })

  it('always lends a load that fits in the plan', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const state = createGame(seed)
      let n = 0
      while (!state.over && n++ < 20000) {
        if (state.phase === 'build' && state.load) expect(bestPlacement(state.level, state.floor, state.load)).not.toBeNull()
        step(state, state.phase === 'build' && n % 9 === 0 ? ['L', 'L', 'R', 'D'].slice(n % 4) : [])
      }
    }
  }, 20000)

  it('lends loads that can all be placed perfectly in the first building', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { result } = playBot(seed, { care: 100, barrow: false })
      expect(result.masterpieces).toBeGreaterThanOrEqual(1)
      expect(result.won).toBe(true)
    }
  }, 20000)

  it('lets every brick slip to the bottom of its own column', () => {
    const state = createGame(1)
    // Column 1 is already one brick higher than column 2.
    hold(state, [[0, 0]], ['T'], 1)
    step(state, ['D'])
    run(state, 20)
    hold(state, [[0, 0], [1, 0]], ['T', 'T'], 1)
    expect(landing(0, state.floor, state.load.cells, 1).map((s) => [s.x, s.y])).toEqual([[1, ROWS - 2], [2, ROWS - 1]])
    step(state, ['D'])
    expect(state.bricks.map((b) => [b.x, b.y, b.ok])).toEqual([[1, ROWS - 1, true], [1, ROWS - 2, true], [2, ROWS - 1, true]])
  })

  it('cracks a brick of another material, and a golden one is always right', () => {
    const state = createGame(1)
    hold(state, [[0, 0], [1, 0]], ['P', GOLD], 1)
    step(state, ['D'])
    expect(state.bricks.map((b) => b.ok)).toEqual([false, true])
    expect(state.bricks[1]).toMatchObject({ m: 'T', gold: true })
    expect(state.solidity).toBe(MAX_SOLIDITY - CRACK_COST)
    expect(state.streak).toBe(0)
  })

  it('breaks a brick outside the plan, which takes no room', () => {
    const state = createGame(1)
    hold(state, [[0, 0]], ['T'], 0) // nothing is planned in the first column
    step(state, ['D'])
    expect(state.bricks).toEqual([])
    expect(state.broken).toBe(1)
    expect(state.solidity).toBe(MAX_SOLIDITY - BREAK_COST)
    expect(state.floor[0]).toBe(ROWS)
  })

  it('puts the formwork of an opening in once the bricks below are laid', () => {
    const state = createGame(1)
    expect(state.floor[4]).toBe(ROWS - 2) // the first building's door
    const church = LEVELS.findIndex((l) => l.id === 'nkembo')
    state.level = church
    state.floor = state.floor.map(() => ROWS)
    hold(state, [[0, 0]], ['R'], 4)
    step(state, ['D'])
    expect(planAt(church, 4, ROWS - 2)).toBe('o')
    expect(isBrick(planAt(church, 4, state.floor[4] - 1))).toBe(true)
    expect(state.floor[4]).toBeLessThan(ROWS - 2)
  })

  it('collapses when the solidity runs out', () => {
    const state = createGame(1)
    for (let i = 0; i < 40 && !state.over; i++) {
      hold(state, [[0, 0]], ['T'], 0)
      step(state, ['D'])
      run(state, 20)
    }
    expect(state.over).toBe(true)
    expect(summarize(state)).toMatchObject({ won: false, solidity: 0 })
  })

  it('turns a load, and turns it back after four times', () => {
    const cells = [[0, 0], [1, 0], [0, 1]]
    let c = cells
    for (let i = 0; i < 4; i++) c = turned(c)
    expect(c).toEqual(cells)
    const state = createGame(1)
    hold(state, [[0, 0], [1, 0]], ['T', 'P'], COLS - 2)
    step(state, ['T'])
    step(state, ['R'])
    expect(state.load.x).toBe(COLS - 1)
    step(state, ['T']) // against the edge: it moves aside to turn
    expect(state.load.cells.every(([x]) => state.load.x + x < COLS)).toBe(true)
  })

  it('gives time to adjust a load that touches down, but not forever', () => {
    const state = createGame(1)
    hold(state, [[0, 0]], ['T'], 1)
    while (state.load.y < ROWS - 1) step(state, ['S'])
    run(state, 20)
    expect(state.phase).toBe('build')
    let n = 0
    while (state.phase === 'build' && n++ < 2000) step(state, n % 10 === 0 ? [n % 20 ? 'L' : 'R'] : [])
    expect(n).toBeGreaterThan(40)
    expect(n).toBeLessThan(400)
  })

  it('sends a load away in the wheelbarrow, as long as there is one', () => {
    const state = createGame(4)
    const ids = [state.load.id]
    for (let i = 0; i < BARROWS + 2; i++) {
      step(state, ['B'])
      ids.push(state.load.id)
    }
    expect(state.barrows).toBe(0)
    expect(new Set(ids).size).toBe(BARROWS + 1)
    expect(state.bricks).toEqual([])
  })

  it('earns stars for care: none for dropping blindly, three for a careful game', () => {
    const median = (options) => {
      const scores = Array.from({ length: 9 }, (_, i) => playBot(i * 977 + 1, options).result.score).sort((a, b) => a - b)
      return scores[4]
    }
    expect(median({ care: 0, barrow: false })).toBeLessThan(STAR_SCORES[0])
    expect(median({ care: 60, pace: 120 })).toBeGreaterThan(STAR_SCORES[1])
    expect(median({ care: 60, pace: 120 })).toBeLessThan(STAR_SCORES[2])
    expect(median({ care: 93, pace: 90 })).toBeGreaterThan(STAR_SCORES[2])
  }, 20000)

  it('ends by itself when nobody plays', () => {
    const state = createGame(8)
    run(state, MAX_TICKS)
    expect(state.over).toBe(true)
    expect(state.tick).toBeLessThan(MAX_TICKS)
    expect(summarize(state).stars).toBe(0)
  })

  it('refuses forged gestures', () => {
    expect(validateInputs([[0, 'L'], [3, 'D']], 10)).toBe(true)
    expect(validateInputs([[3, 'L'], [0, 'D']], 10)).toBe(false)
    expect(validateInputs([[10, 'L']], 10)).toBe(false)
    expect(validateInputs([[0, 'X']], 10)).toBe(false)
    expect(validateInputs([[0, 'L', 1]], 10)).toBe(false)
    expect(validateInputs([[-1, 'L']], 10)).toBe(false)
    expect(validateInputs(Array.from({ length: 9 }, () => [2, 'L']), 10)).toBe(false)
    expect(validateInputs('L', 10)).toBe(false)
    expect(validateInputs([], 0)).toBe(false)
    expect(validateInputs([], MAX_TICKS + 1)).toBe(false)
  })
})
