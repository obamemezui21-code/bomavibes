// PERLES PUNU — the bead shooter, shared by the app and the server.
//
// Same contract as the other games (shared/*/engine.mjs): integers only (the
// paths are built once with plain arithmetic and square roots, which every
// JavaScript engine computes the same), a seeded generator, and the browser
// records only the player's gestures. The server replays them with the same
// seed to get the real score, so a score typed into the request is worthless.
//
// A Punu mask stands in the middle of the screen (360 × 640, portrait). A
// river of coloured beads winds around it towards the falls; the mask throws
// beads into it. Three beads of one colour or more touching: they burst. When
// a gap closes on two beads of the same colour, the beads behind roll back
// and can burst in turn (combo). A bead reaching the falls costs a life.
// Five stages, from the Lopé to the Chutes de Kongou.
//
// Gestures: [tick, x, y] = throw a bead towards that point, [tick, 'S'] =
// swap the bead in hand with the next one.

export const TICK_RATE = 60
export const W = 360
export const H = 640
export const FP = 16 // positions in 1/16 of a unit
export const BALL = 20 // a bead's diameter, in units
export const SHOOTER = { x: 180, y: 330 }
export const LIVES = 3
export const MAX_TICKS = 30 * 60 * TICK_RATE // a game can't last more than 30 min
export const COLORS = ['rouge', 'jaune', 'vert', 'bleu', 'violet', 'blanc']
// Special beads: bursting one slows the river, pushes it back, or blows up
// the beads around it.
export const SPECIALS = ['ralenti', 'recul', 'bombe']

const D = BALL * FP
const SX = SHOOTER.x * FP
const SY = SHOOTER.y * FP
const SHOT_STEP = 3 * FP // a thrown bead moves 4 × 3 units a tick
const SHOT_SUBSTEPS = 4
const COOLDOWN = 10 // ticks between two throws
const RUSH_SPEED = 40 // FP per tick: the river rolls in fast at the start of a stage
const RETRACT_SPEED = 40 // beads rolling back to close a gap
const REVERSE_SPEED = 24
const LOST_SPEED = 160
const SLOW_TICKS = 6 * TICK_RATE
const REVERSE_TICKS = 2 * TICK_RATE
const BOMB_REACH = 3 * D
const LOST_TICKS = 150
const CLEAR_TICKS = 180
const COIN_TICKS = 7 * TICK_RATE
const COIN_RADIUS = 14
const COIN_POINTS = 300

