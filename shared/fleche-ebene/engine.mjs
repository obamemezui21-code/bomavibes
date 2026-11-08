// FLÈCHE D'ÉBÈNE — the bow hunter's game, shared by the app and the server.
//
// Same contract as the other games (shared/*/engine.mjs): integers only, a
// seeded generator, and the browser records only the player's gestures. The
// server replays them with the same seed to get the real score, so a score
// typed into the request is worthless.
//
// The scene is the Ivindo forest seen from the side, 640 × 360 units. The
// hunter stands on the left and looses arrows that fall under gravity and
// drift with the wind, so a far target has to be aimed above. An arrow stops
// at the first thing it meets: a protected animal walking in front of a
// monster has to be shot over. Touching one costs points and the combo, not a
// life (an arrow that falls short lands there by accident): the animal runs
// away unhurt.
//
// Gesture: [tick, ax, ay] = an arrow loosed along (ax, ay), its length being
// how far the bow was drawn (ay < 0 is up). How the finger drew it is the
// browser's business.

export const TICK_RATE = 60
export const W = 640
export const H = 360
export const GROUND = 322
export const GAME_TICKS = 90 * TICK_RATE // a game lasts 90 s
export const MAX_TICKS = GAME_TICKS + 60
export const LIVES = 3
export const FP = 256 // positions and speeds in 1/256 of a unit
export const BOW = { x: 66, y: 240 } // the hunter's shoulder: arrows leave along his arm
export const PULL_MIN = 24 // a shorter draw is called off
export const PULL_MAX = 120
export const NOCK_TICKS = 36 // to put a new arrow on the string
export const WARN_TICKS = 60 // a poacher takes aim this long before firing
export const WIND_EVERY = 12 * TICK_RATE
const POWER = 19 // speed per unit of draw
const GRAVITY = 29
const WIND_MAX = 6
const SUBSTEPS = 4 // an arrow is checked 4 times per tick: it can't jump over a target
const LEEWAY = 3 // an arrow is a point: targets are this much wider for it
const REACH_X = 118 // a monster this close strikes the hunter
const OFF_EDGE = 60
const FALL_TICKS = 30
const FLEE_SPEED = 620
const LONG_SHOT_X = 400 // a hit from here on is worth double
const BULLSEYE = 3 // the straw target's centre: a third of its radius
const GOLD_FIRST = 1200
const GOLD_EVERY = 1500

// Sizes in units. head: the top share of the height that counts double.
// air: flies (target.y = its centre); the others have their feet on GROUND.
// cible: the hit zone is the disc (radius = w / 2) at the top of the post.
export const KINDS = {
  cible: { w: 46, h: 96, points: 15, hp: 1 },
  potamochere: { w: 64, h: 42, points: 20, hp: 1 },
  pintade: { w: 42, h: 30, points: 35, hp: 1, air: true },
  braconnier: { w: 40, h: 104, points: 30, hp: 1, head: 20, threat: true },
  monstre: { w: 66, h: 88, points: 45, hp: 2, head: 30, threat: true },
  animal: { w: 88, h: 76, points: 50, hp: 1, protected: true },
  or: { w: 28, h: 28, points: 75, hp: 1, air: true },
}
// Kinds drawn in several looks (target.variant), each with its own size: the
// monsters (forest, swamp) and the animals (gorilla, sitatunga, forest
// elephant, pangolin).
export const VARIANT_SIZES = {
  monstre: [[66, 88], [92, 88]],
  animal: [[88, 76], [88, 76], [124, 100], [92, 40]],
}

// Stars for a score (Ngori paid = stars).
export const STAR_SCORES = [700, 2200, 4500]

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

function isqrt(n) {
  let x = n
  let y = Math.trunc((x + 1) / 2)
  while (y < x) {
    x = y
    y = Math.trunc((x + Math.trunc(n / x)) / 2)
  }
  return x
}

export function createGame(seed) {
  return {
    rng: seed >>> 0,
    tick: 0,
    targets: [],
    arrows: [],
    nextId: 1,
    nextSpawn: 45,
    nextGold: GOLD_FIRST,
    wind: 0,
    nock: 0,
    lives: LIVES,
    score: 0,
    combo: 0,
    bestCombo: 0,
    shots: 0,
    hits: 0,
    perfect: 0, // headshots and bullseyes
    longShots: 0,
    kills: { cible: 0, potamochere: 0, pintade: 0, braconnier: 0, monstre: 0, animal: 0, or: 0 },
    over: false,
    events: [],
  }
}

