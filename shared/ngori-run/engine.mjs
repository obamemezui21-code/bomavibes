// NGORI RUN — the game simulation, shared by the app and the server.
//
// The browser runs it 60 times a second and records only the player's
// gestures (tick + action). At the end the server replays those gestures
// through this very file with the same seed and gets the real distance,
// coins and crash tick — so a score typed into the request is worthless.
//
// For the replay to match bit for bit on every browser and on Node, the
// simulation uses integers only (no Math.sin/random/float drift): distances
// in centimetres, time in ticks, randomness from a seeded 32-bit generator.
// Anything purely visual (lane slide animation, jump arc…) belongs to the
// renderer, never here.

export const TICK_RATE = 60
export const LANES = 3
export const MAX_TICKS = 15 * 60 * TICK_RATE // a run can't last more than 15 min
export const ACTIONS = ['L', 'R', 'U', 'D'] // lane left, lane right, jump, slide

export const JUMP_TICKS = 36
export const SLIDE_TICKS = 40
// Ticks of a jump during which low obstacles pass under the runner.
const AIR_FROM = 4
const AIR_TO = 32
export const PLAYER_LEN = 60
const GENERATE_AHEAD = 13000 // the world is laid out 130 m ahead
const GRACE_TICKS = 60 // invulnerable after the shield breaks

// clear: how it's dodged besides changing lane ('jump', 'slide' or none)
export const OBSTACLES = {
  barrier: { len: 60, clear: 'jump', weight: 3 },
  cone: { len: 50, clear: 'jump', weight: 2 },
  hole: { len: 120, clear: 'jump', weight: 2 },
  sign: { len: 60, clear: 'slide', weight: 2 },
  car: { len: 420, clear: null, weight: 3 },
  works: { len: 220, clear: null, weight: 2 },
}
const OBSTACLE_TYPES = Object.keys(OBSTACLES)
const OBSTACLE_WEIGHT_TOTAL = OBSTACLE_TYPES.reduce((sum, t) => sum + OBSTACLES[t].weight, 0)

export const POWERUPS = ['shield', 'magnet', 'multiplier', 'boost']
export const POWER_TICKS = { magnet: 8 * TICK_RATE, multiplier: 8 * TICK_RATE, boost: 4 * TICK_RATE }

// Combo = Ngori picked up in a row; missing one resets it.
// [combo reached, bonus Ngori]; then +5 every further 20 coins.
export const COMBO_BONUSES = [
  [5, 1],
  [10, 2],
  [20, 5],
]
// [metres, bonus Ngori]
export const DISTANCE_BONUSES = [
  [500, 1],
  [1000, 2],
  [2000, 3],
  [5000, 5],
]

// Speed in cm per tick: 9.6 m/s at the start, +1 every 7.5 s, capped at
// 20.4 m/s (reached after ~2 min 15 s). 30 s ≈ 12 m/s, 60 s ≈ 14.4, 90 s ≈ 16.8.
export function baseSpeed(tick) {
  return Math.min(16 + Math.floor(tick / 450), 34)
}

// 0 easy (< 30 s), 1 medium, 2 fast, 3 hard (≥ 90 s)
export function levelAt(tick) {
  return Math.min(3, Math.floor(tick / (30 * TICK_RATE)))
}

// mulberry32 — tiny, integer-only, identical everywhere.
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

function pickObstacle(state) {
  let roll = randomInt(state, OBSTACLE_WEIGHT_TOTAL)
  for (const type of OBSTACLE_TYPES) {
    roll -= OBSTACLES[type].weight
    if (roll < 0) return type
  }
  return OBSTACLE_TYPES[0]
}

export function createRun(seed) {
  return {
    rng: seed >>> 0,
    tick: 0,
    dist: 0, // cm run so far
    prevDist: 0,
    speed: baseSpeed(0),
    lane: 1,
    jump: 0, // ticks into the current jump (0 = on the ground)
    slide: 0,
    shield: false,
    grace: 0,
    magnet: 0,
    multiplier: 0,
    boost: 0,
    combo: 0,
    bestCombo: 0,
    coins: 0, // Ngori picked up on the road
    bonus: 0, // Ngori from combos and distance milestones
    points: 0, // score from coins and bonuses
    scoreAcc: 0, // score from distance, in 1/100 points
    nextDistanceBonus: 0,
    nextRowZ: 3000, // first obstacles 30 m ahead
    nextId: 1,
    obstacles: [],
    coinsOnRoad: [],
    powerups: [],
    events: [], // what happened this tick, for sounds and effects (not part of the result)
    over: false,
    crashed: false,
  }
}