// The five stages. colors: how many bead colours; beads: how many roll in;
// speed: FP per tick; par: seconds under which a stage earns a time bonus.
// path: the river's control points (designed around the mask, at least 70
// units away from it, rings at least 41 units apart for 20-unit beads).
export const LEVELS = [
  {
    id: 'lope',
    name: 'La Lopé',
    subtitle: 'Savane et forêt',
    colors: 4,
    beads: 70,
    speed: 6,
    par: 80,
    path: [[-30, 40], [67, 125], [138, 59], [216, 66], [282, 138], [319, 253], [319, 380], [284, 486], [225, 544], [157, 545], [99, 492], [64, 403], [61, 303], [87, 219], [135, 170], [192, 166], [242, 203], [273, 268], [279, 340], [260, 401], [222, 437]],
  },
  {
    id: 'pongara',
    name: 'Pongara',
    subtitle: 'Plages et mangroves',
    colors: 4,
    beads: 90,
    speed: 7,
    par: 100,
    path: [[-30, 50], [60, 50], [300, 50], [335, 85], [300, 120], [60, 120], [25, 155], [60, 190], [300, 190], [335, 225], [335, 330], [320, 450], [260, 540], [180, 575], [100, 540], [45, 450], [55, 360], [95, 290], [150, 255], [220, 260], [262, 305], [268, 365], [240, 418], [180, 440]],
  },
  {
    id: 'cristal',
    name: 'Monts de Cristal',
    subtitle: 'Brumes et cascades',
    colors: 5,
    beads: 100,
    speed: 8,
    par: 120,
    path: [[180, 680], [180, 630], [101, 584], [45, 476], [26, 337], [48, 204], [102, 112], [173, 80], [242, 114], [292, 200], [311, 313], [296, 422], [252, 500], [192, 529], [133, 506], [89, 440], [72, 352], [82, 267], [117, 205], [165, 181], [214, 197], [250, 245], [266, 308], [258, 369], [232, 412], [195, 428], [158, 417]],
  },
  {
    id: 'loango',
    name: 'Loango',
    subtitle: 'Lagunes et éléphants',
    colors: 5,
    beads: 115,
    speed: 9,
    par: 140,
    path: [[390, 330], [345, 330], [319, 186], [257, 89], [178, 62], [104, 109], [54, 210], [41, 337], [66, 452], [119, 527], [185, 543], [246, 502], [285, 419], [293, 319], [271, 232], [226, 179], [173, 172], [126, 207], [97, 270], [93, 341], [112, 400], [147, 433], [187, 434], [221, 407]],
  },
  {
    id: 'kongou',
    name: 'Chutes de Kongou',
    subtitle: 'Le grand fleuve',
    colors: 6,
    beads: 135,
    speed: 10,
    par: 170,
    path: [[180, -40], [180, 30], [261, 76], [317, 186], [336, 327], [313, 461], [257, 555], [183, 584], [112, 547], [62, 456], [45, 338], [64, 225], [112, 147], [175, 121], [236, 151], [279, 225], [294, 320], [279, 410], [239, 473], [187, 493], [136, 470], [100, 413], [87, 341], [99, 273], [131, 227], [173, 213], [214, 230], [242, 271], [253, 321], [243, 366], [219, 395]],
  },
]

// Stars for a score (Ngori paid = stars).
export const STAR_SCORES = [10000, 22000, 34000]

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

// ---- The river ----------------------------------------------------------

// Catmull-Rom through the control points, then one point per unit of
// length, in FP. Built once per stage.
function buildPath(ctrl) {
  const dense = []
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)]
    const p1 = ctrl[i]
    const p2 = ctrl[i + 1]
    const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)]
    for (let s = 0; s < 32; s++) {
      const t = s / 32
      const t2 = t * t
      const t3 = t2 * t
      const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3)
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  dense.push(ctrl[ctrl.length - 1])
  const xs = [Math.round(dense[0][0] * FP)]
  const ys = [Math.round(dense[0][1] * FP)]
  let want = 1
  let acc = 0
  for (let i = 1; i < dense.length; i++) {
    const [x0, y0] = dense[i - 1]
    const [x1, y1] = dense[i]
    const seg = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0))
    while (seg > 0 && acc + seg >= want) {
      const k = (want - acc) / seg
      xs.push(Math.round((x0 + (x1 - x0) * k) * FP))
      ys.push(Math.round((y0 + (y1 - y0) * k) * FP))
      want++
    }
    acc += seg
  }
  return { xs: Int32Array.from(xs), ys: Int32Array.from(ys), length: xs.length - 1, end: (xs.length - 1) * FP }
}

const PATHS = []
export function pathOf(level) {
  PATHS[level] ||= buildPath(LEVELS[level].path)
  return PATHS[level]
}

// The point at `pos` (FP of length along the river), in FP.
export function pointAt(path, pos) {
  const p = Math.max(0, Math.min(path.end, pos))
  const i = Math.min(path.length - 1, Math.floor(p / FP))
  const f = p - i * FP
  return {
    x: path.xs[i] + Math.trunc(((path.xs[i + 1] - path.xs[i]) * f) / FP),
    y: path.ys[i] + Math.trunc(((path.ys[i + 1] - path.ys[i]) * f) / FP),
  }
}

// ---- Game ---------------------------------------------------------------

