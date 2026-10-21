// ESCADRILLE OGOOUÉ — the fighter-jet shoot'em up, shared by the app and the
// server.
//
// Same contract as the other games (shared/*/engine.mjs): integers only, a
// seeded generator, and the browser records only the player's gestures. The
// server replays them with the same seed to get the real score, so a score
// typed into the request is worthless.
//
// A vertical scroller, 360 × 640 units (portrait). The jet flies north over
// Gabon — the coast, the Ogooué, the Monts de Cristal — against the air fleet
// of the Serpent Noir, the fictional crime network of Commando Okoumé (drones,
// smugglers' helicopters, pirate planes, speedboats, turrets), up to its
// flying fortress, the Condor Noir. The jet fires on its own; shot-down crews
// bail out under a parachute.
//
// Gestures: [tick, x, y] = the point the jet now heads for (it flies there at
// its own top speed), [tick, 'B'] = a bomb.

export const TICK_RATE = 60
export const W = 360
export const H = 640
export const FP = 16 // positions in 1/16 of a unit
export const MAX_TICKS = 5 * 60 * TICK_RATE // a sortie can't last more than 5 min
export const BOSS_TICK = 150 * TICK_RATE // the Condor Noir shows up after 2 min 30
export const SCROLL = 24 // ground scroll, in FP per tick (1.5 unit)
const INVULNERABLE = 120 // ticks of blinking after a hit
const BOMB_TICKS = 50 // a bomb's blast lasts this long
const MAX_POWER = 4
const MAX_BULLETS = 220
const COMBO_TICKS = 150 // a kill within this keeps the combo going

// The jets. speed: units per tick; fire: ticks between volleys.
export const JETS = {
  aigle: { name: 'Aigle', role: 'Polyvalent', speed: 4, hp: 4, bombs: 3, fire: 9, damage: 2, hitbox: 4 },
  faucon: { name: 'Faucon', role: 'Rapide', speed: 6, hp: 3, bombs: 2, fire: 7, damage: 2, hitbox: 3 },
  calao: { name: 'Calao', role: 'Blindé', speed: 3, hp: 5, bombs: 3, fire: 11, damage: 3, hitbox: 5 },
}
export const DEFAULT_JET = 'aigle'

// The Serpent Noir's craft. r: hit radius; ground: on the ground or water
// (scrolls with it, can't be rammed); crew: bails out when shot down.
export const KINDS = {
  drone: { hp: 2, r: 10, points: 50 },
  avion: { hp: 6, r: 14, points: 150, crew: true },
  helico: { hp: 14, r: 18, points: 300, crew: true },
  vedette: { hp: 10, r: 14, points: 250, ground: true, crew: true },
  tourelle: { hp: 20, r: 16, points: 400, ground: true },
  boss: { hp: 1500, r: 52, points: 10000 },
}
export const BONUS_KINDS = ['power', 'bomb', 'repair', 'ngori']
const BONUS_POINTS = { ngori: 500 }

// The three legs of the sortie (the backdrop changes with them).
export const ZONES = [
  { name: 'Côte de Libreville', from: 0 },
  { name: 'Fleuve Ogooué', from: 50 * TICK_RATE },
  { name: 'Monts de Cristal', from: 100 * TICK_RATE },
]

// Stars for a score (Ngori paid = stars).
export const STAR_SCORES = [15000, 40000, 80000]

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

// Integer sine/cosine: angle in 1/256 of a turn, result in 1/1024.
const SIN = Array.from({ length: 256 }, (_, i) => Math.round(Math.sin((i * Math.PI * 2) / 256) * 1024))
export function isin(a) {
  return SIN[((a % 256) + 256) % 256]
}
export function icos(a) {
  return SIN[(((a + 64) % 256) + 256) % 256]
}

// tan of 0..32 (1/256 of a turn), in 1/1024: for the integer atan2 below.
const TAN = Array.from({ length: 33 }, (_, i) => Math.round(Math.tan((i * Math.PI * 2) / 256) * 1024))

