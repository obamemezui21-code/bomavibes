// ŒIL DE PANTHÈRE — the scoped-rifle shooting game, shared by the app and the
// server.
//
// Same contract as the other games (shared/*/engine.mjs): integers only, a
// seeded generator, and the browser records only the player's gestures. The
// server replays them with the same seed to get the real score, so a score
// typed into the request is worthless.
//
// The scene is the Lopé at dusk, 640 × 360 units, with three depth rows
// (far, middle, near): targets rise from behind the bushes of a row, stay up
// a while, and go back down. Poachers and forest monsters attack if they are
// left up too long (a life lost); protected animals must not be shot (a life
// lost too). A gold Ngori coin crosses the sky now and then.
//
// Gestures: [tick, x, y] = a shot at (x, y), [tick, 'R'] = reload. Where the
// scope points, its zoom and its sway are the browser's business: only the
// point where the bullet went counts.

export const TICK_RATE = 60
export const W = 640
export const H = 360
export const GAME_TICKS = 90 * TICK_RATE // a game lasts 90 s
export const MAX_TICKS = GAME_TICKS + 60
export const LIVES = 5
const FP = 16 // positions in 1/16 of a unit
const RISE = 12 // ticks to rise from (or sink behind) the bushes
export const WARN_TICKS = 60 // a threat takes aim this long before it attacks
const FALL_TICKS = 30
const BULLSEYE = 3 // the target's centre: a third of its radius

// The rifles. zoom and sway are only drawn by the browser.
export const RIFLES = {
  carabine: { name: 'Carabine de chasse', mag: 8, cooldown: 14, reload: 55, damage: 1, zoom: 2.4, sway: 3 },
  precision: { name: 'Fusil de précision', mag: 5, cooldown: 32, reload: 75, damage: 2, zoom: 3.8, sway: 5 },
  assaut: { name: 'Fusil d’assaut à lunette', mag: 15, cooldown: 7, reload: 90, damage: 1, zoom: 1.8, sway: 2 },
}
export const DEFAULT_RIFLE = 'carabine'

// Ground line and size (%) of each depth row, far to near.
export const ROWS = [
  { y: 200, scale: 58 },
  { y: 262, scale: 88 },
  { y: 346, scale: 125 },
]
// Sizes at 100 %. head: the top share of the height that counts double.
// cible: the hit zone is its disc (radius = w / 2) at the top of the post.
export const KINDS = {
  cible: { w: 60, h: 112, points: 10, hp: 1 },
  braconnier: { w: 50, h: 150, points: 25, hp: 1, head: 20, threat: true },
  monstre: { w: 86, h: 112, points: 40, hp: 2, head: 30, threat: true },
  animal: { w: 100, h: 86, points: 50, hp: 1, protected: true },
  or: { w: 30, h: 30, points: 75, hp: 1 },
}
// Kinds drawn in several looks (target.variant), each with its own size:
// the monsters (forest, swamp) and the animals (gorilla, sitatunga, forest
// elephant, pangolin).
export const VARIANT_SIZES = {
  monstre: [[86, 112], [120, 112]],
  animal: [[100, 86], [100, 86], [140, 115], [110, 48]],
}
const ROW_BONUS = [2, 1, 1] // far targets are worth double
const GOLD_FIRST = 900
const GOLD_EVERY = 1100

// Stars for a score (Ngori paid = stars).
export const STAR_SCORES = [1000, 3000, 6000]

// mulberry32, as in the other games.
function nextRandom(state) {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0
  let t = state.rng
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return (t ^ (t >>> 14)) >>> 0
}

function randomInt(state, n) {
  return nextRandom(state) % n
}

export function rifleOf(options) {
  return RIFLES[options?.rifle] ? options.rifle : DEFAULT_RIFLE
}