export function createGame(seed) {
  const state = {
    rng: seed >>> 0,
    tick: 0,
    level: 0,
    lives: LIVES,
    score: 0,
    phase: 'rush', // rush | play | clear | lost
    phaseTick: 0,
    levelTick: 0,
    chain: [], // beads from the back of the river to the front: { id, c, pos, sp? }
    spawned: 0,
    lastColor: -1,
    run: 0,
    nextId: 1,
    shots: [], // beads in the air: { x, y, vx, vy, c }
    cooldown: 0,
    current: 0, // the bead in hand
    next: 0,
    slow: 0,
    reverse: 0,
    combo: 0, // chain reaction under way
    streak: 0, // throws in a row that burst something
    coin: null, // a Ngori coin to catch: { x, y, ttl }
    nextCoin: 0,
    bestCombo: 0,
    bestStreak: 0,
    matched: 0,
    shotsFired: 0,
    coins: 0,
    levelsCleared: 0,
    over: false,
    won: false,
    events: [],
  }
  startLevel(state)
  state.events = []
  return state
}

function startLevel(state) {
  const lv = LEVELS[state.level]
  state.phase = 'rush'
  state.phaseTick = 0
  state.levelTick = 0
  state.chain = []
  state.spawned = 0
  state.lastColor = -1
  state.run = 0
  state.shots = []
  state.cooldown = 0
  state.slow = 0
  state.reverse = 0
  state.combo = 0
  state.coin = null
  state.nextCoin = 600 + randomInt(state, 600)
  state.current = randomInt(state, lv.colors)
  state.next = randomInt(state, lv.colors)
  state.events.push({ type: 'level', level: state.level })
}

function spawnBead(state, lv, pos) {
  let c
  if (state.lastColor >= 0 && state.run < 2 && randomInt(state, 100) < 42) c = state.lastColor
  else {
    c = randomInt(state, lv.colors - (state.lastColor >= 0 ? 1 : 0))
    if (state.lastColor >= 0 && c >= state.lastColor) c++
  }
  state.run = c === state.lastColor ? state.run + 1 : 1
  state.lastColor = c
  const bead = { id: state.nextId++, c, pos }
  if (state.spawned >= 8 && randomInt(state, 1000) < 25) bead.sp = SPECIALS[randomInt(state, SPECIALS.length)]
  state.spawned++
  state.chain.unshift(bead)
}

// A colour among those still on the river (or the stage's, when it's empty).
function pickColor(state) {
  const present = []
  for (const b of state.chain) if (!present.includes(b.c)) present.push(b.c)
  if (!present.length) return randomInt(state, LEVELS[state.level].colors)
  present.sort((a, b) => a - b)
  return present[randomInt(state, present.length)]
}

function keepColorsAlive(state) {
  if (!state.chain.length) return
  const has = (c) => state.chain.some((b) => b.c === c)
  if (!has(state.current)) state.current = pickColor(state)
  if (!has(state.next)) state.next = pickColor(state)
}

// The run of same-coloured, touching beads around index i: [from, to].
function groupAt(chain, i) {
  const c = chain[i].c
  let a = i
  let b = i
  while (a > 0 && chain[a - 1].c === c && chain[a].pos - chain[a - 1].pos <= D) a--
  while (b < chain.length - 1 && chain[b + 1].c === c && chain[b + 1].pos - chain[b].pos <= D) b++
  return [a, b]
}

// Bursts the group at i if it has 3 beads or more. combo: 1 for a throw,
// more for a chain reaction.
function burst(state, i, combo) {
  const path = pathOf(state.level)
  const [a, b] = groupAt(state.chain, i)
  if (b - a + 1 < 3) return false
  let removed = state.chain.splice(a, b - a + 1)
  const effects = removed.filter((x) => x.sp).map((x) => ({ sp: x.sp, pos: x.pos }))
  // A bomb also takes the beads near it, whatever their colour.
  for (const e of effects) {
    if (e.sp !== 'bombe') continue
    const near = state.chain.filter((x) => Math.abs(x.pos - e.pos) <= BOMB_REACH)
    state.chain = state.chain.filter((x) => Math.abs(x.pos - e.pos) > BOMB_REACH)
    removed = removed.concat(near)
  }
  for (const e of effects) {
    if (e.sp === 'ralenti') state.slow = SLOW_TICKS
    else if (e.sp === 'recul') state.reverse = REVERSE_TICKS
  }
  const points = removed.length * 10 * combo + (combo > 1 ? 50 * combo : 0)
  state.score += points
  state.matched += removed.length
  state.combo = combo
  state.bestCombo = Math.max(state.bestCombo, combo)
  state.events.push({
    type: 'burst',
    combo,
    points,
    specials: effects.map((e) => e.sp),
    beads: removed.map((x) => ({ c: x.c, ...pointAt(path, x.pos) })),
  })
  return true
}

