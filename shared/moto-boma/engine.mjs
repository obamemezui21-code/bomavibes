// MOTO BOMA — the motorbike race simulation, shared by the app and the server.
//
// Same contract as shared/ngori-run/engine.mjs: integers only, a seeded
// generator, and the browser records only the rider's gestures (tick +
// action). The server replays them with the same seed to get the real finish
// time and the Ngori picked up, so a time typed into the request is worthless.
//
// The rider steers freely across the road (not lane to lane): `x` is the
// position in hundredths of a lane, 0 = left lane, 200 = right lane. Traffic
// drives the same way, slower; the race ends at the course's finish line.

export const TICK_RATE = 60
export const LANES = 3
export const MAX_TICKS = 5 * 60 * TICK_RATE // a race can't last more than 5 min
// L / R: start steering left / right, S: stop steering, N: fire a nitro.
export const ACTIONS = ['L', 'R', 'S', 'N']

const X_MIN = -25 // a little shoulder on each side
const X_MAX = 225
const STEER_SPEED = 6 // hundredths of a lane per tick: a lane in ~0.3 s
export const PLAYER_LEN = 180 // cm of bike
const GENERATE_AHEAD = 14000

// Speed in cm per tick.
const CRUISE_SPEED = 38 // ≈ 82 km/h
export const NITRO_SPEED = 58 // ≈ 125 km/h
const ACCEL_EVERY = 4 // +1 cm/tick every N ticks up to cruise
export const NITRO_TICKS = 150 // 2.5 s
export const MAX_NITRO = 3
const BUMP_STUN_TICKS = 40 // no throttle right after hitting a car
const BUMP_GRACE_TICKS = 45 // can't hit another car meanwhile

// Half-widths, in hundredths of a lane, for "is the bike over it".
const CAR_HALF = 56
const BUS_HALF = 62
const HOLE_HALF = 48
const PICKUP_HALF = 55

export const VEHICLES = {
  car: { len: 420 },
  bus: { len: 1100 },
  hole: { len: 120 },
}
// Traffic speed by lane (cm per tick): slow on the left, quicker on the right.
// Fixed per lane so a car never drives through the bus ahead of it.
const LANE_SPEEDS = [12, 15, 18]

// Courses, in cm. Medals: finish ticks for gold, silver, bronze.
export const COURSES = {
  'bord-de-mer': {
    name: 'Bord de mer → Akanda',
    length: 200000, // 2 km
    medals: { gold: 5350, silver: 5800, bronze: 6400 }, // 1:29, 1:37, 1:47
  },
}
export const DEFAULT_COURSE = 'bord-de-mer'
// Ngori for each medal, on top of the coins picked up.
export const MEDAL_BONUS = { gold: 3, silver: 2, bronze: 1 }

// mulberry32, as in NGORI RUN.
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

export function createRace(seed, courseId = DEFAULT_COURSE) {
  const course = COURSES[courseId] || COURSES[DEFAULT_COURSE]
  return {
    rng: seed >>> 0,
    course: COURSES[courseId] ? courseId : DEFAULT_COURSE,
    length: course.length,
    tick: 0,
    dist: 0,
    prevDist: 0,
    speed: 0,
    x: 100, // middle lane
    steer: 0, // -1, 0, 1
    nitro: 0, // ticks left
    nitroCharges: 1, // one to start with
    stun: 0,
    grace: 0,
    coins: 0,
    bumps: 0,
    nextRowZ: 2500,
    nextId: 1,
    vehicles: [], // { id, lane, z, speed, type, hit }
    coinsOnRoad: [], // { id, lane, z, gold, taken }
    pickups: [], // { id, lane, z, type: 'nitro', taken }
    events: [],
    over: false,
    finished: false,
    finishTick: 0,
  }
}

function generateRow(state) {
  const z = state.nextRowZ
  const progress = Math.min(1, z / state.length)
  const roll = randomInt(state, 100)
  // Busier as the race goes on; there's always at least one free lane.
  const count = roll < 64 - Math.floor(progress * 20) ? 1 : 2
  const lanes = [0, 1, 2]
  for (let i = 2; i > 0; i--) {
    const j = randomInt(state, i + 1)
    ;[lanes[i], lanes[j]] = [lanes[j], lanes[i]]
  }
  for (let i = 0; i < count; i++) {
    // Mostly small cars; now and then a long bus or a pothole.
    const kind = randomInt(state, 100)
    const type = kind < 10 ? 'hole' : kind < 18 ? 'bus' : 'car'
    state.vehicles.push({
      id: state.nextId++,
      lane: lanes[i],
      z: z + randomInt(state, 300),
      speed: type === 'hole' ? 0 : LANE_SPEEDS[lanes[i]],
      type,
      hit: false,
    })
  }
  const free = lanes.slice(count)
  // Coins stay rare: each one is a real Ngori (~10 on a whole course).
  if (randomInt(state, 100) < 9) {
    const lane = free[randomInt(state, free.length)]
    const n = 2 + randomInt(state, 3)
    for (let i = 0; i < n; i++) {
      state.coinsOnRoad.push({ id: state.nextId++, lane, z: z + 600 + i * 260, gold: randomInt(state, 10) === 0, taken: false })
    }
  } else if (randomInt(state, 100) < 14) {
    state.pickups.push({ id: state.nextId++, lane: free[randomInt(state, free.length)], z: z + 900, type: 'nitro', taken: false })
  }
  state.nextRowZ = z + 2200 + randomInt(state, 800) - Math.floor(progress * 400)
}