export function createGame(seed, options = {}) {
  const rifle = rifleOf(options)
  return {
    rng: seed >>> 0,
    rifle,
    tick: 0,
    targets: [],
    nextId: 1,
    nextSpawn: 60,
    nextGold: GOLD_FIRST,
    ammo: RIFLES[rifle].mag,
    cooldown: 0,
    reload: 0,
    lives: LIVES,
    score: 0,
    combo: 0,
    bestCombo: 0,
    shots: 0,
    hits: 0,
    headshots: 0,
    kills: { cible: 0, braconnier: 0, monstre: 0, animal: 0, or: 0 },
    over: false,
    events: [],
  }
}

// Size of a target in units, for its row.
export function sizeOf(target) {
  const kind = KINDS[target.kind]
  const [w, h] = VARIANT_SIZES[target.kind]?.[target.variant] || [kind.w, kind.h]
  const scale = target.row < 0 ? 100 : ROWS[target.row].scale
  return { w: Math.trunc((w * scale) / 100), h: Math.trunc((h * scale) / 100) }
}

// Ground line of a target (the coin: its centre's height + half its size).
export function baseOf(target) {
  return target.row < 0 ? target.y + 15 : ROWS[target.row].y
}

// How much of a target shows above the bushes, in 1/RISE.
export function shownOf(target) {
  if (target.state === 'rise') return target.t
  if (target.state === 'down') return RISE - target.t
  return RISE
}

export const RISE_TICKS = RISE

function spawn(state) {
  const d = Math.min(100, Math.trunc((state.tick * 100) / GAME_TICKS))
  const roll = randomInt(state, 100)
  const cibleChance = 40 - Math.trunc((d * 30) / 100)
  const monstreChance = d < 15 ? 0 : 10 + Math.trunc((d * 20) / 100)
  const animalChance = 15
  let kind = 'braconnier'
  if (roll < cibleChance) kind = 'cible'
  else if (roll < cibleChance + monstreChance) kind = 'monstre'
  else if (roll < cibleChance + monstreChance + animalChance) kind = 'animal'

  const row = randomInt(state, 3)
  const scale = ROWS[row].scale
  const target = {
    id: state.nextId++,
    kind,
    variant: randomInt(state, VARIANT_SIZES[kind]?.length || 2),
    row,
    x: (40 + randomInt(state, W - 80)) * FP,
    vx: 0,
    hp: KINDS[kind].hp,
    life: 280 - d + randomInt(state, 40),
    state: 'rise',
    t: 0,
    moving: false,
  }
  const moveRoll = randomInt(state, 100)
  const dir = randomInt(state, 2) ? 1 : -1
  if ((kind === 'braconnier' && moveRoll < 35) || (kind === 'animal' && moveRoll < 50)) {
    // Runs (or walks) across the whole row, without stopping.
    const speed = kind === 'braconnier' ? 14 + randomInt(state, 8) : 8 + randomInt(state, 5)
    target.moving = true
    target.vx = Math.max(2, Math.trunc((speed * scale) / 100)) * dir
    target.x = (dir > 0 ? -40 : W + 40) * FP
    target.state = 'up'
  } else if (kind === 'monstre' || (kind === 'cible' && moveRoll < 30)) {
    // Wanders sideways, turning back at the edges.
    target.vx = Math.max(1, Math.trunc(((kind === 'monstre' ? 8 : 6) * scale) / 100)) * dir
  }
  state.targets.push(target)
}

function spawnGold(state) {
  const dir = randomInt(state, 2) ? 1 : -1
  state.targets.push({
    id: state.nextId++,
    kind: 'or',
    variant: 0,
    row: -1,
    y: 50 + randomInt(state, 80),
    x: (dir > 0 ? -30 : W + 30) * FP,
    vx: (44 + randomInt(state, 12)) * dir,
    hp: 1,
    life: 0,
    state: 'up',
    t: 0,
    moving: true,
  })
}