function segments(chain) {
  const segs = []
  let start = 0
  for (let i = 1; i <= chain.length; i++) {
    if (i === chain.length || chain[i].pos - chain[i - 1].pos > D) {
      segs.push([start, i - 1])
      start = i
    }
  }
  return segs
}

function moveRiver(state, lv) {
  const chain = state.chain
  if (!chain.length) return
  const segs = segments(chain)
  // The back of the river is pushed from the source.
  let v = state.phase === 'rush' ? RUSH_SPEED : state.reverse > 0 ? -REVERSE_SPEED : state.slow > 0 ? Math.ceil(lv.speed / 2) : lv.speed
  if (v < 0) v = Math.max(v, -chain[0].pos)
  for (let i = segs[0][0]; i <= segs[0][1]; i++) chain[i].pos += v
  // Beads ahead of a gap roll back when the bead behind the gap matches.
  const retracting = new Set()
  for (let k = 1; k < segs.length; k++) {
    const [from, to] = segs[k]
    if (chain[from - 1].c !== chain[from].c) continue
    retracting.add(chain[from].id)
    for (let i = from; i <= to; i++) chain[i].pos -= RETRACT_SPEED
  }
  // Nothing overlaps: a bead pushes the ones ahead. A rolling-back group
  // that meets the beads behind it may burst.
  const contacts = []
  for (let i = 1; i < chain.length; i++) {
    if (chain[i].pos < chain[i - 1].pos + D) {
      if (retracting.has(chain[i].id)) contacts.push(i)
      chain[i].pos = chain[i - 1].pos + D
    }
  }
  for (let k = contacts.length - 1; k >= 0; k--) {
    const i = contacts[k]
    if (i < state.chain.length && !burst(state, i, state.combo + 1)) state.combo = 0
  }
}

function spawn(state, lv) {
  if (state.reverse > 0) return
  while (state.spawned < lv.beads && (!state.chain.length || state.chain[0].pos >= D)) {
    spawnBead(state, lv, state.chain.length ? state.chain[0].pos - D : 0)
  }
}

// The bead of the river a thrown bead at (x, y) touches, or -1.
function touching(chain, path, x, y) {
  let best = -1
  let bestD2 = D * D
  for (let i = 0; i < chain.length; i++) {
    const p = pointAt(path, chain[i].pos)
    const dx = p.x - x
    const dy = p.y - y
    const d2 = dx * dx + dy * dy
    if (d2 < bestD2) {
      bestD2 = d2
      best = i
    }
  }
  return best
}

function inside(x, y) {
  return x > -20 * FP && x < (W + 20) * FP && y > -20 * FP && y < (H + 20) * FP
}

// The direction of a throw towards (tx, ty), per substep, or null too close.
function aim(tx, ty) {
  const dx = tx * FP - SX
  const dy = ty * FP - SY
  const len2 = dx * dx + dy * dy
  if (len2 < 8 * FP * (8 * FP)) return null
  const len = Math.sqrt(len2)
  return { vx: Math.trunc((dx * SHOT_STEP) / len), vy: Math.trunc((dy * SHOT_STEP) / len) }
}