// How difficult the game is by now, 0 to 100.
function difficulty(state) {
  return Math.min(100, Math.trunc((state.tick * 100) / GAME_TICKS))
}

// The draw a gesture really gives (too long: cut down to the bow's limit), or
// null when it's no shot at all (too short, or backwards).
export function drawOf(ax, ay) {
  if (ax < 1) return null
  const len2 = ax * ax + ay * ay
  if (len2 < PULL_MIN * PULL_MIN) return null
  if (len2 <= PULL_MAX * PULL_MAX) return { ax, ay }
  const len = isqrt(len2) + 1 // rounded up: never a hair over the limit
  return { ax: Math.trunc((ax * PULL_MAX) / len), ay: Math.trunc((ay * PULL_MAX) / len) }
}

// An arrow's path for `ticks` ticks, as [x, y] in units: the aiming preview
// and the tests. The simulation moves its arrows the same way (moveArrow).
export function flightPath(ax, ay, wind, ticks) {
  const draw = drawOf(ax, ay)
  if (!draw) return []
  const arrow = { x: BOW.x * FP, y: BOW.y * FP, vx: draw.ax * POWER, vy: draw.ay * POWER }
  const path = []
  for (let i = 0; i < ticks; i++) {
    moveArrow(arrow, wind)
    path.push([arrow.x / FP, arrow.y / FP])
  }
  return path
}

function moveArrow(arrow, wind) {
  arrow.vy += GRAVITY
  arrow.vx += wind
  arrow.x += arrow.vx
  arrow.y += arrow.vy
}

export function sizeOf(target) {
  const kind = KINDS[target.kind]
  const [w, h] = VARIANT_SIZES[target.kind]?.[target.variant] || [kind.w, kind.h]
  return { w, h }
}

// Where a flying target's centre is: birds bob up and down as they go.
export function airYOf(target) {
  if (target.kind !== 'pintade') return target.y
  return target.y + Math.abs((target.t % 80) - 40) - 20
}

function targetFacing(vx) {
  return vx < 0 ? -1 : 1
}

function addTarget(state, kind, fields) {
  const target = {
    id: state.nextId++,
    kind,
    variant: 0,
    hp: KINDS[kind].hp,
    state: 'go', // go | aim (a poacher) | leave | hit | flee (a protected animal)
    t: 0,
    y: 0,
    ...fields,
  }
  target.facing = targetFacing(target.vx)
  state.targets.push(target)
  return target
}

function spawn(state) {
  const d = difficulty(state)
  const roll = randomInt(state, 100)
  const cibleChance = 34 - Math.trunc((d * 30) / 100)
  const monstreChance = d < 8 ? 0 : 16 + Math.trunc((d * 20) / 100)
  const braconnierChance = d < 18 ? 0 : 10 + Math.trunc((d * 12) / 100)
  const animalChance = 13
  const pintadeChance = 16
  let chance = cibleChance
  let kind = 'potamochere'
  if (roll < chance) kind = 'cible'
  else if (roll < (chance += monstreChance)) kind = 'monstre'
  else if (roll < (chance += braconnierChance)) kind = 'braconnier'
  else if (roll < (chance += animalChance)) kind = 'animal'
  else if (roll < chance + pintadeChance) kind = 'pintade'

  const right = (W + OFF_EDGE - 10) * FP
  if (kind === 'cible') {
    addTarget(state, kind, { x: (300 + randomInt(state, 300)) * FP, vx: 0, life: 420 - d })
  } else if (kind === 'potamochere') {
    addTarget(state, kind, { x: right, vx: -(330 + randomInt(state, 180)) })
  } else if (kind === 'pintade') {
    const dir = randomInt(state, 2) ? 1 : -1
    addTarget(state, kind, { x: dir > 0 ? 170 * FP : right, y: 60 + randomInt(state, 110), vx: (240 + randomInt(state, 130)) * dir })
  } else if (kind === 'monstre') {
    const variant = randomInt(state, 2)
    addTarget(state, kind, { x: right, vx: -(110 + randomInt(state, 70) + d), variant })
  } else if (kind === 'braconnier') {
    addTarget(state, kind, { x: right, vx: -200, stopX: (340 + randomInt(state, 220)) * FP, life: 280 - d + randomInt(state, 40) })
  } else {
    const dir = randomInt(state, 2) ? 1 : -1
    const variant = randomInt(state, VARIANT_SIZES.animal.length)
    addTarget(state, kind, { x: dir > 0 ? 130 * FP : right, vx: (120 + randomInt(state, 80)) * dir, variant })
  }
}

