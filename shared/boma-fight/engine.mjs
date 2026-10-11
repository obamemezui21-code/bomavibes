// BOMA FIGHT — the fighting game's simulation, shared by the app and the server.
//
// Same contract as shared/moto-boma/engine.mjs: integers only, a seeded
// generator, and the browser records only the player's gestures (tick +
// action). The opponent is the engine's own AI, driven by the same seed, so
// the server replays the gestures and gets the very same fight — a result
// typed into the request is worthless.
//
// The arena is 1000 units wide; fighters walk left and right, and each attack
// hits when the opponent stands within its reach on its first active tick.

export const TICK_RATE = 60
export const ARENA = 1000
export const ROUND_TICKS = 60 * TICK_RATE // a round lasts 60 s at most
export const ROUNDS_TO_WIN = 2
const MAX_ROUNDS = 5 // draws can't go on forever
const INTRO_TICKS = 90 // "Round 1… Combattez !"
const OUTRO_TICKS = 120 // after a KO or the end of the clock
export const MAX_TICKS = MAX_ROUNDS * (ROUND_TICKS + INTRO_TICKS + OUTRO_TICKS)
export const MAX_ENERGY = 1000
const BODY = 70 // two fighters never stand closer than this
const EDGE = 50
const BUFFER_TICKS = 8 // an attack pressed while busy still comes out this soon after

// L / R: walk left / right, S: stop walking, B / U: guard on / off,
// P: punch, K: kick, X: special (needs a full energy bar).
export const ACTIONS = ['L', 'R', 'S', 'B', 'U', 'P', 'K', 'X']

// Frame data, before each fighter's power and reach.
export const MOVES = {
  punch: { startup: 5, active: 3, recovery: 10, damage: 35, range: 95, stun: 16, push: 18 },
  kick: { startup: 10, active: 4, recovery: 16, damage: 55, range: 125, stun: 22, push: 30 },
  special: { startup: 14, active: 6, recovery: 26, damage: 150, range: 175, stun: 0, push: 90 },
}
const DOWN_TICKS = 55 // knocked down by a special: on the floor, can't be hit

// The 12 fighters (portraits in frontend-web/src/assets/game/fight/).
//   hp, walk (units/tick), power and guard (% of damage stopped when
//   guarding), reach (+units on every attack), energy (% gained), quick
//   (ticks taken off every attack's startup: bare hands beat weapons on speed).
export const FIGHTERS = {
  nzeang: { name: 'Nzeang', title: 'Le gardien masqué', weapon: 'Massue', special: 'Coup du masque', hp: 1100, walk: 4, power: 120, reach: 10, guard: 70, energy: 100, quick: 0 },
  bikoulou: { name: 'Bikoulou', title: 'La liane', weapon: 'Mains nues', special: 'Danse de la liane', hp: 900, walk: 7, power: 102, reach: 0, guard: 75, energy: 115, quick: 2 },
  ondo: { name: 'Ondo', title: 'Le sage', weapon: 'Lance', special: 'Lance de l’ancêtre', hp: 950, walk: 4, power: 95, reach: 28, guard: 75, energy: 100, quick: 0 },
  amissa: { name: 'Amissa', title: 'La lionne', weapon: 'Poings', special: 'Rugissement', hp: 950, walk: 6, power: 108, reach: 0, guard: 75, energy: 110, quick: 2 },
  mebale: { name: 'Mebale', title: 'Le bouclier', weapon: 'Bouclier', special: 'Charge du bouclier', hp: 1050, walk: 4, power: 100, reach: 5, guard: 90, energy: 95, quick: 1 },
  luku: { name: 'Luku', title: 'La lame du fleuve', weapon: 'Machette', special: 'Lame du fleuve', hp: 950, walk: 6, power: 105, reach: 20, guard: 72, energy: 100, quick: 0 },
  kassa: { name: 'Kassa', title: 'La reine des sabres', weapon: 'Deux sabres', special: 'Tempête de sabres', hp: 950, walk: 6, power: 100, reach: 22, guard: 72, energy: 100, quick: 0 },
  nzame: { name: 'Nzame', title: 'L’élu', weapon: 'Force divine', special: 'Éclair de Nzame', hp: 1000, walk: 5, power: 110, reach: 5, guard: 80, energy: 125, quick: 1 },
  obame: { name: 'Obame', title: 'Le champion', weapon: 'Poings', special: 'Crochet du champion', hp: 1100, walk: 4, power: 115, reach: 0, guard: 80, energy: 100, quick: 2 },
  sally: { name: 'Sally', title: 'L’éclair', weapon: 'Gants', special: 'Rafale', hp: 950, walk: 6, power: 106, reach: 0, guard: 80, energy: 110, quick: 2 },
  biyogo: { name: 'Biyogo', title: 'Le jeune loup', weapon: 'Gants', special: 'Morsure du loup', hp: 900, walk: 7, power: 104, reach: 0, guard: 78, energy: 115, quick: 2 },
  essono: { name: 'Essono', title: 'L’armure', weapon: 'Armure', special: 'Marteau de fer', hp: 1150, walk: 3, power: 105, reach: 10, guard: 85, energy: 95, quick: 0 },
}
export const FIGHTER_IDS = Object.keys(FIGHTERS)

