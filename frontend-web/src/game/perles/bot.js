import { BALL, FP, H, MAX_TICKS, W, aimHit, createGame, pathOf, pointAt, step, summarize } from '../../../../shared/perles-punu/engine.mjs'

// A robot player for the tests: it aims at the bead where the one in hand
// makes the biggest group (a burst first), swaps when the next bead does
// better, and otherwise throws away. skill 0–100: how often it thinks
// (a weak player often throws at the first bead it sees).
const D = BALL * FP

function gainAt(chain, i, color) {
  if (chain[i].c !== color) return 1
  let n = 2
  for (let a = i; a > 0 && chain[a - 1].c === color && chain[a].pos - chain[a - 1].pos <= D; a--) n++
  for (let b = i; b < chain.length - 1 && chain[b + 1].c === color && chain[b + 1].pos - chain[b].pos <= D; b++) n++
  return n
}

function bestTarget(state, color, every) {
  const path = pathOf(state.level)
  const chain = state.chain
  let best = null
  for (let i = 0; i < chain.length; i += every) {
    const p = pointAt(path, chain[i].pos)
    const x = Math.round(p.x / FP)
    const y = Math.round(p.y / FP)
    if (x < 10 || x > W - 10 || y < 10 || y > H - 10) continue
    const hit = aimHit(state, x, y)
    if (!hit || hit.index < 0) continue
    const gain = gainAt(chain, hit.index, color)
    // The closer to the falls, the more urgent.
    const value = gain * 1000 + Math.floor((chain[hit.index].pos / path.end) * 100)
    if (!best || value > best.value) best = { x, y, gain, value }
  }
  return best
}

export function botAction(state, skill = 100, lastSwap = -100) {
  if (state.phase !== 'play' && state.phase !== 'rush') return null
  if (state.cooldown > 0 || state.tick % 3) return null
  if (!state.chain.length) return null
  const thinks = state.tick % 100 < skill
  const now = bestTarget(state, state.current, thinks ? 1 : 4)
  if (thinks && (!now || now.gain < 3) && state.tick - lastSwap > 30) {
    const other = bestTarget(state, state.next, 2)
    if (other && other.gain >= 3) return ['S']
  }
  if (now && now.gain >= 2) return [now.x, now.y]
  // Nothing useful: throw it away, out of the river's way if possible.
  for (const [x, y] of [[180, 0], [0, 330], [360, 330], [180, 640], [0, 0], [360, 0]]) {
    const hit = aimHit(state, x, y)
    if (hit && hit.index < 0) return [x, y]
  }
  return now ? [now.x, now.y] : null
}

// A whole game: { inputs, endTick, result }. pace: ticks between throws at
// least (a person needs a moment to aim).
export function playBot(seed, skill = 100, pace = 0) {
  const state = createGame(seed)
  const inputs = []
  let lastSwap = -100
  let lastThrow = -1000
  while (!state.over && state.tick < MAX_TICKS) {
    const a = state.tick - lastThrow >= pace ? botAction(state, skill, lastSwap) : null
    if (a && a[0] !== 'S') lastThrow = state.tick
    const actions = a ? [a] : []
    if (a?.[0] === 'S') lastSwap = state.tick
    for (const x of actions) inputs.push([state.tick, ...x])
    step(state, actions)
  }
  return { inputs, endTick: state.tick, result: summarize(state) }
}
