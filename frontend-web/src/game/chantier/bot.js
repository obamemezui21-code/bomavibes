import { MAX_TICKS, createGame, placements, step, summarize } from '../../../../shared/chantier-boma/engine.mjs'

// A robot player for the tests and for tuning the game's scores. care 0–100:
// how often it looks for the best place (it otherwise sets the load down
// anywhere that fits); pace: ticks it thinks before moving; barrow: whether it
// sends away the loads it can't place well.
export function playBot(seed, { care = 100, pace = 0, barrow = true } = {}) {
  const state = createGame(seed)
  const inputs = []
  let rng = seed >>> 0
  const pick = (n) => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0
    return Math.floor((rng / 2 ** 32) * n)
  }
  let plan = null
  let planned = 0
  let wait = 0
  while (!state.over && state.tick < MAX_TICKS) {
    const actions = []
    const { load } = state
    if (load && state.phase === 'build') {
      if (planned !== load.id) {
        planned = load.id
        wait = pace ? pace + pick(pace) : 0
        const all = placements(state.level, state.floor, load.cells, load.mats)
        const best = all.reduce((a, b) => (b.good > a.good ? b : a), all[0])
        plan = { ...(pick(100) < care ? best : all[pick(all.length)]) }
        if (barrow && plan.good < load.cells.length - 1 && state.barrows) plan = { barrow: true }
      }
      if (wait > 0) wait--
      else if (plan.barrow) actions.push('B')
      else if (plan.turns > 0) {
        actions.push('T')
        plan.turns--
      } else if (load.x < plan.x) actions.push('R')
      else if (load.x > plan.x) actions.push('L')
      else actions.push('D')
    }
    const { tick } = state
    step(state, actions)
    for (const a of state.applied) inputs.push([tick, a])
  }
  return { inputs, endTick: state.tick, result: summarize(state) }
}