// Integer angle (1/256 of a turn, 0 = east, 64 = south) from dy, dx.
function iatan2(dy, dx) {
  if (dx === 0 && dy === 0) return 64
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  const ratio = Math.trunc((Math.min(ax, ay) * 1024) / Math.max(ax, ay))
  let a = 0
  while (a < 32 && TAN[a + 1] - ratio < ratio - TAN[a]) a++
  if (ay > ax) a = 64 - a
  if (dx < 0) a = 128 - a
  if (dy < 0) a = 256 - a
  return ((a % 256) + 256) % 256
}

export function jetOf(options) {
  return JETS[options?.jet] ? options.jet : DEFAULT_JET
}

export function createGame(seed, options = {}) {
  const jet = jetOf(options)
  const spec = JETS[jet]
  return {
    rng: seed >>> 0,
    jet,
    tick: 0,
    scroll: 0, // FP flown since the start (for the backdrop)
    player: { x: (W / 2) * FP, y: (H - 90) * FP, tx: (W / 2) * FP, ty: (H - 90) * FP, inv: 0, cool: 0 },
    hp: spec.hp,
    bombs: spec.bombs,
    power: 1,
    bombing: 0,
    shots: [], // the jet's bullets
    bullets: [], // the enemies'
    enemies: [],
    bonuses: [],
    nextId: 1,
    nextWave: 120,
    waveCount: 0,
    bossSpawned: false,
    bossDown: false,
    victoryAt: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    kills: { drone: 0, avion: 0, helico: 0, vedette: 0, tourelle: 0, boss: 0 },
    crews: 0, // pilots bailed out under a parachute
    bonusesTaken: 0,
    hitsTaken: 0,
    bombsUsed: 0,
    over: false,
    won: false,
    events: [],
  }
}

export function zoneAt(tick) {
  let z = 0
  ZONES.forEach((zone, i) => {
    if (tick >= zone.from) z = i
  })
  return z
}

// ── Spawning ───────────────────────────────────────────────────────────────
function addEnemy(state, kind, fields) {
  const e = {
    id: state.nextId++,
    kind,
    hp: KINDS[kind].hp,
    t: 0,
    cool: 60 + randomInt(state, 60),
    flash: 0,
    ...fields,
  }
  state.enemies.push(e)
  return e
}

// One wave: a formation picked by the difficulty (0–100) and the leg.
function spawnWave(state) {
  const d = Math.min(100, Math.trunc((state.tick * 100) / BOSS_TICK))
  const zone = zoneAt(state.tick)
  const roll = randomInt(state, 100)
  state.waveCount += 1

  if (roll < 30) {
    // A V of drones diving from the top.
    const n = 3 + Math.trunc(d / 30)
    const cx = 60 + randomInt(state, W - 120)
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1
      const rank = Math.trunc((i + 1) / 2)
      addEnemy(state, 'drone', {
        x: (cx + side * rank * 26) * FP,
        y: (-20 - rank * 22) * FP,
        path: 'dive',
        vx: 0,
        vy: 32 + Math.trunc(d / 5),
        phase: randomInt(state, 256),
      })
    }
  } else if (roll < 50) {
    // A snake of drones weaving down.
    const n = 5 + Math.trunc(d / 25)
    const cx = 90 + randomInt(state, W - 180)
    const phase = randomInt(state, 256)
    for (let i = 0; i < n; i++) {
      addEnemy(state, 'drone', { x: cx * FP, y: (-20 - i * 24) * FP, path: 'weave', cx: cx * FP, vy: 28 + Math.trunc(d / 6), phase, vx: 0 })
    }
  } else if (roll < 68) {
    // Pirate planes crossing on a slant, firing at the jet.
    const n = 2 + Math.trunc(d / 40)
    const dir = randomInt(state, 2) ? 1 : -1
    for (let i = 0; i < n; i++) {
      addEnemy(state, 'avion', {
        x: (dir > 0 ? -20 : W + 20) * FP,
        y: (-20 - i * 40) * FP,
        path: 'cross',
        vx: dir * (26 + randomInt(state, 10)),
        vy: 38 + Math.trunc(d / 6),
        cool: 40 + i * 20,
      })
    }
  } else if (roll < 82) {
    // A smugglers' helicopter: comes down, hovers and fires, leaves.
    addEnemy(state, 'helico', {
      x: (60 + randomInt(state, W - 120)) * FP,
      y: -30 * FP,
      path: 'hover',
      stopY: (90 + randomInt(state, 120)) * FP,
      vx: 0,
      vy: 30,
      stay: 360 - Math.trunc(d * 1.2),
      cool: 50,
    })
    if (d > 50) {
      addEnemy(state, 'drone', { x: 40 * FP, y: -40 * FP, path: 'dive', vx: 0, vy: 34, phase: 0 })
      addEnemy(state, 'drone', { x: (W - 40) * FP, y: -40 * FP, path: 'dive', vx: 0, vy: 34, phase: 128 })
    }
  } else {
    // Ground targets: speedboats on the coast and the river, turrets in the mountains.
    const n = 1 + Math.trunc(d / 45)
    for (let i = 0; i < n; i++) {
      const kind = zone === 2 || (zone === 1 && randomInt(state, 3) === 0) ? 'tourelle' : 'vedette'
      addEnemy(state, kind, {
        x: (50 + randomInt(state, W - 100)) * FP,
        y: (-30 - i * 70) * FP,
        path: kind === 'vedette' ? 'boat' : 'ground',
        vx: kind === 'vedette' ? (randomInt(state, 2) ? 10 : -10) : 0,
        vy: SCROLL,
        cool: 70 + i * 25,
      })
    }
  }

  const gap = 150 - Math.trunc(d * 0.8) + randomInt(state, 50)
  state.nextWave = state.tick + gap
}

