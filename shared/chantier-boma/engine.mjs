// CHANTIER BOMA — the building game, shared by the app and the server.
//
// Same contract as the other games (shared/*/engine.mjs): integers only, a
// seeded generator, and the browser records only the player's gestures. The
// server replays them with the same seed to get the real score, so a score
// typed into the request is worthless.
//
// A crane lowers small loads of bricks over the plan of a building. The player
// slides and turns the load; once down, each brick slips to the bottom of its
// own column. A brick of the material the plan asks for there is sound; another
// material cracks; a brick outside the plan breaks. Cracks and breakages cost
// solidity: at 0 the site collapses. Five buildings, from the village house to
// Saint-Michel de Nkembo. Nothing is ever cleared: the building only goes up.
//
// Gestures: [tick, action], action one of ACTIONS:
//   L / R slide, T turn, S lower one row, D drop, B send the load away in the
//   wheelbarrow (a few per building).

export const TICK_RATE = 60
export const COLS = 9
export const ROWS = 15
export const MAX_TICKS = 30 * 60 * TICK_RATE // a game can't last more than 30 min
export const ACTIONS = ['L', 'R', 'T', 'S', 'D', 'B']
export const MATERIALS = { T: 'terre', B: 'bois', P: 'paille', R: 'pierre', V: 'vitrail' }
export const GOLD = 'O' // a golden brick is right anywhere
export const MAX_SOLIDITY = 100
export const BARROWS = 3 // wheelbarrows per building
export const BARROW_EVERY = 5 // perfect loads in a row that bring one back
export const CRACK_COST = 5
export const BREAK_COST = 8
export const CLEAR_TICKS = 220
const PERFECT_GAIN = 1
const CLEAR_GAIN = 15
const LOCK_TICKS = 32 // time left to adjust a load that touches down
const LOCK_RESETS = 8
const SETTLE_TICKS = 14
const INPUTS_PER_TICK = 8

// The five buildings. plan: from the top, the ground is the last line.
//   T B P R V  a brick of that material
//   o          an opening (door, window): the formwork that holds it up goes in
//              by itself once the bricks below are laid
//   #          scaffolding, taken away when the building is done
//   .          outside the plan
// fall: ticks per row; air: ticks a load takes at least to come down on the
// highest column (a tall building leaves it less room to fall); noise: chance in 1000 that a brick of a load is not what
// the plan was waiting for; par: seconds under which it earns a time bonus.
export const LEVELS = [
  {
    id: 'case',
    name: 'La case du village',
    subtitle: 'Woleu-Ntem',
    fall: 40,
    air: 330,
    noise: 0,
    par: 75,
    plan: [
      '....P....',
      '...PPP...',
      '..PPPPP..',
      '.PPPPPPP.',
      '.TTTTTTT.',
      '.TTToTTT.',
      '.TTToTTT.',
    ],
  },
  {
    id: 'mbandja',
    name: 'Le corps de garde',
    subtitle: 'Moyen-Ogooué',
    fall: 34,
    air: 310,
    noise: 25,
    par: 85,
    plan: [
      '...PPP...',
      '.PPPPPPP.',
      'PPPPPPPPP',
      'BBBBBBBBB',
      'BooBoBooB',
      'BooBoBooB',
      'TTTTTTTTT',
    ],
  },
  {
    id: 'pilotis',
    name: 'La maison sur pilotis',
    subtitle: 'Lambaréné, sur l’Ogooué',
    fall: 29,
    air: 290,
    noise: 40,
    par: 95,
    plan: [
      '....P....',
      '..PPPPP..',
      '.PPPPPPP.',
      '.BTTBTTB.',
      '.BToBoTB.',
      '.BTTBTTB.',
      'BBBBBBBBB',
      '#B##B##B#',
      '#B##B##B#',
    ],
  },
  {
    id: 'phare',
    name: 'Le phare du cap Lopez',
    subtitle: 'Port-Gentil',
    fall: 25,
    air: 270,
    noise: 55,
    par: 90,
    plan: [
      '....T....',
      '...VVV...',
      '...VVV...',
      '..BBBBB..',
      '..#TTT#..',
      '..#RRR#..',
      '..#TTT#..',
      '..#RRR#..',
      '..#ToT#..',
      '.RRRoRRR.',
      'RRRRRRRRR',
    ],
  },
  {
    id: 'nkembo',
    name: 'Saint-Michel de Nkembo',
    subtitle: 'Libreville, l’église aux colonnes sculptées',
    fall: 22,
    air: 250,
    noise: 70,
    par: 130,
    plan: [
      '....B....',
      '....T....',
      '...TTT...',
      '..TTVTT..',
      '.TTVVVTT.',
      'TTTRVRTTT',
      'BRBRoRBRB',
      'BRBVoVBRB',
      'BRBoooBRB',
      'BRBoooBRB',
      'RRRRRRRRR',
    ],
  },
]