function generateRow(state) {
  const level = levelAt(state.tick)
  const z = state.nextRowZ
  const roll = randomInt(state, 100)
  const count = level === 0 ? (roll < 70 ? 1 : 2) : roll < 45 ? 1 : roll < 85 ? 2 : 3

  const lanes = [0, 1, 2]
  // Shuffle the lanes, then block the first `count` of them.
  for (let i = 2; i > 0; i--) {
    const j = randomInt(state, i + 1)
    ;[lanes[i], lanes[j]] = [lanes[j], lanes[i]]
  }
  let longest = 0
  const blocked = []
  for (let i = 0; i < count; i++) {
    let type = pickObstacle(state)
    // A full row always keeps one way through: never three lane-only blocks.
    if (count === 3 && i === 2 && blocked.every((b) => !OBSTACLES[b.type].clear) && !OBSTACLES[type].clear) {
      type = 'barrier'
    }
    blocked.push({ id: state.nextId++, z, lane: lanes[i], type })
    longest = Math.max(longest, OBSTACLES[type].len)
  }
  state.obstacles.push(...blocked)

  const gap = Math.max(2600 - level * 300 + randomInt(state, 600), longest + 700)
  const freeLanes = lanes.slice(count)

  // Now and then a short line of coins in a free lane, before the next row.
  // Kept sparse on purpose: each one is a real Ngori (~1.5 per 100 m).
  if (freeLanes.length && randomInt(state, 100) < 12) {
    const lane = freeLanes[randomInt(state, freeLanes.length)]
    const room = Math.floor((gap - 600) / 250)
    const n = Math.min(3 + randomInt(state, 3), room)
    for (let i = 0; i < n; i++) {
      state.coinsOnRoad.push({ id: state.nextId++, z: z + 300 + i * 250, lane, gold: randomInt(state, 12) === 0, taken: false })
    }
  } else if (randomInt(state, 100) < 9) {
    // Rare power-up, alone in a free lane (or on top of a jumpable row).
    const lane = freeLanes.length ? freeLanes[randomInt(state, freeLanes.length)] : randomInt(state, 3)
    state.powerups.push({ id: state.nextId++, z: z + Math.floor(gap / 2), lane, type: POWERUPS[randomInt(state, 4)], taken: false })
  }

  state.nextRowZ = z + gap
}

function applyAction(state, action) {
  if (action === 'L') {
    if (state.lane > 0) state.lane--
  } else if (action === 'R') {
    if (state.lane < LANES - 1) state.lane++
  } else if (action === 'U') {
    state.slide = 0
    if (!state.jump) state.jump = 1
  } else if (action === 'D') {
    // Swiping down mid-air drops straight into a slide.
    state.jump = 0
    if (!state.slide) state.slide = 1
  }
}

function addBonus(state, ngori, reason) {
  state.bonus += ngori
  state.points += ngori * (reason === 'distance' ? 100 : 50)
  state.events.push({ type: 'bonus', reason, ngori })
}

