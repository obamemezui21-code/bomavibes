import { BOW, FP, GROUND, KINDS, NOCK_TICKS, PULL_MAX, airYOf, flightPath, sizeOf } from '../../../../shared/fleche-ebene/engine.mjs'

// A simple archer for the tests and for tuning the game's scores: it picks a
// target, works out where it will be when the arrow arrives and shoots there.
// skill: { spread: how many units of draw its hand shakes by, every: extra
// ticks it takes to aim }. spread 0 is a machine, 6 about a careful player.

const AIM_TICKS = 110

function danger(t) {
  if (KINDS[t.kind].protected) return -1
  const x = t.x / FP
  if (t.kind === 'monstre') return 900 - x
  if (t.state === 'aim') return 800 - (t.life - t.t)
  return 100 + KINDS[t.kind].points
}

// Where a target's middle will be in `ticks` ticks.
function ahead(t, ticks) {
  const { h } = sizeOf(t)
  const moves = t.state === 'aim' ? 0 : t.vx
  const x = (t.x + moves * ticks) / FP
  const y = KINDS[t.kind].air ? airYOf(t) : t.kind === 'cible' ? GROUND - h + 23 : GROUND - h / 2
  return [x, y]
}

export function aimAt(t, wind) {
  let best = null
  for (let ax = 30; ax <= PULL_MAX; ax += 6) {
    for (let ay = -PULL_MAX; ay <= 24; ay += 6) {
      if (ax * ax + ay * ay > PULL_MAX * PULL_MAX) continue
      const path = flightPath(ax, ay, wind, AIM_TICKS)
      for (let i = 0; i < path.length; i++) {
        const [x, y] = path[i]
        const [tx, ty] = ahead(t, i + 1)
        if (x < tx) continue
        const miss = Math.abs(y - ty)
        if (!best || miss < best.miss) best = { ax, ay, miss, ticks: i + 1 }
        break
      }
    }
  }
  return best
}

// Would the arrow meet a protected animal on its way?
function blocked(state, shot) {
  const path = flightPath(shot.ax, shot.ay, state.wind, AIM_TICKS)
  return state.targets.some((t) => {
    if (!KINDS[t.kind].protected || t.state === 'flee') return false
    const { w, h } = sizeOf(t)
    return path.some(([x, y], i) => Math.abs(x - (t.x + t.vx * i) / FP) < w / 2 + 6 && y > GROUND - h - 6)
  })
}

// Plays a whole game; `pick(n)` draws the bot's own random numbers.
export function playGame(state, step, skill, pick) {
  const inputs = []
  let nextShot = 0
  while (!state.over) {
    const actions = []
    if (state.tick >= nextShot && state.nock === 0) {
      const options = state.targets
        .filter((t) => t.state !== 'hit' && danger(t) >= 0 && t.x / FP > BOW.x + 60 && t.x / FP < 640)
        .sort((a, b) => danger(b) - danger(a))
        .slice(0, 3)
      for (const t of options) {
        const shot = aimAt(t, state.wind)
        if (!shot || shot.miss > 12 || blocked(state, shot)) continue
        const shake = () => (skill.spread ? pick(skill.spread * 2 + 1) - skill.spread : 0)
        actions.push([shot.ax + shake(), shot.ay + shake()])
        inputs.push([state.tick, ...actions[0]])
        nextShot = state.tick + NOCK_TICKS + (skill.every || 0)
        break
      }
    }
    step(state, actions)
  }
  return inputs
}