// Stars for a score (Ngori paid = stars).
export const STAR_SCORES = [3000, 7500, 13000]

// The loads' shapes: [x, y] of each brick around the first one, y downwards.
export const SHAPES = {
  solo: [[0, 0]],
  duo: [[0, 0], [1, 0]],
  ligne: [[0, 0], [-1, 0], [1, 0]],
  angle: [[0, 0], [1, 0], [0, 1]],
}
const SHAPE_WEIGHTS = { duo: 40, ligne: 22, angle: 38 }

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

// ---- The plan -----------------------------------------------------------

// What the plan has at (x, y): a material, 'o', '#', or '.' (outside).
export function planAt(level, x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return '.'
  const { plan } = LEVELS[level]
  const row = y - (ROWS - plan.length)
  return row < 0 ? '.' : plan[row][x]
}

export function isBrick(c) {
  return c in MATERIALS
}

export function bricksOf(level) {
  return LEVELS[level].plan.reduce((n, row) => n + [...row].filter(isBrick).length, 0)
}

// The formwork above a laid brick goes in by itself.
function raise(level, x, floor) {
  let f = floor
  while (f > 0 && (planAt(level, x, f - 1) === 'o' || planAt(level, x, f - 1) === '#')) f--
  return f
}

function startFloor(level) {
  return Array.from({ length: COLS }, (_, x) => raise(level, x, ROWS))
}

// ---- Loads --------------------------------------------------------------

export function turned(cells) {
  return cells.map(([x, y]) => [y === 0 ? 0 : -y, x])
}

// Where each brick of a load at x ends up: [{ i, x, y, want }] in the order
// they land (the lowest first), `want` being what the plan has there.
export function landing(level, floor, cells, x) {
  const order = cells.map((c, i) => ({ i, cx: x + c[0], cy: c[1] })).sort((a, b) => b.cy - a.cy || a.i - b.i)
  const f = floor.slice()
  return order.map(({ i, cx }) => {
    const y = f[cx] - 1
    const want = planAt(level, cx, y)
    if (isBrick(want)) f[cx] = raise(level, cx, y)
    return { i, x: cx, y, want }
  })
}

// The floor once those bricks are laid.
function laid(level, floor, spots) {
  const f = floor.slice()
  for (const s of spots) if (isBrick(s.want)) f[s.x] = raise(level, s.x, s.y)
  return f
}

const matches = (mat, want) => mat === GOLD || mat === want

// Every way of setting a load down inside the plan: { turns, x, spots, good }.
export function placements(level, floor, cells, mats) {
  const found = []
  let c = cells
  for (let turns = 0; turns < 4; turns++) {
    const shape = c
    for (let x = 0; x < COLS; x++) {
      if (shape.some(([dx]) => x + dx < 0 || x + dx >= COLS)) continue
      const spots = landing(level, floor, shape, x)
      if (!spots.every((s) => isBrick(s.want))) continue
      found.push({ turns, x, spots, good: mats ? spots.filter((s) => matches(mats[s.i], s.want)).length : 0 })
    }
    c = turned(c)
  }
  return found
}