// The target hit at (x, y) and where: 'head' / 'centre' or 'body'; near rows
// first (they stand in front), the coin last (it flies behind them).
function targetAt(state, x, y) {
  const order = [2, 1, 0, -1]
  for (const row of order) {
    for (let i = state.targets.length - 1; i >= 0; i--) {
      const t = state.targets[i]
      if (t.row !== row || t.state === 'hit' || shownOf(t) * 2 < RISE) continue
      const { w, h } = sizeOf(t)
      const cx = Math.trunc(t.x / FP)
      const base = baseOf(t)
      if (t.kind === 'cible' || t.kind === 'or') {
        const r = Math.trunc(w / 2)
        const cy = t.kind === 'or' ? t.y : base - Math.trunc((h * shownOf(t)) / RISE) + r
        const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy)
        if (d2 <= r * r) {
          const inner = Math.trunc(r / BULLSEYE)
          return { target: t, zone: t.kind === 'cible' && d2 <= inner * inner ? 'centre' : 'body' }
        }
        continue
      }
      const top = base - Math.trunc((h * shownOf(t)) / RISE)
      if (x < cx - Math.trunc(w / 2) || x > cx + Math.trunc(w / 2) || y < top || y > base) continue
      const head = KINDS[t.kind].head
      const zone = head && shownOf(t) === RISE && y <= top + Math.trunc((h * head) / 100) ? 'head' : 'body'
      return { target: t, zone }
    }
  }
  return null
}

function shoot(state, x, y) {
  const rifle = RIFLES[state.rifle]
  if (state.reload > 0 || state.cooldown > 0) return
  if (state.ammo === 0) {
    state.reload = rifle.reload
    state.events.push({ type: 'reload' })
    return
  }
  state.ammo -= 1
  state.cooldown = rifle.cooldown
  state.shots += 1
  const found = targetAt(state, x, y)
  if (!found) {
    state.combo = 0
    state.events.push({ type: 'miss', x, y })
  } else {
    const { target, zone } = found
    const kind = KINDS[target.kind]
    state.hits += 1
    if (kind.protected) {
      target.state = 'hit'
      target.t = 0
      state.kills[target.kind] += 1
      state.score = Math.max(0, state.score - kind.points)
      state.combo = 0
      state.lives -= 1
      state.events.push({ type: 'protected', x, y, points: -kind.points, id: target.id })
    } else {
      const precise = zone !== 'body'
      if (precise) state.headshots += 1
      target.hp -= rifle.damage * (precise ? 2 : 1)
      if (target.hp > 0) {
        state.events.push({ type: 'wound', x, y, id: target.id })
      } else {
        const multiplier = 1 + Math.min(3, Math.trunc(state.combo / 5))
        const points = kind.points * (target.row >= 0 ? ROW_BONUS[target.row] : 1) * (precise ? 2 : 1) * multiplier
        state.score += points
        state.kills[target.kind] += 1
        target.state = 'hit'
        target.t = 0
        state.events.push({ type: 'hit', x, y, points, zone, kind: target.kind, multiplier, id: target.id })
      }
      state.combo += 1
      state.bestCombo = Math.max(state.bestCombo, state.combo)
    }
  }
  if (state.ammo === 0) {
    state.reload = rifle.reload
    state.events.push({ type: 'reload' })
  }
}