function spawnGold(state) {
  addTarget(state, 'or', { x: (W + OFF_EDGE - 10) * FP, y: 30 + randomInt(state, 70), vx: -(620 + randomInt(state, 200)) })
}

// The target at (x, y) and where it was hit: 'head' / 'centre' or 'body'. The
// newest first: they walk in front.
function targetAt(state, x, y) {
  for (let i = state.targets.length - 1; i >= 0; i--) {
    const t = state.targets[i]
    if (t.state === 'hit' || t.state === 'flee') continue
    const { w, h } = sizeOf(t)
    const kind = KINDS[t.kind]
    const cx = Math.trunc(t.x / FP)
    if (t.kind === 'cible' || t.kind === 'or') {
      const r = Math.trunc(w / 2) + LEEWAY
      const cy = t.kind === 'or' ? t.y : GROUND - h + Math.trunc(w / 2)
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy)
      if (d2 > r * r) continue
      const inner = Math.trunc(w / 2 / BULLSEYE)
      return { target: t, zone: t.kind === 'cible' && d2 <= inner * inner ? 'centre' : 'body' }
    }
    const halfW = Math.trunc(w / 2) + LEEWAY
    if (x < cx - halfW || x > cx + halfW) continue
    const top = kind.air ? airYOf(t) - Math.trunc(h / 2) : GROUND - h
    if (y < top - LEEWAY || y > top + h + LEEWAY) continue
    return { target: t, zone: kind.head && y <= top + Math.trunc((h * kind.head) / 100) ? 'head' : 'body' }
  }
  return null
}

function fell(target) {
  target.state = 'hit'
  target.t = 0
}

function hitTarget(state, target, zone, x, y) {
  const kind = KINDS[target.kind]
  state.hits += 1
  if (kind.protected) {
    target.state = 'flee'
    target.vx = (target.vx < 0 ? -1 : 1) * FLEE_SPEED
    target.facing = targetFacing(target.vx)
    state.kills[target.kind] += 1
    state.score = Math.max(0, state.score - kind.points)
    state.combo = 0
    state.events.push({ type: 'protected', x, y, points: -kind.points, id: target.id })
    return
  }
  const precise = zone !== 'body'
  if (precise) state.perfect += 1
  target.hp -= precise ? 2 : 1
  if (target.hp > 0) {
    state.events.push({ type: 'wound', x, y, id: target.id })
  } else {
    const long = x >= LONG_SHOT_X
    if (long) state.longShots += 1
    const multiplier = 1 + Math.min(3, Math.trunc(state.combo / 4))
    const points = kind.points * (precise ? 2 : 1) * (long ? 2 : 1) * multiplier
    state.score += points
    state.kills[target.kind] += 1
    fell(target)
    state.events.push({ type: 'hit', x, y, points, zone, long, kind: target.kind, multiplier, id: target.id })
  }
  state.combo += 1
  state.bestCombo = Math.max(state.bestCombo, state.combo)
}

function missed(state, arrow, x, y, grounded) {
  state.combo = 0
  state.events.push({ type: 'miss', x, y, grounded, vx: arrow.vx, vy: arrow.vy })
}

// false when the arrow's flight is over.
function flyArrow(state, arrow) {
  const x0 = arrow.x
  const y0 = arrow.y
  moveArrow(arrow, state.wind)
  for (let i = 1; i <= SUBSTEPS; i++) {
    const x = Math.trunc((x0 + Math.trunc(((arrow.x - x0) * i) / SUBSTEPS)) / FP)
    const y = Math.trunc((y0 + Math.trunc(((arrow.y - y0) * i) / SUBSTEPS)) / FP)
    const found = targetAt(state, x, y)
    if (found) {
      hitTarget(state, found.target, found.zone, x, y)
      return false
    }
    if (y >= GROUND) {
      missed(state, arrow, x, GROUND, true)
      return false
    }
  }
  if (arrow.x < -OFF_EDGE * FP || arrow.x > (W + OFF_EDGE) * FP) {
    missed(state, arrow, Math.trunc(arrow.x / FP), Math.trunc(arrow.y / FP), false)
    return false
  }
  return true
}

function strike(state, target, attack) {
  state.lives -= 1
  state.combo = 0
  state.events.push({ type: 'attack', kind: target.kind, attack, id: target.id })
}