export function bestPlacement(level, floor, load) {
  let best = null
  for (const p of placements(level, floor, load.cells, load.mats)) if (!best || p.good > best.good) best = p
  return best
}

// A load the plan has room for, made of what it is waiting for (give or take
// the stage's noise). null when the plan is full.
function makeLoad(state, floor) {
  const { level } = state
  const options = Object.keys(SHAPE_WEIGHTS)
    .map((shape) => ({ shape, weight: SHAPE_WEIGHTS[shape], places: placements(level, floor, SHAPES[shape]) }))
    .filter((o) => o.places.length)
  let pick = null
  if (options.length) {
    let n = randomInt(state, options.reduce((sum, o) => sum + o.weight, 0))
    for (const o of options) {
      n -= o.weight
      if (n < 0) {
        pick = o
        break
      }
    }
  } else {
    const places = placements(level, floor, SHAPES.solo)
    if (!places.length) return null
    pick = { shape: 'solo', places }
  }
  // Of two places drawn, the lower one: the building rises evenly.
  const draw = () => pick.places[randomInt(state, pick.places.length)]
  const depth = (p) => Math.min(...p.spots.map((s) => s.y))
  const a = draw()
  const b = draw()
  const place = depth(b) > depth(a) ? b : a
  const mats = []
  for (const s of place.spots) mats[s.i] = s.want
  const used = [...new Set(LEVELS[level].plan.join(''))].filter(isBrick).sort()
  for (let i = 0; i < mats.length; i++) {
    if (randomInt(state, 1000) < LEVELS[level].noise) mats[i] = used[randomInt(state, used.length)]
  }
  if (randomInt(state, 1000) < 60) mats[randomInt(state, mats.length)] = GOLD
  let cells = SHAPES[pick.shape].map((c) => c.slice())
  for (let n = randomInt(state, 4); n > 0; n--) cells = turned(cells)
  return { id: state.nextId++, shape: pick.shape, cells, mats }
}

function makeNext(state) {
  const { level, floor, load } = state
  const best = bestPlacement(level, floor, load)
  state.next = best ? makeLoad(state, laid(level, floor, best.spots)) : null
}

// Brings the next load under the crane. The building isn't finished: there is
// always at least one more.
function spawn(state) {
  let load = state.next
  // It no longer fits in what's left of the plan: another one.
  if (!load || !bestPlacement(state.level, state.floor, load)) load = makeLoad(state, state.floor)
  const top = Math.min(...load.cells.map((c) => c[1]))
  const lv = LEVELS[state.level]
  const room = Math.max(1, Math.min(...state.floor) - (Math.max(...load.cells.map((c) => c[1])) - top) - 1)
  const every = Math.max(lv.fall, Math.floor(lv.air / room))
  state.load = { ...load, x: 4, y: -top, every, fall: 0, lock: 0, resets: 0, dropped: 0 }
  makeNext(state)
  state.events.push({ type: 'load' })
}

// ---- Game ---------------------------------------------------------------

export function createGame(seed) {
  const state = {
    rng: seed >>> 0,
    tick: 0,
    level: 0,
    phase: 'build', // build | settle | clear
    phaseTick: 0,
    levelTick: 0,
    score: 0,
    solidity: MAX_SOLIDITY,
    barrows: BARROWS,
    floor: [], // per column, the row of the highest thing laid (ROWS: nothing)
    bricks: [], // laid in this building: { x, y, m, gold, ok, want }
    cracks: 0, // cracked or broken in this building
    load: null,
    next: null,
    nextId: 1,
    streak: 0, // perfect loads in a row
    bestStreak: 0,
    perfects: 0,
    good: 0,
    cracked: 0,
    broken: 0,
    masterpieces: 0,
    levelsCleared: 0,
    over: false,
    won: false,
    events: [],
    applied: [], // the gestures of the tick that did something
  }
  startLevel(state)
  state.events = []
  return state
}