function spawnBoss(state) {
  state.bossSpawned = true
  addEnemy(state, 'boss', { x: (W / 2) * FP, y: -80 * FP, path: 'boss', vx: 10, vy: 12, cool: 90, stage: 0, pattern: 0 })
  state.events.push({ type: 'boss' })
}

// ── Firing ─────────────────────────────────────────────────────────────────
function enemyShot(state, x, y, angle, speed) {
  if (state.bullets.length >= MAX_BULLETS) return
  state.bullets.push({ x, y, vx: Math.trunc((icos(angle) * speed) / 1024), vy: Math.trunc((isin(angle) * speed) / 1024) })
}

function aimAt(state, e) {
  return iatan2(state.player.y - e.y, state.player.x - e.x)
}

function enemyFire(state, e, d) {
  const speed = 40 + Math.trunc(d / 4) // FP per tick
  if (e.kind === 'drone') return // drones ram, they don't shoot
  if (e.kind === 'avion') {
    enemyShot(state, e.x, e.y, aimAt(state, e), speed + 8)
    e.cool = 80 - Math.trunc(d / 3)
  } else if (e.kind === 'helico') {
    const a = aimAt(state, e)
    for (const da of [-10, 0, 10]) enemyShot(state, e.x, e.y + 10 * FP, a + da, speed)
    e.cool = 70 - Math.trunc(d / 4)
  } else if (e.kind === 'vedette') {
    enemyShot(state, e.x, e.y, aimAt(state, e), speed)
    e.cool = 90 - Math.trunc(d / 3)
  } else if (e.kind === 'tourelle') {
    const a = aimAt(state, e)
    for (const da of [-16, -5, 5, 16]) enemyShot(state, e.x, e.y, a + da, speed - 4)
    e.cool = 100 - Math.trunc(d / 3)
  } else if (e.kind === 'boss') {
    bossFire(state, e)
  }
}

// The Condor Noir's three stages (by health left): fans, spirals, then both
// with drone launches.
function bossFire(state, e) {
  const stage = e.hp > 1000 ? 0 : e.hp > 500 ? 1 : 2
  if (stage !== e.stage) {
    e.stage = stage
    state.events.push({ type: 'bossStage', stage })
  }
  e.pattern += 1
  const gunL = e.x - 34 * FP
  const gunR = e.x + 34 * FP
  const nose = e.y + 30 * FP
  if (stage === 0) {
    if (e.pattern % 2) {
      for (let a = 40; a <= 88; a += 8) enemyShot(state, e.x, nose, a, 44)
    } else {
      enemyShot(state, gunL, e.y, aimAt(state, e) - 4, 56)
      enemyShot(state, gunR, e.y, aimAt(state, e) + 4, 56)
    }
    e.cool = 55
  } else if (stage === 1) {
    for (let i = 0; i < 6; i++) enemyShot(state, e.x, nose, e.pattern * 11 + i * 43, 38)
    if (e.pattern % 4 === 0) {
      for (const da of [-6, 0, 6]) enemyShot(state, gunL, e.y, aimAt(state, e) + da, 58)
    }
    e.cool = 22
  } else {
    for (let i = 0; i < 8; i++) enemyShot(state, e.x, nose, e.pattern * 13 + i * 32, 40)
    if (e.pattern % 3 === 0) {
      for (const da of [-8, 0, 8]) {
        enemyShot(state, gunL, e.y, aimAt(state, e) + da, 60)
        enemyShot(state, gunR, e.y, aimAt(state, e) + da, 60)
      }
    }
    if (e.pattern % 10 === 0) {
      for (const side of [-1, 1]) {
        addEnemy(state, 'drone', { x: e.x + side * 60 * FP, y: e.y, path: 'dive', vx: side * 12, vy: 30, phase: 0, cool: 999 })
      }
    }
    e.cool = 26
  }
}