// false when the target is gone.
function moveTarget(state, t) {
  t.t += 1
  if (t.state === 'hit') return t.t < FALL_TICKS
  if (t.state !== 'aim') t.x += t.vx
  const cx = Math.trunc(t.x / FP)
  if (t.kind === 'cible') return t.t < t.life
  if (t.kind === 'monstre' && cx <= REACH_X) {
    strike(state, t, 'claw')
    return false
  }
  if (t.kind === 'braconnier' && t.state === 'go' && t.x <= t.stopX) {
    t.state = 'aim'
    t.t = 0
  } else if (t.state === 'aim' && t.t >= t.life) {
    // He fires once, then runs for it.
    strike(state, t, 'shot')
    t.state = 'leave'
    t.t = 0
    t.vx = 260
    t.facing = 1
  }
  return cx >= -OFF_EDGE && cx <= W + OFF_EDGE
}

export function step(state, actions = []) {
  if (state.over) return state
  state.events = []

  for (const [ax, ay] of actions) {
    const draw = drawOf(ax, ay)
    if (!draw || state.nock > 0) continue
    state.nock = NOCK_TICKS
    state.shots += 1
    state.arrows.push({ id: state.nextId++, x: BOW.x * FP, y: BOW.y * FP, vx: draw.ax * POWER, vy: draw.ay * POWER })
    state.events.push({ type: 'shot', power: Math.trunc((isqrt(draw.ax * draw.ax + draw.ay * draw.ay) * 100) / PULL_MAX) })
  }
  if (state.nock > 0) {
    state.nock -= 1
    if (state.nock === 0) state.events.push({ type: 'nocked' })
  }

  state.arrows = state.arrows.filter((arrow) => flyArrow(state, arrow))
  state.targets = state.targets.filter((t) => moveTarget(state, t))

  if (state.tick >= state.nextSpawn) {
    const d = difficulty(state)
    const active = state.targets.filter((t) => t.state !== 'hit' && t.kind !== 'or').length
    if (active < 3 + Math.trunc((d * 4) / 100)) spawn(state)
    state.nextSpawn = state.tick + 90 - Math.trunc((d * 45) / 100) + randomInt(state, 20)
  }
  if (state.tick >= state.nextGold) {
    spawnGold(state)
    state.nextGold += GOLD_EVERY
  }
  if (state.tick > 0 && state.tick % WIND_EVERY === 0) {
    const most = 1 + Math.trunc((difficulty(state) * (WIND_MAX - 1)) / 100)
    state.wind = randomInt(state, most * 2 + 1) - most
    state.events.push({ type: 'wind', wind: state.wind })
  }

  state.tick += 1
  if (state.lives <= 0 || state.tick >= GAME_TICKS) state.over = true
  return state
}

// Is a poacher about to fire (drawn with a warning, and the "!" above him)?
export function isAiming(target) {
  return target.state === 'aim' && target.t >= target.life - WARN_TICKS
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
    perfect: state.perfect,
    longShots: state.longShots,
    bestCombo: state.bestCombo,
    kills: { ...state.kills },
    lives: Math.max(0, state.lives),
    completed: state.lives > 0 && state.tick >= GAME_TICKS,
    ticks: state.tick,
    stars: starsFor(state.score),
  }
}

// [[tick, ax, ay]…] sorted by tick, every tick before endTick, at most one
// gesture per 10 ticks on average (the bow itself allows one per NOCK_TICKS).
export function validateInputs(inputs, endTick) {
  if (!Number.isInteger(endTick) || endTick < 1 || endTick > MAX_TICKS) return false
  if (!Array.isArray(inputs) || inputs.length > Math.ceil(endTick / 10) + 20) return false
  let last = 0
  for (const entry of inputs) {
    if (!Array.isArray(entry) || entry.length !== 3) return false
    const [tick, ax, ay] = entry
    if (!Number.isInteger(tick) || tick < last || tick >= endTick) return false
    if (!Number.isInteger(ax) || !Number.isInteger(ay) || Math.abs(ax) > PULL_MAX || Math.abs(ay) > PULL_MAX) return false
    last = tick
  }
  return true
}

// The gestures of a tick, as step() takes them: [ax, ay].
export function actionsAt(inputs, from, tick) {
  const actions = []
  let i = from
  while (i < inputs.length && inputs[i][0] === tick) {
    actions.push(inputs[i].slice(1))
    i++
  }
  return { actions, next: i }
}

export function simulateGame(seed, inputs, endTick) {
  const state = createGame(seed)
  let i = 0
  while (!state.over && state.tick < endTick) {
    const { actions, next } = actionsAt(inputs, i, state.tick)
    i = next
    step(state, actions)
  }
  return summarize(state)
}