// Advances the run by one tick, after applying this tick's gestures.
export function step(state, actions = []) {
  if (state.over) return state
  state.events = []
  for (const action of actions) applyAction(state, action)

  state.tick++
  if (state.jump) state.jump = state.jump >= JUMP_TICKS ? 0 : state.jump + 1
  if (state.slide) state.slide = state.slide >= SLIDE_TICKS ? 0 : state.slide + 1

  const base = baseSpeed(state.tick)
  state.speed = state.boost ? base + (base >> 1) : base
  state.prevDist = state.dist
  state.dist += state.speed
  state.scoreAcc += state.speed * (levelAt(state.tick) + 1)

  while (state.nextRowZ < state.dist + GENERATE_AHEAD) generateRow(state)

  const front = state.dist + PLAYER_LEN
  const airborne = state.jump >= AIR_FROM && state.jump <= AIR_TO
  const invulnerable = state.boost > 0 || state.grace > 0

  for (const o of state.obstacles) {
    if (o.hit || o.lane !== state.lane) continue
    const def = OBSTACLES[o.type]
    if (o.z >= front || o.z + def.len <= state.dist) continue
    if ((def.clear === 'jump' && airborne) || (def.clear === 'slide' && state.slide)) continue
    if (invulnerable) continue
    if (state.shield) {
      state.shield = false
      state.grace = GRACE_TICKS
      o.hit = true
      state.events.push({ type: 'shield' })
      continue
    }
    state.over = true
    state.crashed = true
    state.events.push({ type: 'crash', obstacle: o.type })
    return state
  }

  const reach = state.magnet ? front + 600 : front
  for (const c of state.coinsOnRoad) {
    if (c.taken || c.z < state.prevDist || c.z >= reach) continue
    if (!state.magnet && c.lane !== state.lane) continue
    c.taken = true
    const value = (c.gold ? 3 : 1) * (state.multiplier ? 2 : 1)
    state.coins += value
    state.points += value * 10
    state.combo++
    state.bestCombo = Math.max(state.bestCombo, state.combo)
    state.events.push({ type: 'coin', gold: c.gold, value, id: c.id })
    const milestone = COMBO_BONUSES.find(([at]) => at === state.combo)
    if (milestone) addBonus(state, milestone[1], 'combo')
    else if (state.combo > 20 && state.combo % 20 === 0) addBonus(state, 5, 'combo')
  }

  for (const c of state.coinsOnRoad) {
    if (c.taken || c.missed || c.z >= state.prevDist) continue
    c.missed = true
    if (state.combo) state.events.push({ type: 'combo-lost' })
    state.combo = 0
  }

  for (const p of state.powerups) {
    if (p.taken || p.lane !== state.lane || p.z < state.prevDist || p.z >= front) continue
    p.taken = true
    if (p.type === 'shield') state.shield = true
    else state[p.type] = POWER_TICKS[p.type]
    state.events.push({ type: 'powerup', powerup: p.type })
  }

  const metres = Math.floor(state.dist / 100)
  while (state.nextDistanceBonus < DISTANCE_BONUSES.length && metres >= DISTANCE_BONUSES[state.nextDistanceBonus][0]) {
    addBonus(state, DISTANCE_BONUSES[state.nextDistanceBonus][1], 'distance')
    state.nextDistanceBonus++
  }

  if (state.grace) state.grace--
  if (state.magnet) state.magnet--
  if (state.multiplier) state.multiplier--
  if (state.boost) state.boost--

  // Forget what's behind the runner.
  const behind = state.dist - 600
  if (state.tick % 30 === 0) {
    state.obstacles = state.obstacles.filter((o) => o.z + OBSTACLES[o.type].len > behind)
    state.coinsOnRoad = state.coinsOnRoad.filter((c) => c.z > behind)
    state.powerups = state.powerups.filter((p) => p.z > behind)
  }

  if (state.tick >= MAX_TICKS) state.over = true
  return state
}

export function scoreOf(state) {
  return Math.floor(state.scoreAcc / 100) + state.points
}

export function summarize(state) {
  return {
    ticks: state.tick,
    distance: Math.floor(state.dist / 100),
    score: scoreOf(state),
    coins: state.coins,
    bonus: state.bonus,
    total: state.coins + state.bonus,
    bestCombo: state.bestCombo,
    crashed: state.crashed,
  }
}

// Checks the shape of a recorded gesture list: [[tick, action], …] sorted by
// tick, every tick before `endTick`, at most ~5 gestures a second on average.
export function validateInputs(inputs, endTick) {
  if (!Number.isInteger(endTick) || endTick < 1 || endTick > MAX_TICKS) return false
  if (!Array.isArray(inputs) || inputs.length > Math.ceil(endTick / 12) + 20) return false
  let last = 0
  for (const entry of inputs) {
    if (!Array.isArray(entry) || entry.length !== 2) return false
    const [tick, action] = entry
    if (!Number.isInteger(tick) || tick < last || tick >= endTick || !ACTIONS.includes(action)) return false
    last = tick
  }
  return true
}

// Replays a whole run: the server's source of truth.
export function simulateRun(seed, inputs, endTick) {
  const state = createRun(seed)
  let i = 0
  while (!state.over && state.tick < endTick) {
    const actions = []
    while (i < inputs.length && inputs[i][0] === state.tick) actions.push(inputs[i++][1])
    step(state, actions)
  }
  return summarize(state)
}