function applyAction(state, action) {
  if (action === 'L') state.steer = -1
  else if (action === 'R') state.steer = 1
  else if (action === 'S') state.steer = 0
  else if (action === 'N' && state.nitroCharges > 0 && !state.nitro) {
    state.nitroCharges--
    state.nitro = NITRO_TICKS
    state.events.push({ type: 'nitro' })
  }
}

// Is the bike (at x, from dist to dist + PLAYER_LEN) over something of the
// given half-width at lane `lane`, from z to z + len?
function overlaps(state, lane, half, z, len) {
  return Math.abs(state.x - lane * 100) < half && z < state.dist + PLAYER_LEN && z + len > state.dist
}

export function step(state, actions = []) {
  if (state.over) return state
  state.events = []
  for (const action of actions) applyAction(state, action)
  state.tick++

  state.x = Math.max(X_MIN, Math.min(X_MAX, state.x + state.steer * STEER_SPEED))

  if (state.stun) {
    state.stun--
  } else if (state.nitro) {
    state.speed = Math.min(NITRO_SPEED, state.speed + 1)
  } else if (state.speed > CRUISE_SPEED) {
    state.speed--
  } else if (state.tick % ACCEL_EVERY === 0 && state.speed < CRUISE_SPEED) {
    state.speed++
  }
  if (state.nitro) state.nitro--

  state.prevDist = state.dist
  state.dist += state.speed
  for (const v of state.vehicles) v.z += v.speed

  while (state.nextRowZ < state.dist + GENERATE_AHEAD && state.nextRowZ < state.length) generateRow(state)

  for (const v of state.vehicles) {
    const half = v.type === 'hole' ? HOLE_HALF : v.type === 'bus' ? BUS_HALF : CAR_HALF
    if (v.hit || !overlaps(state, v.lane, half, v.z, VEHICLES[v.type].len)) continue
    if (v.type === 'hole') {
      v.hit = true
      state.speed = Math.floor((state.speed * 6) / 10)
      state.events.push({ type: 'pothole' })
    } else if (!state.grace) {
      v.hit = true
      state.speed = Math.floor((state.speed * 3) / 10)
      state.nitro = 0
      state.stun = BUMP_STUN_TICKS
      state.grace = BUMP_GRACE_TICKS
      state.bumps++
      state.events.push({ type: 'bump' })
    }
  }
  if (state.grace) state.grace--

  for (const c of state.coinsOnRoad) {
    if (c.taken || !overlaps(state, c.lane, PICKUP_HALF, c.z, 1)) continue
    c.taken = true
    const value = c.gold ? 3 : 1
    state.coins += value
    state.events.push({ type: 'coin', gold: c.gold, value, id: c.id })
  }
  for (const p of state.pickups) {
    if (p.taken || !overlaps(state, p.lane, PICKUP_HALF, p.z, 1)) continue
    p.taken = true
    state.nitroCharges = Math.min(MAX_NITRO, state.nitroCharges + 1)
    state.events.push({ type: 'pickup', pickup: p.type })
  }

  // Forget what's well behind (traffic is slower: it only falls behind).
  if (state.tick % 30 === 0) {
    const behind = state.dist - 2000
    state.vehicles = state.vehicles.filter((v) => v.z + VEHICLES[v.type].len > behind)
    state.coinsOnRoad = state.coinsOnRoad.filter((c) => c.z > behind)
    state.pickups = state.pickups.filter((p) => p.z > behind)
  }

  if (state.dist >= state.length) {
    state.over = true
    state.finished = true
    state.finishTick = state.tick
    state.events.push({ type: 'finish' })
  } else if (state.tick >= MAX_TICKS) {
    state.over = true
  }
  return state
}

export function medalFor(courseId, finishTick) {
  const medals = (COURSES[courseId] || COURSES[DEFAULT_COURSE]).medals
  if (!finishTick) return null
  if (finishTick <= medals.gold) return 'gold'
  if (finishTick <= medals.silver) return 'silver'
  if (finishTick <= medals.bronze) return 'bronze'
  return null
}

export function summarize(state) {
  const medal = state.finished ? medalFor(state.course, state.finishTick) : null
  const bonus = medal ? MEDAL_BONUS[medal] : 0
  return {
    course: state.course,
    ticks: state.tick,
    finished: state.finished,
    finishTick: state.finished ? state.finishTick : null,
    distance: Math.floor(Math.min(state.dist, state.length) / 100),
    coins: state.coins,
    medal,
    bonus,
    total: state.coins + bonus,
    bumps: state.bumps,
  }
}

// [[tick, action], …] sorted by tick, every tick before `endTick`; steering
// is held, so at most ~5 gestures a second on average.
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

// Gestures as a compact string, to keep a race for duels: "0R,14S,90N".
export function encodeInputs(inputs) {
  return inputs.map(([tick, action]) => `${tick}${action}`).join(',')
}

export function decodeInputs(text) {
  if (!text) return []
  return text.split(',').map((entry) => [Number(entry.slice(0, -1)), entry.slice(-1)])
}

export function simulateRace(seed, courseId, inputs, endTick) {
  const state = createRace(seed, courseId)
  let i = 0
  while (!state.over && state.tick < endTick) {
    const actions = []
    while (i < inputs.length && inputs[i][0] === state.tick) actions.push(inputs[i++][1])
    step(state, actions)
  }
  return summarize(state)
}