function playerFire(state) {
  const p = state.player
  const spec = JETS[state.jet]
  const y = p.y - 16 * FP
  const add = (dx, vx) => state.shots.push({ x: p.x + dx * FP, y, vx, vy: -160, dmg: spec.damage })
  add(-4, 0)
  add(4, 0)
  if (state.power >= 2) {
    add(-10, -14)
    add(10, 14)
  }
  if (state.power >= 3) {
    add(-14, -30)
    add(14, 30)
  }
  if (state.power >= 4) {
    add(-18, -48)
    add(18, 48)
  }
  p.cool = spec.fire
}

// ── Damage ─────────────────────────────────────────────────────────────────
function dropBonus(state, x, y, kind) {
  state.bonuses.push({ id: state.nextId++, kind, x, y, t: 0 })
}

function destroy(state, e, byBomb) {
  const kind = KINDS[e.kind]
  state.combo = state.comboTimer > 0 ? state.combo + 1 : 1
  state.comboTimer = COMBO_TICKS
  state.bestCombo = Math.max(state.bestCombo, state.combo)
  const multiplier = 1 + Math.min(4, Math.trunc(state.combo / 10))
  const points = kind.points * multiplier
  state.score += points
  state.kills[e.kind] += 1
  if (kind.crew) state.crews += 1
  e.dead = true
  state.events.push({ type: 'kill', kind: e.kind, x: e.x, y: e.y, points, multiplier, crew: !!kind.crew, byBomb })

  if (e.kind === 'boss') {
    state.bossDown = true
    state.victoryAt = state.tick + 150
    state.bullets = []
    for (let i = 0; i < 6; i++) dropBonus(state, e.x + (i - 3) * 20 * FP, e.y, 'ngori')
    return
  }
  // Drops: helicopters always, turrets often, the rest now and then.
  const roll = randomInt(state, 100)
  const chance = e.kind === 'helico' ? 100 : e.kind === 'tourelle' ? 60 : e.kind === 'avion' ? 18 : e.kind === 'vedette' ? 25 : 5
  if (roll < chance) {
    const pick = randomInt(state, 100)
    let bonus = 'ngori'
    if (state.power < MAX_POWER && pick < 45) bonus = 'power'
    else if (pick < 60) bonus = 'bomb'
    else if (pick < 72) bonus = 'repair'
    dropBonus(state, e.x, e.y, bonus)
  }
}

function hurtEnemy(state, e, dmg, byBomb = false) {
  if (e.dead) return
  e.hp -= dmg
  e.flash = 4
  if (e.hp <= 0) destroy(state, e, byBomb)
}

function hurtPlayer(state) {
  const p = state.player
  if (p.inv > 0 || state.bombing > 0 || state.bossDown) return
  state.hp -= 1
  state.hitsTaken += 1
  state.combo = 0
  state.comboTimer = 0
  if (state.power > 1) state.power -= 1
  p.inv = INVULNERABLE
  state.events.push({ type: 'hurt', x: p.x, y: p.y })
  if (state.hp <= 0) {
    state.over = true
    state.events.push({ type: 'down', x: p.x, y: p.y })
  }
}