function throwBead(state, tx, ty) {
  const dir = aim(tx, ty)
  if (!dir) return
  state.shots.push({ x: SX, y: SY, ...dir, c: state.current })
  state.current = state.next
  state.next = pickColor(state)
  state.cooldown = COOLDOWN
  state.shotsFired++
  state.events.push({ type: 'throw' })
}

// The thrown bead joins the river next to bead j, on the side it came from.
function insert(state, shot, j) {
  const path = pathOf(state.level)
  const chain = state.chain
  const bead = chain[j]
  const ahead = pointAt(path, bead.pos + D / 2)
  const behind = pointAt(path, bead.pos - D / 2)
  const dA = (ahead.x - shot.x) ** 2 + (ahead.y - shot.y) ** 2
  const dB = (behind.x - shot.x) ** 2 + (behind.y - shot.y) ** 2
  const fresh = { id: state.nextId++, c: shot.c, pos: dA < dB ? bead.pos + D : bead.pos }
  const k = dA < dB ? j + 1 : j
  chain.splice(k, 0, fresh)
  for (let i = k + 1; i < chain.length && chain[i].pos < chain[i - 1].pos + D; i++) chain[i].pos = chain[i - 1].pos + D
  state.events.push({ type: 'insert', id: fresh.id })
  if (burst(state, k, 1)) {
    state.streak++
    state.bestStreak = Math.max(state.bestStreak, state.streak)
    if (state.streak >= 3) {
      const bonus = 20 * state.streak
      state.score += bonus
      state.events.push({ type: 'streak', streak: state.streak, points: bonus })
    }
  } else {
    state.streak = 0
    state.combo = 0
  }
}

function moveShots(state) {
  const path = pathOf(state.level)
  const kept = []
  for (const shot of state.shots) {
    let done = false
    for (let s = 0; s < SHOT_SUBSTEPS && !done; s++) {
      shot.x += shot.vx
      shot.y += shot.vy
      const coin = state.coin
      if (coin && (coin.x - shot.x) ** 2 + (coin.y - shot.y) ** 2 < ((COIN_RADIUS + BALL / 2) * FP) ** 2) {
        state.coin = null
        state.coins++
        state.score += COIN_POINTS
        state.events.push({ type: 'coin', x: coin.x, y: coin.y, points: COIN_POINTS })
      }
      const j = touching(state.chain, path, shot.x, shot.y)
      if (j >= 0) {
        insert(state, shot, j)
        done = true
      } else if (!inside(shot.x, shot.y)) {
        state.streak = 0
        state.events.push({ type: 'miss' })
        done = true
      }
    }
    if (!done) kept.push(shot)
  }
  state.shots = kept
}

function updateCoin(state) {
  const coin = state.coin
  if (coin) {
    if (--coin.ttl <= 0) {
      state.coin = null
      state.nextCoin = state.levelTick + 900 + randomInt(state, 900)
    }
    return
  }
  if (state.levelTick < state.nextCoin) return
  const x = 40 + randomInt(state, W - 80)
  const y = 70 + randomInt(state, H - 140)
  if ((x - SHOOTER.x) ** 2 + (y - SHOOTER.y) ** 2 < 70 * 70) return // too close to the mask: next tick
  state.coin = { x: x * FP, y: y * FP, ttl: COIN_TICKS }
  state.nextCoin = state.levelTick + COIN_TICKS + 900 + randomInt(state, 900)
  state.events.push({ type: 'coinUp' })
}