export function step(state, actions = []) {
  if (state.over) return state
  state.events = []
  const rifle = RIFLES[state.rifle]
  for (const action of actions) {
    if (action[0] === 'R') {
      if (state.reload === 0 && state.ammo < rifle.mag) {
        state.reload = rifle.reload
        state.events.push({ type: 'reload' })
      }
    } else {
      shoot(state, action[0], action[1])
    }
  }

  if (state.cooldown > 0) state.cooldown -= 1
  if (state.reload > 0) {
    state.reload -= 1
    if (state.reload === 0) {
      state.ammo = rifle.mag
      state.events.push({ type: 'loaded' })
    }
  }

  const kept = []
  for (const t of state.targets) {
    t.t += 1
    if (t.state !== 'hit') {
      t.x += t.vx
      const cx = Math.trunc(t.x / FP)
      if (t.moving) {
        if (cx < -60 || cx > W + 60) continue // gone off the edge
      } else if (t.vx && (cx < 30 || cx > W - 30)) {
        t.vx = -t.vx
      }
    }
    if (t.state === 'rise' && t.t >= RISE) {
      t.state = 'up'
      t.t = 0
    } else if (t.state === 'up' && !t.moving && t.t >= t.life) {
      if (KINDS[t.kind].threat) {
        state.lives -= 1
        state.combo = 0
        state.events.push({ type: 'attack', kind: t.kind, id: t.id })
      }
      t.state = 'down'
      t.t = 0
    } else if (t.state === 'down' && t.t >= RISE) {
      continue
    } else if (t.state === 'hit' && t.t >= FALL_TICKS) {
      continue
    }
    kept.push(t)
  }
  state.targets = kept

  if (state.tick >= state.nextSpawn) {
    const d = Math.min(100, Math.trunc((state.tick * 100) / GAME_TICKS))
    const active = state.targets.filter((t) => t.state !== 'hit' && t.kind !== 'or').length
    if (active < 3 + Math.trunc((d * 4) / 100)) spawn(state)
    state.nextSpawn = state.tick + 85 - Math.trunc((d * 40) / 100) + randomInt(state, 20)
  }
  if (state.tick >= state.nextGold) {
    spawnGold(state)
    state.nextGold += GOLD_EVERY
  }

  state.tick += 1
  if (state.lives <= 0 || state.tick >= GAME_TICKS) state.over = true
  return state
}

// Is a threat taking aim (drawn with a warning, and the "!" above it)?
export function isAiming(target) {
  return KINDS[target.kind].threat && !target.moving && target.state === 'up' && target.t >= target.life - WARN_TICKS
}

export function starsFor(score) {
  return STAR_SCORES.filter((s) => score >= s).length
}

export function summarize(state) {
  return {
    score: state.score,
    shots: state.shots,
    hits: state.hits,
    accuracy: state.shots ? Math.round((state.hits * 100) / state.shots) : 0,
    headshots: state.headshots,
    bestCombo: state.bestCombo,
    kills: { ...state.kills },
    lives: Math.max(0, state.lives),
    completed: state.lives > 0 && state.tick >= GAME_TICKS,
    ticks: state.tick,
    stars: starsFor(state.score),
  }
}

export function validateInputs(inputs, endTick) {
  if (!Number.isInteger(endTick) || endTick < 1 || endTick > MAX_TICKS) return false
  if (!Array.isArray(inputs) || inputs.length > Math.ceil(endTick / 5) + 20) return false
  let last = 0
  for (const entry of inputs) {
    if (!Array.isArray(entry)) return false
    const [tick] = entry
    if (!Number.isInteger(tick) || tick < last || tick >= endTick) return false
    if (entry.length === 2) {
      if (entry[1] !== 'R') return false
    } else if (entry.length === 3) {
      const [, x, y] = entry
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= W || y < 0 || y >= H) return false
    } else {
      return false
    }
    last = tick
  }
  return true
}

// The gestures of a tick, as step() takes them: [x, y] or ['R'].
export function actionsAt(inputs, from, tick) {
  const actions = []
  let i = from
  while (i < inputs.length && inputs[i][0] === tick) {
    actions.push(inputs[i].slice(1))
    i++
  }
  return { actions, next: i }
}

export function simulateGame(seed, options, inputs, endTick) {
  const state = createGame(seed, options)
  let i = 0
  while (!state.over && state.tick < endTick) {
    const { actions, next } = actionsAt(inputs, i, state.tick)
    i = next
    step(state, actions)
  }
  return summarize(state)
}