function startLevel(state) {
  state.phase = 'build'
  state.phaseTick = 0
  state.levelTick = 0
  state.barrows = BARROWS
  state.floor = startFloor(state.level)
  state.bricks = []
  state.cracks = 0
  state.load = null
  state.next = null
  state.events.push({ type: 'level', level: state.level })
  spawn(state)
}

export function collides(floor, cells, x, y) {
  return cells.some(([dx, dy]) => {
    const cx = x + dx
    return cx < 0 || cx >= COLS || y + dy < 0 || y + dy >= floor[cx]
  })
}

export function multiplier(streak) {
  return 1 + Math.min(3, Math.floor(streak / 3))
}

// A moved load that rests on something gets a little more time, a few times.
function nudged(state) {
  const { load } = state
  if (load.lock && load.resets < LOCK_RESETS) {
    load.lock = 0
    load.resets++
  }
}

function slide(state, by) {
  const { load } = state
  if (collides(state.floor, load.cells, load.x + by, load.y)) return false
  load.x += by
  nudged(state)
  return true
}

// Where a load may move to have room to turn (down, right under the crane).
const KICKS = [[0, 0], [-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1], [0, -2], [0, 1]]

function turn(state) {
  const { load } = state
  if (load.cells.length < 2) return false
  const cells = turned(load.cells)
  for (const [kx, ky] of KICKS) {
    if (collides(state.floor, cells, load.x + kx, load.y + ky)) continue
    load.cells = cells
    load.x += kx
    load.y += ky
    nudged(state)
    return true
  }
  return false
}

function lower(state) {
  const { load } = state
  if (collides(state.floor, load.cells, load.x, load.y + 1)) return false
  load.y++
  load.fall = 0
  return true
}

function setDown(state) {
  const { level, load } = state
  const spots = landing(level, state.floor, load.cells, load.x)
  const landed = []
  let good = 0
  for (const s of spots) {
    const m = load.mats[s.i]
    const fromY = load.y + load.cells[s.i][1]
    if (!isBrick(s.want)) {
      state.solidity -= BREAK_COST
      state.broken++
      state.cracks++
      landed.push({ x: s.x, y: s.y, fromY, m, result: 'broken' })
      continue
    }
    const ok = matches(m, s.want)
    // A golden brick takes the colour the plan wanted, and keeps its shine.
    state.bricks.push({ x: s.x, y: s.y, m: m === GOLD ? s.want : m, gold: m === GOLD, ok, want: s.want })
    if (ok) {
      good++
      state.good++
    } else {
      state.solidity -= CRACK_COST
      state.cracked++
      state.cracks++
    }
    landed.push({ x: s.x, y: s.y, fromY, m, result: ok ? 'good' : 'cracked' })
  }
  state.floor = laid(level, state.floor, spots)

  const perfect = good === spots.length
  if (perfect) {
    state.streak++
    state.perfects++
    state.bestStreak = Math.max(state.bestStreak, state.streak)
    state.solidity = Math.min(MAX_SOLIDITY, state.solidity + PERFECT_GAIN)
    if (state.streak % BARROW_EVERY === 0 && state.barrows < BARROWS) {
      state.barrows++
      state.events.push({ type: 'barrowBack' })
    }
  } else {
    state.streak = 0
  }
  const times = multiplier(state.streak)
  const points = (good * 10 + (perfect ? 10 : 0)) * times + load.dropped
  state.score += points
  state.events.push({ type: 'landed', landed, perfect, points, streak: state.streak })
  state.load = null
  state.phase = 'settle'
  state.phaseTick = 0
}