// The computer's level: how often it thinks, how well it guards and how much
// it attacks; reward = Ngori for a win at that level.
export const LEVELS = {
  easy: { name: 'Facile', think: 20, guard: 30, attack: 50, special: 30, reward: 1 },
  normal: { name: 'Normal', think: 10, guard: 58, attack: 70, special: 60, reward: 2 },
  hard: { name: 'Difficile', think: 8, guard: 66, attack: 76, special: 90, reward: 3 },
}
export const DEFAULT_LEVEL = 'normal'
export const PERFECT_BONUS = 1 // a round won without losing any health

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

// The opponent of a fight: drawn from the seed, never the player's own fighter.
export function opponentFor(seed, fighterId) {
  const others = FIGHTER_IDS.filter((id) => id !== fighterId)
  return others[(seed >>> 0) % others.length]
}

function createFighter(id, x) {
  const f = FIGHTERS[id]
  return {
    id,
    x,
    facing: 1,
    hp: f.hp,
    maxHp: f.hp,
    energy: 0,
    state: 'idle', // idle | walk | attack | block | hit | down | ko | win
    t: 0, // ticks spent in the current state
    move: null, // attack in progress
    connected: false, // that attack already hit (or was guarded)
    stun: 0,
    walkDir: 0, // what the controls ask for: -1, 0, 1
    guardHeld: false,
    queued: null, // { move, tick } pressed while busy
    damageTaken: 0, // this round
  }
}

export function createFight(seed, fighterId, level = DEFAULT_LEVEL) {
  const player = FIGHTERS[fighterId] ? fighterId : FIGHTER_IDS[0]
  const s = seed >>> 0
  return {
    rng: s,
    level: LEVELS[level] ? level : DEFAULT_LEVEL,
    tick: 0,
    round: 1,
    phase: 'intro', // intro | fight | outro | over
    phaseT: 0,
    clock: ROUND_TICKS,
    wins: [0, 0],
    perfects: 0, // rounds the player won without losing health
    roundWinner: null, // 0, 1 or -1 (draw), during the outro
    fighters: [createFighter(player, 330), createFighter(opponentFor(s, player), 670)],
    ai: { nextThink: 0 },
    events: [],
    over: false,
    winner: null, // 0 (player), 1 (computer) or -1 (draw)
  }
}

const busy = (f) => f.state === 'attack' || f.state === 'hit' || f.state === 'down' || f.state === 'ko' || f.state === 'win'

function press(f, move, tick) {
  if (move === 'special' && f.energy < MAX_ENERGY) return
  f.queued = { move, tick }
}

function applyAction(f, action, tick) {
  if (action === 'L') f.walkDir = -1
  else if (action === 'R') f.walkDir = 1
  else if (action === 'S') f.walkDir = 0
  else if (action === 'B') f.guardHeld = true
  else if (action === 'U') f.guardHeld = false
  else if (action === 'P') press(f, 'punch', tick)
  else if (action === 'K') press(f, 'kick', tick)
  else if (action === 'X') press(f, 'special', tick)
}

function setState(f, state) {
  f.state = state
  f.t = 0
}

// The computer's decisions, as the same gestures a player would make.
function aiActions(state) {
  const me = state.fighters[1]
  const foe = state.fighters[0]
  if (state.tick < state.ai.nextThink || busy(me)) return []
  const level = LEVELS[state.level]
  state.ai.nextThink = state.tick + level.think + randomInt(state, 6)
  const stats = FIGHTERS[me.id]
  const gap = Math.abs(foe.x - me.x)
  const toward = foe.x > me.x ? 'R' : 'L'
  const away = toward === 'R' ? 'L' : 'R'
  const actions = []
  const roll = randomInt(state, 100)

  // An attack coming: guard (or not).
  if (foe.state === 'attack' && foe.t < startupOf(foe) && gap < MOVES[foe.move].range + FIGHTERS[foe.id].reach + 40) {
    if (roll < level.guard) return ['S', 'B']
  }
  if (me.guardHeld) actions.push('U')
  if (me.energy >= MAX_ENERGY && gap < MOVES.special.range + stats.reach && randomInt(state, 100) < level.special) {
    actions.push('S', 'X')
    return actions
  }
  const kickReach = MOVES.kick.range + stats.reach
  const punchReach = MOVES.punch.range + stats.reach
  if (gap <= kickReach - 10 && roll < level.attack) {
    actions.push('S', gap <= punchReach - 10 && randomInt(state, 2) === 0 ? 'P' : 'K')
  } else if (gap > kickReach - 20) {
    actions.push(toward)
  } else if (roll < level.attack + 15) {
    actions.push(away)
  } else {
    actions.push('S')
  }
  return actions
}

