import { FP, H, KINDS, W, bossOf, createGame, step, summarize } from '../../../../shared/escadrille-ogooue/engine.mjs'

// A robot pilot for the tests: it lines up under the closest target, slides
// away from the bullets heading at it, and drops a bomb when cornered.
// skill 0–100: how often it looks for danger (a weak pilot reacts late).
export function botAction(state, skill = 100) {
  const p = state.player
  const px = p.x / FP
  const py = p.y / FP
  if (state.tick % 2) return null

  // Danger: bullets and fliers about to reach the jet.
  let threat = 0
  let pushX = 0
  let pushY = 0
  const look = state.tick % 100 < skill
  if (look) {
    for (const b of state.bullets) {
      const bx = (b.x + b.vx * 10) / FP
      const by = (b.y + b.vy * 10) / FP
      const dx = px - bx
      const dy = py - by
      const d2 = dx * dx + dy * dy
      if (d2 < 40 * 40) {
        threat += 1
        pushX += dx >= 0 ? 1 : -1
        pushY += dy >= 0 ? 0.5 : -0.5
      }
    }
    for (const e of state.enemies) {
      if (KINDS[e.kind].ground || e.kind === 'boss') continue
      const dx = px - e.x / FP
      const dy = py - e.y / FP
      if (dx * dx + dy * dy < 50 * 50) {
        threat += 2
        pushX += dx >= 0 ? 2 : -2
      }
    }
  }
  if (threat >= 6 && state.bombs > 0 && state.bombing === 0 && state.player.inv === 0) return ['B']

  // Target: the boss, else the closest enemy on screen, else a bonus.
  const boss = bossOf(state)
  let goalX = W / 2
  if (boss) goalX = boss.x / FP
  else {
    let best = null
    for (const e of state.enemies) {
      if (e.y < 0) continue
      if (!best || e.y > best.y) best = e
    }
    if (best) goalX = best.x / FP
  }
  const bonus = state.bonuses.find((b) => b.y > 200 * FP)
  if (bonus && !threat) goalX = bonus.x / FP
  let x = goalX + pushX * 30
  let y = H - 90 + pushY * 30
  x = Math.max(16, Math.min(W - 16, Math.round(x)))
  y = Math.max(200, Math.min(H - 24, Math.round(y)))
  return [x, y]
}

// Plays a whole sortie with the bot; returns the recorded inputs and summary.
export function playBot(seed, options = {}, skill = 100) {
  const state = createGame(seed, options)
  const inputs = []
  while (!state.over) {
    const action = botAction(state, skill)
    const actions = action ? [action] : []
    for (const a of actions) inputs.push([state.tick, ...a])
    step(state, actions)
  }
  return { inputs, endTick: state.tick, result: summarize(state) }
}