function bomb(state) {
  if (state.bombs <= 0 || state.bombing > 0 || state.over) return
  state.bombs -= 1
  state.bombsUsed += 1
  state.bombing = BOMB_TICKS
  state.bullets = []
  state.events.push({ type: 'bomb', x: state.player.x, y: state.player.y })
  for (const e of state.enemies) {
    if (e.y > -20 * FP) hurtEnemy(state, e, e.kind === 'boss' ? 60 : 24, true)
  }
}

// ── The tick ───────────────────────────────────────────────────────────────
function moveEnemy(state, e) {
  e.t += 1
  if (e.path === 'dive') {
    e.x += e.vx
    e.y += e.vy
    if (e.t % 4 === 0 && e.y > 0 && e.y < state.player.y) {
      // drift toward the jet as it dives
      e.x += Math.sign(state.player.x - e.x) * 8
    }
  } else if (e.path === 'weave') {
    e.y += e.vy
    e.x = e.cx + Math.trunc((isin(e.phase + e.t * 2) * 70 * FP) / 1024)
  } else if (e.path === 'cross') {
    e.x += e.vx
    e.y += e.vy
  } else if (e.path === 'hover') {
    if (e.stay > 0 && e.y < e.stopY) e.y += e.vy
    else if (e.stay > 0) {
      e.stay -= 1
      e.x += Math.trunc((icos(e.t * 2) * 12) / 1024)
    } else e.y -= 26
  } else if (e.path === 'boat') {
    e.y += e.vy
    e.x += e.vx
    if (e.x < 30 * FP || e.x > (W - 30) * FP) e.vx = -e.vx
  } else if (e.path === 'ground') {
    e.y += e.vy
  } else if (e.path === 'boss') {
    if (e.y < 110 * FP) e.y += e.vy
    else {
      e.x += e.vx
      if (e.x < 80 * FP || e.x > (W - 80) * FP) e.vx = -e.vx
    }
  }
}

function offscreen(x, y, margin) {
  return x < -margin * FP || x > (W + margin) * FP || y < -240 * FP || y > (H + margin) * FP
}

