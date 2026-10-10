// A simple autopilot for MOTO BOMA, used by the tests (and to balance the
// medal times): steers for the clearest lane ahead and fires nitro when the
// road is open. Never part of the app's bundle.
import { PLAYER_LEN, VEHICLES } from '../../../../shared/moto-boma/engine.mjs'

function laneBlocked(state, lane, from, to) {
  return state.vehicles.some((v) => v.lane === lane && !v.hit && v.z < to && v.z + VEHICLES[v.type].len > from)
}

// How far ahead the lane stays clear (cm), up to `horizon`.
function clearAhead(state, lane, horizon) {
  let nearest = horizon
  for (const v of state.vehicles) {
    if (v.lane !== lane || v.hit || v.z + VEHICLES[v.type].len < state.dist - 50) continue
    nearest = Math.min(nearest, Math.max(0, v.z - state.dist - PLAYER_LEN))
  }
  return nearest
}

export function botActions(state, { nitro = true } = {}) {
  const look = state.speed * 50 + 600
  const front = state.dist + PLAYER_LEN
  const here = Math.round(state.x / 100)
  // The lane that stays clear the longest; the current one wins ties, and a
  // lane two steps away only if the one in between is clear right now.
  let target = here
  let best = clearAhead(state, here, 8000)
  for (const lane of [here - 1, here + 1, here - 2, here + 2]) {
    if (lane < 0 || lane > 2) continue
    const between = (lane + here) / 2
    if (Math.abs(lane - here) === 2 && laneBlocked(state, between, state.dist - 150, front + 400)) continue
    const clear = clearAhead(state, lane, 8000)
    if (clear > best + 300) {
      best = clear
      target = lane
    }
  }
  const want = target * 100
  const actions = []
  const steer = Math.abs(want - state.x) <= 6 ? 0 : want < state.x ? -1 : 1
  if (steer !== state.steer) actions.push(steer === 0 ? 'S' : steer < 0 ? 'L' : 'R')
  if (nitro && state.nitroCharges && !state.nitro && !laneBlocked(state, target, state.dist, front + look * 2)) actions.push('N')
  return actions
}

export function playBot(createRace, step, summarize, seed, course, options) {
  const state = createRace(seed, course)
  const inputs = []
  while (!state.over) {
    const actions = botActions(state, options)
    for (const a of actions) inputs.push([state.tick, a])
    step(state, actions)
  }
  return { state, inputs, result: summarize(state) }
}