// The attack in progress' startup, for this fighter.
const startupOf = (f) => Math.max(2, MOVES[f.move].startup - FIGHTERS[f.id].quick)

function startAttack(f) {
  setState(f, 'attack')
  f.move = f.queued.move
  f.connected = false
  f.queued = null
  if (f.move === 'special') f.energy = 0
}

function advance(state, f, foe) {
  f.t++
  if (f.queued && state.tick - f.queued.tick > BUFFER_TICKS) f.queued = null
  if (f.state === 'attack') {
    const m = MOVES[f.move]
    if (f.t >= startupOf(f) + m.active + m.recovery) setState(f, 'idle')
  } else if (f.state === 'hit') {
    if (f.t >= f.stun) setState(f, 'idle')
  } else if (f.state === 'down') {
    if (f.t >= DOWN_TICKS) setState(f, 'idle')
  }
  if (busy(f)) return

  if (f.queued) {
    startAttack(f)
    return
  }
  if (f.guardHeld) {
    if (f.state !== 'block') setState(f, 'block')
    return
  }
  if (f.walkDir) {
    if (f.state !== 'walk') setState(f, 'walk')
    // Backing off is a little slower than stepping in.
    const back = Math.sign(foe.x - f.x) !== f.walkDir
    const speed = FIGHTERS[f.id].walk
    f.x += f.walkDir * (back ? speed - 1 : speed)
  } else if (f.state !== 'idle') {
    setState(f, 'idle')
  }
}

// The hit an attacker lands this tick, if any (from the positions before it).
function hitOf(attacker, target) {
  if (attacker.state !== 'attack' || attacker.connected) return null
  const m = MOVES[attacker.move]
  const startup = startupOf(attacker)
  if (attacker.t < startup || attacker.t >= startup + m.active) return null
  if (target.state === 'down' || target.state === 'ko') return null
  const stats = FIGHTERS[attacker.id]
  if (Math.abs(target.x - attacker.x) > m.range + stats.reach) return null
  return { move: attacker.move, damage: Math.floor((m.damage * stats.power) / 100) }
}

function applyHit(state, who, hit) {
  const attacker = state.fighters[who]
  const target = state.fighters[1 - who]
  attacker.connected = true
  const m = MOVES[hit.move]
  const dir = Math.sign(target.x - attacker.x) || attacker.facing
  // A guard stops most of it, but not a special in full.
  const guarding = target.state === 'block'
  const guard = FIGHTERS[target.id].guard
  const kept = guarding ? (hit.move === 'special' ? Math.floor(guard / 2) : guard) : 0
  const damage = Math.max(1, Math.floor((hit.damage * (100 - kept)) / 100))
  target.hp = Math.max(0, target.hp - damage)
  target.damageTaken += damage
  target.x += dir * (guarding ? Math.floor(m.push / 2) : m.push)
  attacker.energy = Math.min(MAX_ENERGY, attacker.energy + Math.floor((damage * FIGHTERS[attacker.id].energy) / 100))
  target.energy = Math.min(MAX_ENERGY, target.energy + Math.floor((damage * FIGHTERS[target.id].energy) / 200))
  target.queued = null
  if (target.hp === 0) {
    setState(target, 'ko')
  } else if (guarding) {
    target.t = 0 // stays in guard, only pushed back
  } else if (hit.move === 'special') {
    setState(target, 'down')
  } else {
    target.stun = m.stun
    setState(target, 'hit')
  }
  state.events.push({ type: 'hit', who, move: hit.move, damage, guarded: guarding, x: target.x })
}

function endRound(state, winner) {
  state.phase = 'outro'
  state.phaseT = 0
  state.roundWinner = winner
  const [p, c] = state.fighters
  if (winner === 0) {
    state.wins[0]++
    if (p.damageTaken === 0) state.perfects++
  } else if (winner === 1) {
    state.wins[1]++
  }
  for (const f of state.fighters) {
    f.queued = null
    if (f.state !== 'ko') setState(f, 'idle')
  }
  if (winner === 0) setState(p, 'win')
  if (winner === 1) setState(c, 'win')
  state.events.push({ type: 'round-end', winner, ko: p.hp === 0 || c.hp === 0, perfect: winner === 0 && p.damageTaken === 0 })
}