function finishBuilding(state) {
  const lv = LEVELS[state.level]
  const seconds = Math.floor(state.levelTick / TICK_RATE)
  const timeBonus = Math.max(0, lv.par - seconds) * 5
  const masterpiece = state.cracks === 0
  const bonus = 300 + 100 * state.level + timeBonus + (masterpiece ? 500 : 0)
  state.score += bonus
  state.levelsCleared++
  if (masterpiece) state.masterpieces++
  state.solidity = Math.min(MAX_SOLIDITY, state.solidity + CLEAR_GAIN)
  state.phase = 'clear'
  state.phaseTick = 0
  state.next = null
  state.events.push({ type: 'clear', bonus, timeBonus, masterpiece })
}

function act(state, action) {
  if (state.phase !== 'build' || !state.load) return false
  if (action === 'L') return slide(state, -1)
  if (action === 'R') return slide(state, 1)
  if (action === 'T') {
    const done = turn(state)
    if (done) state.events.push({ type: 'turn' })
    return done
  }
  if (action === 'S') return lower(state)
  if (action === 'D') {
    while (lower(state)) state.load.dropped++
    state.events.push({ type: 'drop' })
    setDown(state)
    return true
  }
  if (action === 'B') {
    if (state.barrows <= 0) return false
    state.barrows--
    state.streak = 0
    state.events.push({ type: 'barrow' })
    state.load = null
    state.next = makeLoad(state, state.floor)
    spawn(state)
    return true
  }
  return false
}

// One tick. state.applied gets the gestures that did something: the only ones
// worth recording (the others change nothing in a replay either).
export function step(state, actions = []) {
  state.events = []
  state.applied = []
  if (state.over) return state
  for (const a of actions) if (act(state, a)) state.applied.push(a)

  state.phaseTick++
  if (state.phase === 'build') {
    state.levelTick++
    const { load } = state
    if (collides(state.floor, load.cells, load.x, load.y + 1)) {
      load.fall = 0
      if (++load.lock >= LOCK_TICKS) setDown(state)
    } else {
      load.lock = 0
      if (++load.fall >= load.every) lower(state)
    }
  } else if (state.phase === 'settle') {
    state.levelTick++
    if (state.solidity <= 0) {
      state.solidity = 0
      state.over = true
      state.events.push({ type: 'collapse' })
    } else if (state.phaseTick >= SETTLE_TICKS) {
      if (state.bricks.length >= bricksOf(state.level)) finishBuilding(state)
      else {
        state.phase = 'build'
        spawn(state)
      }
    }
  } else if (state.phaseTick >= CLEAR_TICKS) {
    if (state.level === LEVELS.length - 1) {
      state.score += state.solidity * 10
      state.won = true
      state.over = true
    } else {
      state.level++
      startLevel(state)
    }
  }

  state.tick++
  if (state.tick >= MAX_TICKS) state.over = true
  return state
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
    masterpieces: state.masterpieces,
    solidity: Math.max(0, state.solidity),
    good: state.good,
    cracked: state.cracked,
    broken: state.broken,
    perfects: state.perfects,
    bestStreak: state.bestStreak,
    ticks: state.tick,
    stars: starsFor(state.score),
  }
}

export function validateInputs(inputs, endTick) {
  if (!Number.isInteger(endTick) || endTick < 1 || endTick > MAX_TICKS) return false
  if (!Array.isArray(inputs) || inputs.length > endTick + 50) return false
  let last = 0
  let sameTick = 0
  for (const entry of inputs) {
    if (!Array.isArray(entry) || entry.length !== 2) return false
    const [tick, action] = entry
    if (!Number.isInteger(tick) || tick < last || tick >= endTick) return false
    if (!ACTIONS.includes(action)) return false
    sameTick = tick === last ? sameTick + 1 : 1
    if (sameTick > INPUTS_PER_TICK) return false
    last = tick
  }
  return true
}

export function simulateGame(seed, inputs, endTick) {
  const state = createGame(seed)
  let i = 0
  while (!state.over && state.tick < endTick) {
    const actions = []
    while (i < inputs.length && inputs[i][0] === state.tick) actions.push(inputs[i++][1])
    step(state, actions)
  }
  return summarize(state)
}