export function step(state, actions = []) {
  state.events = []
  if (state.over) return state
  const lv = LEVELS[state.level]
  const path = pathOf(state.level)

  if (state.phase === 'clear') {
    if (--state.phaseTick <= 0) {
      if (state.level === LEVELS.length - 1) {
        state.over = true
        state.won = true
        state.events.push({ type: 'victory' })
      } else {
        state.level++
        startLevel(state)
      }
    }
  } else if (state.phase === 'lost') {
    // The river pours into the falls, then the stage starts again.
    for (const b of state.chain) b.pos += LOST_SPEED
    state.chain = state.chain.filter((b) => b.pos < path.end)
    if (--state.phaseTick <= 0) {
      if (state.lives <= 0) {
        state.over = true
        state.events.push({ type: 'gameOver' })
      } else startLevel(state)
    }
  } else {
    for (const a of actions) {
      if (a[0] === 'S') {
        ;[state.current, state.next] = [state.next, state.current]
        state.events.push({ type: 'swap' })
      } else if (state.cooldown === 0) throwBead(state, a[0], a[1])
    }
    if (state.cooldown > 0) state.cooldown--
    moveRiver(state, lv)
    spawn(state, lv)
    moveShots(state)
    updateCoin(state)
    keepColorsAlive(state)
    if (state.slow > 0) state.slow--
    if (state.reverse > 0) state.reverse--
    const head = state.chain[state.chain.length - 1]
    if (state.phase === 'rush' && (state.spawned >= lv.beads || (head && head.pos >= Math.floor(path.end * 0.28)))) state.phase = 'play'

    if (head && head.pos >= path.end) {
      state.lives--
      state.phase = 'lost'
      state.phaseTick = LOST_TICKS
      state.shots = []
      state.coin = null
      state.streak = 0
      state.events.push({ type: 'lost', lives: state.lives })
    } else if (state.spawned >= lv.beads && !state.chain.length && !state.shots.length) {
      const timeBonus = Math.floor(Math.max(0, lv.par * TICK_RATE - state.levelTick) / 3)
      const bonus = 1000 + 500 * state.level + timeBonus
      state.score += bonus
      state.levelsCleared++
      state.phase = 'clear'
      state.phaseTick = CLEAR_TICKS
      state.coin = null
      state.events.push({ type: 'clear', level: state.level, bonus, timeBonus })
    }
    state.levelTick++
  }
  state.tick++
  if (state.tick >= MAX_TICKS) state.over = true
  return state
}

// Where a bead thrown now towards (tx, ty) would land, if the river stood
// still: { index, x, y } (FP) or null. For the aiming guide and the robot.
export function aimHit(state, tx, ty) {
  const dir = aim(tx, ty)
  if (!dir) return null
  const path = pathOf(state.level)
  let x = SX
  let y = SY
  for (let s = 0; s < 400; s++) {
    x += dir.vx
    y += dir.vy
    const j = touching(state.chain, path, x, y)
    if (j >= 0) return { index: j, x, y }
    if (!inside(x, y)) return { index: -1, x, y }
  }
  return null
}

// How far the head of the river is along it, 0–1 (danger near 1).
export function progressOf(state) {
  const head = state.chain[state.chain.length - 1]
  return head ? head.pos / pathOf(state.level).end : 0
}

export function starsFor(score) {
  return STAR_SCORES.filter((s) => score >= s).length
}

export function summarize(state) {
  return {
    score: state.score,
    won: state.won,
    completed: state.won,
    level: state.level,
    levelsCleared: state.levelsCleared,
    lives: Math.max(0, state.lives),
    matched: state.matched,
    shots: state.shotsFired,
    bestCombo: state.bestCombo,
    bestStreak: state.bestStreak,
    coins: state.coins,
    ticks: state.tick,
    stars: starsFor(state.score),
  }
}

// At most one throw every COOLDOWN ticks, plus the swaps.
export function validateInputs(inputs, endTick) {
  if (!Number.isInteger(endTick) || endTick < 1 || endTick > MAX_TICKS) return false
  if (!Array.isArray(inputs) || inputs.length > Math.ceil(endTick / 4) + 50) return false
  let last = 0
  for (const entry of inputs) {
    if (!Array.isArray(entry)) return false
    const [tick] = entry
    if (!Number.isInteger(tick) || tick < last || tick >= endTick) return false
    if (entry.length === 2) {
      if (entry[1] !== 'S') return false
    } else if (entry.length === 3) {
      const [, x, y] = entry
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > W || y < 0 || y > H) return false
    } else {
      return false
    }
    last = tick
  }
  return true
}

// The gestures of a tick, as step() takes them: [x, y] or ['S'].
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
