// A player autopilot for BOMA FIGHT, used by the tests (and to balance the
// computer's levels): walks in, punches or kicks within reach, guards some
// of the attacks it sees coming. `skill` 0–100. Never part of the app's bundle.
import { FIGHTERS, MOVES, MAX_ENERGY } from '../../../../shared/boma-fight/engine.mjs'

export function botActions(state, { skill = 60, every = 10 } = {}) {
  if (state.phase !== 'fight' || state.tick % every !== 0) return []
  const [me, foe] = state.fighters
  const gap = Math.abs(foe.x - me.x)
  const reach = FIGHTERS[me.id].reach
  const toward = foe.x > me.x ? 'R' : 'L'
  // A cheap deterministic "dice" so replays stay identical.
  const dice = (state.tick * 7919 + me.hp * 31 + foe.hp) % 100
  if (foe.state === 'attack' && dice < skill * 0.6) return ['S', 'B']
  const actions = me.guardHeld ? ['U'] : []
  if (me.energy >= MAX_ENERGY && gap < MOVES.special.range + reach - 10) return [...actions, 'S', 'X']
  if (gap <= MOVES.punch.range + reach - 10) actions.push('S', dice < 50 ? 'P' : 'K')
  else if (gap <= MOVES.kick.range + reach - 10) actions.push('S', 'K')
  else actions.push(toward)
  return actions
}

export function playBot(createFight, step, summarize, seed, fighter, level, options) {
  const state = createFight(seed, fighter, level)
  const inputs = []
  while (!state.over) {
    const actions = botActions(state, options)
    for (const a of actions) inputs.push([state.tick, a])
    step(state, actions)
  }
  return { state, inputs, result: summarize(state) }
}