export function step(state, actions = []) {
  if (state.over) return state
  state.events = []
  const p = state.player
  const spec = JETS[state.jet]

  for (const action of actions) {
    if (action[0] === 'B') bomb(state)
    else {
      p.tx = action[0] * FP
      p.ty = action[1] * FP
    }
  }

  // The jet flies toward its target point at its top speed.
  const max = spec.speed * FP
  const dx = p.tx - p.x
  const dy = p.ty - p.y
  p.x += Math.max(-max, Math.min(max, dx))
  p.y += Math.max(-max, Math.min(max, dy))
  p.x = Math.max(14 * FP, Math.min((W - 14) * FP, p.x))
  p.y = Math.max(40 * FP, Math.min((H - 20) * FP, p.y))
  if (p.inv > 0) p.inv -= 1
  if (state.bombing > 0) state.bombing -= 1
  if (state.comboTimer > 0) state.comboTimer -= 1
  else state.combo = 0

  // Auto fire (not once the sortie is won).
  if (p.cool > 0) p.cool -= 1
  else if (!state.bossDown) playerFire(state)

  // The jet's bullets.
  const shots = []
  for (const s of state.shots) {
    s.x += s.vx
    s.y += s.vy
    if (s.y < -10 * FP || s.x < -10 * FP || s.x > (W + 10) * FP) continue
    let hit = false
    for (const e of state.enemies) {
      if (e.dead || e.y < -10 * FP) continue
      const r = KINDS[e.kind].r * FP
      if (e.kind === 'boss') {
        // a wide flying wing: a flat box
        if (Math.abs(s.x - e.x) < 70 * FP && Math.abs(s.y - e.y) < 26 * FP) hit = true
      } else if (Math.abs(s.x - e.x) < r && Math.abs(s.y - e.y) < r) hit = true
      if (hit) {
        hurtEnemy(state, e, s.dmg)
        break
      }
    }
    if (!hit) shots.push(s)
  }
  state.shots = shots

  // Enemies.
  const d = Math.min(100, Math.trunc((state.tick * 100) / BOSS_TICK))
  const hb = spec.hitbox * FP
  for (const e of state.enemies) {
    if (e.dead) continue
    moveEnemy(state, e)
    if (e.flash > 0) e.flash -= 1
    if (e.y > 0 && e.y < (H - 40) * FP && e.cool-- <= 0 && !state.bossDown) enemyFire(state, e, d)
    // Ramming: only what flies (boats and turrets are below).
    if (!KINDS[e.kind].ground && e.kind !== 'boss') {
      const r = KINDS[e.kind].r * FP
      if (Math.abs(e.x - p.x) < r + hb && Math.abs(e.y - p.y) < r + hb && p.inv === 0 && state.bombing === 0) {
        hurtPlayer(state)
        hurtEnemy(state, e, 99)
      }
    }
  }
  state.enemies = state.enemies.filter((e) => !e.dead && !offscreen(e.x, e.y, 60))

  // Enemy bullets.
  const bullets = []
  for (const b of state.bullets) {
    b.x += b.vx
    b.y += b.vy
    if (offscreen(b.x, b.y, 10)) continue
    if (Math.abs(b.x - p.x) < hb + 3 * FP && Math.abs(b.y - p.y) < hb + 3 * FP && p.inv === 0) {
      hurtPlayer(state)
      continue
    }
    bullets.push(b)
  }
  state.bullets = bullets

  // Bonuses drift down; the jet picks them up by flying over them.
  const bonuses = []
  for (const b of state.bonuses) {
    b.t += 1
    b.y += 16
    b.x += Math.trunc((isin(b.t * 3) * 10) / 1024)
    if (b.y > (H + 20) * FP) continue
    if (Math.abs(b.x - p.x) < 20 * FP && Math.abs(b.y - p.y) < 20 * FP) {
      state.bonusesTaken += 1
      if (b.kind === 'power') state.power = Math.min(MAX_POWER, state.power + 1)
      else if (b.kind === 'bomb') state.bombs = Math.min(6, state.bombs + 1)
      else if (b.kind === 'repair') state.hp = Math.min(spec.hp, state.hp + 1)
      const points = BONUS_POINTS[b.kind] || 100
      state.score += points
      state.events.push({ type: 'bonus', kind: b.kind, x: b.x, y: b.y, points })
      continue
    }
    bonuses.push(b)
  }
  state.bonuses = bonuses

  // The sortie: waves until the Condor Noir, then the boss alone.
  if (!state.bossSpawned) {
    if (state.tick >= BOSS_TICK) {
      if (!state.enemies.length) spawnBoss(state)
    } else if (state.tick >= state.nextWave) {
      spawnWave(state)
    }
  }

  state.scroll += SCROLL
  state.tick += 1
  if (state.bossDown && state.tick >= state.victoryAt) {
    // Bonus for the jet's condition and the bombs kept.
    state.score += state.hp * 2000 + state.bombs * 1000
    state.won = true
    state.over = true
    state.events.push({ type: 'victory' })
  }
  if (state.tick >= MAX_TICKS) state.over = true
  return state
}

export function bossOf(state) {
  return state.enemies.find((e) => e.kind === 'boss') || null
}

export function starsFor(score) {
  return STAR_SCORES.filter((s) => score >= s).length
}

export function summarize(state) {
  return {
    score: state.score,
    won: state.won,
    completed: state.won,
    hp: Math.max(0, state.hp),
    kills: { ...state.kills },
    totalKills: Object.values(state.kills).reduce((a, b) => a + b, 0),
    crews: state.crews,
    bestCombo: state.bestCombo,
    bonuses: state.bonusesTaken,
    bombsUsed: state.bombsUsed,
    zone: zoneAt(state.tick),
    ticks: state.tick,
    stars: starsFor(state.score),
  }
}

// The jet's target point is sent at most every 2 ticks, plus the bombs.
export function validateInputs(inputs, endTick) {
  if (!Number.isInteger(endTick) || endTick < 1 || endTick > MAX_TICKS) return false
  if (!Array.isArray(inputs) || inputs.length > Math.ceil(endTick / 2) + 40) return false
  let last = 0
  for (const entry of inputs) {
    if (!Array.isArray(entry)) return false
    const [tick] = entry
    if (!Number.isInteger(tick) || tick < last || tick >= endTick) return false
    if (entry.length === 2) {
      if (entry[1] !== 'B') return false
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

// The gestures of a tick, as step() takes them: [x, y] or ['B'].
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