function startRound(state) {
  state.round++
  state.phase = 'intro'
  state.phaseT = 0
  state.clock = ROUND_TICKS
  state.roundWinner = null
  const [p, c] = state.fighters
  state.fighters = [createFighter(p.id, 330), createFighter(c.id, 670)]
  // The controls the player is holding carry over.
  state.fighters[0].walkDir = p.walkDir
  state.fighters[0].guardHeld = p.guardHeld
  state.events.push({ type: 'round', round: state.round })
}

export function step(state, actions = []) {
  if (state.over) return state
  state.events = []
  const [p, c] = state.fighters
  for (const action of actions) applyAction(p, action, state.tick)
  state.tick++
  state.phaseT++

  if (state.phase === 'intro') {
    if (state.phaseT >= INTRO_TICKS) {
      state.phase = 'fight'
      state.phaseT = 0
      state.events.push({ type: 'fight' })
    }
    return state
  }
  if (state.phase === 'outro') {
    for (const f of state.fighters) f.t++
    if (state.phaseT >= OUTRO_TICKS) {
      const [a, b] = state.wins
      if (a >= ROUNDS_TO_WIN || b >= ROUNDS_TO_WIN || state.round >= MAX_ROUNDS) {
        state.over = true
        state.phase = 'over'
        state.winner = a > b ? 0 : b > a ? 1 : -1
        state.events.push({ type: 'over', winner: state.winner })
      } else {
        startRound(state)
      }
    }
    return state
  }

  for (const action of aiActions(state)) applyAction(c, action, state.tick)
  advance(state, p, c)
  advance(state, c, p)

  // Both hits are read before either is applied: a trade hits both.
  const hits = [hitOf(p, c), hitOf(c, p)]
  if (hits[0]) applyHit(state, 0, hits[0])
  if (hits[1]) applyHit(state, 1, hits[1])
  for (const [i, hit] of hits.entries()) {
    if (hit?.move === 'special') state.events.push({ type: 'special', who: i })
  }

  // Never through each other, never off the arena.
  const [left, right] = p.x <= c.x ? [p, c] : [c, p]
  if (right.x - left.x < BODY) {
    const mid = Math.floor((left.x + right.x) / 2)
    left.x = mid - BODY / 2
    right.x = mid + BODY / 2
  }
  if (left.x < EDGE) {
    left.x = EDGE
    right.x = Math.max(right.x, EDGE + BODY)
  }
  if (right.x > ARENA - EDGE) {
    right.x = ARENA - EDGE
    left.x = Math.min(left.x, ARENA - EDGE - BODY)
  }
  if (!busy(p)) p.facing = c.x >= p.x ? 1 : -1
  if (!busy(c)) c.facing = p.x >= c.x ? 1 : -1

  state.clock--
  if (p.hp === 0 || c.hp === 0) {
    endRound(state, p.hp === 0 && c.hp === 0 ? -1 : p.hp === 0 ? 1 : 0)
  } else if (state.clock <= 0) {
    // Time: the one with more health left (in share of their bar) wins.
    const a = p.hp * c.maxHp
    const b = c.hp * p.maxHp
    endRound(state, a > b ? 0 : b > a ? 1 : -1)
  }
  if (state.tick >= MAX_TICKS && !state.over) {
    state.over = true
    state.phase = 'over'
    const [a, b] = state.wins
    state.winner = a > b ? 0 : b > a ? 1 : -1
  }
  return state
}

export function summarize(state) {
  const won = state.over && state.winner === 0
  const reward = won ? LEVELS[state.level].reward + (state.perfects ? PERFECT_BONUS : 0) : 0
  return {
    fighter: state.fighters[0].id,
    opponent: state.fighters[1].id,
    level: state.level,
    ticks: state.tick,
    finished: state.over,
    winner: state.over ? (state.winner === 0 ? 'me' : state.winner === 1 ? 'cpu' : 'draw') : null,
    wins: [...state.wins],
    rounds: state.round,
    perfects: state.perfects,
    reward,
  }
}

// [[tick, action], …] sorted by tick, every tick before `endTick`; at most
// ~one gesture every 3 ticks on average (button mashing included).
export function validateInputs(inputs, endTick) {
  if (!Number.isInteger(endTick) || endTick < 1 || endTick > MAX_TICKS) return false
  if (!Array.isArray(inputs) || inputs.length > Math.ceil(endTick / 3) + 40) return false
  let last = 0
  for (const entry of inputs) {
    if (!Array.isArray(entry) || entry.length !== 2) return false
    const [tick, action] = entry
    if (!Number.isInteger(tick) || tick < last || tick >= endTick || !ACTIONS.includes(action)) return false
    last = tick
  }
  return true
}

export function simulateFight(seed, fighterId, level, inputs, endTick) {
  const state = createFight(seed, fighterId, level)
  let i = 0
  while (!state.over && state.tick < endTick) {
    const actions = []
    while (i < inputs.length && inputs[i][0] === state.tick) actions.push(inputs[i++][1])
    step(state, actions)
  }
  return summarize(state)
}
