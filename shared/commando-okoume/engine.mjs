// COMMANDO OKOUMÉ — a Contra-style run-and-gun across Gabon, shared by the
// app and the server.
//
// Same contract as shared/moto-boma/engine.mjs: integers only, a seeded
// generator, and the browser records only the player's gestures (tick +
// action). The server replays them with the same seed and options to get the
// real outcome, so a score typed into the request is worthless.
//
// World units: 1/16 of a pixel of the 320×180 virtual screen (FP). y grows
// downwards; the ground's top is at y = 156 px. Floors are one-way surfaces:
// you land on them from above and jump through them from below.

export const TICK_RATE = 60
export const MAX_TICKS = 10 * 60 * TICK_RATE // a mission can't last more than 10 min
export const FP = 16
export const SCREEN_W = 320
export const SCREEN_H = 180
export const GROUND_Y = 156

// L / R: hold left / right, S: let go, U / u: aim up on / off,
// F / f: fire on / off, J: jump, P: special ability.
export const ACTIONS = ['L', 'R', 'S', 'U', 'u', 'F', 'f', 'J', 'P']

const GRAVITY = 6
const JUMP_SPEED = 108 // apex ≈ 60 px: every platform is within reach
const MAX_FALL = 112
const WALK = 28 // a jump covers ~60 px: the 40 px gaps leave a comfortable take-off window
const PLAYER_W = 12
const PLAYER_H = 24
const INVULN_TICKS = 90
const FALL_LIMIT = (SCREEN_H + 40) * FP
const CAMERA_LEAD = 120 // px between the screen's left edge and the player

export const CHARACTERS = {
  mboumba: {
    name: 'Sergent Mboumba',
    corps: 'Armée de terre',
    special: 'Charge commando',
    specialText: 'Roulade invincible vers l’avant.',
    cooldown: 300,
  },
  moussavou: {
    name: 'Adjudante Moussavou',
    corps: 'Gendarmerie nationale',
    special: 'Tir d’élite',
    specialText: '3 s de tirs perçants et doublés.',
    cooldown: 420,
  },
}
export const DEFAULT_CHARACTER = 'mboumba'

export const WEAPONS = {
  rifle: { name: 'Fusil', rate: 9, damage: 1 },
  triple: { name: 'Tir triple', rate: 13, damage: 1 },
  grenade: { name: 'Lance-grenades', rate: 26, damage: 4 },
}

// Points for each enemy put out of action.
const ENEMIES = {
  soldier: { w: 12, h: 24, hp: 2, score: 100 },
  runner: { w: 12, h: 22, hp: 1, score: 60 },
  sniper: { w: 12, h: 24, hp: 3, score: 150 },
  jeep: { w: 34, h: 20, hp: 10, score: 500 },
  drone: { w: 16, h: 10, hp: 2, score: 120 },
}

// Missions. floors: [x0, x1, y] (px, top of the surface); spawns: [x, type, y]
// (y = feet, or the flying height for drones); items: [x, y, kind] with
// kind T (tir triple), G (lance-grenades), M (trousse de soin), H (otage),
// I (ivoire saisi); boss: arena start x (the screen locks there).
const G = GROUND_Y
export const MISSIONS = {
  1: {
    id: 1,
    name: 'Port d’Owendo',
    place: 'Libreville',
    goal: 'Intercepter le conteneur d’ivoire',
    theme: 'port',
    length: 2880,
    floors: [
      [0, 620, G], [660, 1180, G], [1220, 1900, G], [1940, 2880, G],
      [300, 380, 120], [520, 640, 112], [820, 920, 118], [1060, 1170, 104],
      [1420, 1520, 116], [1640, 1760, 106], [2080, 2180, 118],
    ],
    spawns: [
      [360, 'soldier', G], [470, 'runner', G], [600, 'sniper', 112], [760, 'soldier', G],
      [880, 'runner', G], [905, 'soldier', 118], [1090, 'sniper', 104], [1150, 'runner', G],
      [1320, 'jeep', G], [1460, 'soldier', 116], [1560, 'runner', G], [1600, 'runner', G],
      [1720, 'sniper', 106], [1840, 'soldier', G], [2040, 'runner', G], [2150, 'soldier', 118],
      [2240, 'soldier', G], [2300, 'runner', G],
    ],
    items: [
      [340, 112, 'T'], [580, 104, 'H'], [1000, G - 8, 'H'], [1480, 108, 'M'], [1700, 98, 'H'], [2120, 110, 'G'],
    ],
    boss: { x: 2560, type: 'grutier', name: 'Le Grutier', hp: 70 },
  },
  2: {
    id: 2,
    name: 'Parc de la Lopé',
    place: 'Ogooué-Ivindo',
    goal: 'Protéger les éléphants des braconniers',
    theme: 'lope',
    length: 3200,
    floors: [
      [0, 540, G], [580, 1000, G], [1040, 1520, G], [1560, 2100, G], [2140, 3200, G],
      [220, 320, 122], [430, 520, 110], [700, 790, 116], [880, 990, 104], [1180, 1280, 118],
      [1380, 1490, 106], [1700, 1800, 116], [1880, 1990, 102], [2260, 2360, 118], [2440, 2540, 106],
    ],
    spawns: [
      [300, 'soldier', G], [380, 'runner', G], [500, 'sniper', 110], [650, 'soldier', G],
      [760, 'runner', G], [940, 'sniper', 104], [1100, 'jeep', G], [1230, 'soldier', 118],
      [1330, 'runner', G], [1440, 'sniper', 106], [1620, 'soldier', G], [1680, 'runner', G],
      [1760, 'soldier', 116], [1940, 'sniper', 102], [2050, 'jeep', G], [2300, 'soldier', 118],
      [2380, 'runner', G], [2480, 'sniper', 106], [2600, 'soldier', G], [2640, 'runner', G],
    ],
    items: [
      [260, 114, 'G'], [470, 102, 'I'], [740, 108, 'H'], [930, 96, 'I'], [1230, 110, 'M'],
      [1430, 98, 'H'], [1750, 108, 'T'], [1930, 94, 'I'], [2300, 110, 'H'], [2500, 98, 'M'],
    ],
    boss: { x: 2880, type: 'gorille', name: 'Le Gorille Blindé', hp: 90 },
  },
  3: {
    id: 3,
    name: 'Chutes de Kongou',
    place: 'Ivindo',
    goal: 'Démanteler la mine d’or illégale',
    theme: 'ivindo',
    length: 3360,
    floors: [
      [0, 460, G], [500, 860, G], [900, 1250, G], [1290, 1670, G], [1710, 2090, G], [2130, 3360, G],
      [180, 270, 120], [390, 470, 108], [600, 700, 116], [780, 880, 102], [980, 1080, 118],
      [1150, 1260, 104], [1380, 1470, 116], [1560, 1680, 100], [1800, 1890, 116], [1960, 2090, 102],
      [2240, 2340, 116], [2420, 2520, 104],
    ],
    spawns: [
      [260, 'soldier', G], [360, 'drone', 70], [440, 'sniper', 108], [580, 'runner', G],
      [680, 'soldier', 116], [760, 'drone', 64], [850, 'sniper', 102], [1000, 'jeep', G],
      [1120, 'drone', 72], [1220, 'sniper', 104], [1360, 'soldier', G], [1440, 'runner', G],
      [1520, 'drone', 60], [1640, 'sniper', 100], [1780, 'soldier', G], [1860, 'drone', 70],
      [2040, 'sniper', 102], [2200, 'jeep', G], [2320, 'soldier', 116], [2400, 'drone', 66],
      [2500, 'sniper', 104], [2640, 'runner', G], [2700, 'soldier', G],
    ],
    items: [
      [220, 112, 'T'], [430, 100, 'H'], [820, 94, 'H'], [1030, 110, 'M'], [1200, 96, 'G'],
      [1620, 92, 'H'], [1930, 108, 'M'], [2470, 96, 'H'],
    ],
    boss: { x: 3040, type: 'drague', name: 'La Drague', hp: 100 },
  },
}
export const MISSION_IDS = [1, 2, 3]

// Bosses: size, where they stand in the arena (px from the arena start),
// and their attack cycle.
const BOSSES = {
  grutier: { w: 56, h: 64, dx: 236, y: 40, attacks: ['drop', 'fan', 'drop', 'spray'], every: 100, contact: false, solid: false },
  gorille: { w: 44, h: 52, dx: 230, y: G - 52, attacks: ['fan', 'charge', 'fan', 'jump'], every: 110, contact: true, solid: true },
  drague: { w: 72, h: 48, dx: 228, y: G - 40, attacks: ['fan', 'drop', 'summon', 'spray'], every: 95, contact: false, solid: true },
}

export const SCORE = { hostage: 500, ivory: 300, boss: 5000, noHitBonus: 2000, timeBonusMax: 3000 }

// mulberry32, as in NGORI RUN and MOTO BOMA.
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

// sin() in 1/64 for a 32-step turn, for drones bobbing.
const WAVE = [0, 12, 24, 35, 45, 53, 59, 63, 64, 63, 59, 53, 45, 35, 24, 12, 0, -12, -24, -35, -45, -53, -59, -63, -64, -63, -59, -53, -45, -35, -24, -12]

/**
 * @param {number} seed
 * @param {number} missionId
 * @param {{ character?: string, maxHp?: number }} [options] - maxHp comes from the player's grade
 */
export function createGame(seed, missionId = 1, options = {}) {
  const mission = MISSIONS[missionId] || MISSIONS[1]
  const character = CHARACTERS[options.character] ? options.character : DEFAULT_CHARACTER
  const maxHp = Math.max(3, Math.min(8, Math.trunc(options.maxHp) || 4))
  const hostagesTotal = mission.items.filter((i) => i[2] === 'H').length
  return {
    rng: seed >>> 0,
    mission: mission.id,
    character,
    tick: 0,
    camX: 0,
    cameraLocked: false,
    player: {
      x: 24 * FP,
      y: G * FP,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: true,
      hp: maxHp,
      maxHp,
      invuln: 0,
      weapon: 'rifle',
      fireCooldown: 0,
      special: 0, // ticks left of the special in use
      specialCooldown: 0,
      safeX: 24 * FP,
      walkTick: 0,
    },
    input: { move: 0, up: false, fire: false },
    bullets: [], // player's: { id, x, y, vx, vy, dmg, pierce, grenade, hit: Set-less list }
    enemyShots: [], // { id, x, y, vx, vy, kind: 'bullet' | 'bomb' | 'crate' }
    enemies: [],
    items: mission.items.map(([x, y, kind], i) => ({ id: i + 1, x: x * FP, y: y * FP, kind, taken: false })),
    nextSpawn: 0,
    nextId: 1000,
    boss: null,
    bossDefeatedAt: 0,
    kills: 0,
    hits: 0,
    hostagesFreed: 0,
    hostagesTotal,
    ivory: 0,
    score: 0,
    events: [],
    over: false,
    completed: false,
  }
}

function floorsOf(state) {
  return MISSIONS[state.mission].floors
}

// The floor a body standing at (x px) with feet at y px is on, if any.
function floorAt(state, xPx, yPx) {
  for (const [x0, x1, y] of floorsOf(state)) {
    if (xPx >= x0 && xPx <= x1 && y === yPx) return [x0, x1, y]
  }
  return null
}

function overlaps(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

// Unit-ish vector (in FP per tick) of `speed` from (x0,y0) toward (x1,y1):
// scaled by the larger axis, so integers stay exact on both sides.
function aim(x0, y0, x1, y1, speed) {
  const dx = x1 - x0
  const dy = y1 - y0
  const m = Math.max(Math.abs(dx), Math.abs(dy), 1)
  return [Math.trunc((dx * speed) / m), Math.trunc((dy * speed) / m)]
}

function playerBox(p) {
  // x is the centre, y the feet.
  return [p.x - (PLAYER_W / 2) * FP, p.y - PLAYER_H * FP, PLAYER_W * FP, PLAYER_H * FP]
}

function enemyBox(e) {
  const d = ENEMIES[e.type]
  return [e.x - (d.w / 2) * FP, e.y - d.h * FP, d.w * FP, d.h * FP]
}

function bossBox(b) {
  return [b.x, b.y, b.w * FP, b.h * FP]
}

function hurtPlayer(state, source) {
  const p = state.player
  if (p.invuln > 0 || state.over) return
  p.hp -= 1
  p.invuln = INVULN_TICKS
  state.hits += 1
  state.events.push({ type: 'hurt', source })
  if (p.hp <= 0) {
    state.over = true
    state.events.push({ type: 'defeat' })
  }
}

function spawnEnemies(state) {
  const spawns = MISSIONS[state.mission].spawns
  const edge = state.camX + (SCREEN_W + 24) * FP
  while (state.nextSpawn < spawns.length && spawns[state.nextSpawn][0] * FP <= edge) {
    const [xPx, type, yPx] = spawns[state.nextSpawn++]
    const floor = type === 'drone' ? null : floorAt(state, xPx, yPx)
    state.enemies.push({
      id: state.nextId++,
      type,
      x: xPx * FP,
      y: yPx * FP,
      baseY: yPx * FP,
      hp: ENEMIES[type].hp,
      facing: -1,
      // Bounds of the floor it walks on.
      minX: floor ? floor[0] * FP : -Infinity,
      maxX: floor ? floor[1] * FP : Infinity,
      cooldown: 40 + randomInt(state, 60),
      phase: randomInt(state, 32),
      flash: 0,
    })
  }
}

function fire(state) {
  const p = state.player
  const weapon = WEAPONS[p.weapon]
  const elite = state.character === 'moussavou' && p.special > 0
  const dmg = weapon.damage * (elite ? 2 : 1)
  const speed = 72
  const up = state.input.up
  const moving = state.input.move !== 0
  let vx = p.facing * speed
  let vy = 0
  if (up && moving) {
    vx = p.facing * 52
    vy = -52
  } else if (up) {
    vx = 0
    vy = -speed
  }
  const mx = p.x + (up && !moving ? 0 : p.facing * 8 * FP)
  const my = p.y - (up && !moving ? 26 : 15) * FP
  const shoot = (bvx, bvy, extra = {}) =>
    state.bullets.push({ id: state.nextId++, x: mx, y: my, vx: bvx, vy: bvy, dmg, pierce: elite, hits: [], ...extra })

  if (p.weapon === 'triple') {
    shoot(vx, vy)
    // Spread: rotate the shot a little either way.
    shoot(vx + (vy === 0 ? 0 : 14 * p.facing), vy - 16 + (vy === 0 ? 0 : 6))
    shoot(vx - (vy === 0 ? 0 : 14 * p.facing), vy + 16 - (vy === 0 ? 0 : 6))
  } else if (p.weapon === 'grenade') {
    shoot(p.facing * 40, up ? -96 : -56, { grenade: true, dmg: weapon.damage * (elite ? 2 : 1) })
  } else {
    shoot(vx, vy)
  }
  p.fireCooldown = weapon.rate
  state.events.push({ type: 'shot', weapon: p.weapon })
}

function useSpecial(state) {
  const p = state.player
  if (p.specialCooldown > 0 || p.special > 0) return
  const c = CHARACTERS[state.character]
  if (state.character === 'mboumba') {
    p.special = 36 // roll
    p.invuln = Math.max(p.invuln, 40)
  } else {
    p.special = 180 // elite shots
  }
  p.specialCooldown = c.cooldown
  state.events.push({ type: 'special', character: state.character })
}

function stepPlayer(state, actions) {
  const p = state.player
  const inp = state.input
  let jump = false
  for (const a of actions) {
    if (a === 'L') inp.move = -1
    else if (a === 'R') inp.move = 1
    else if (a === 'S') inp.move = 0
    else if (a === 'U') inp.up = true
    else if (a === 'u') inp.up = false
    else if (a === 'F') inp.fire = true
    else if (a === 'f') inp.fire = false
    else if (a === 'J') jump = true
    else if (a === 'P') useSpecial(state)
  }

  const rolling = state.character === 'mboumba' && p.special > 0
  if (inp.move !== 0) p.facing = inp.move
  p.vx = rolling ? p.facing * 56 : inp.move * WALK
  if (inp.move !== 0 || rolling) p.walkTick += 1

  if (jump && p.onGround) {
    p.vy = -JUMP_SPEED
    p.onGround = false
    state.events.push({ type: 'jump' })
  }

  // Horizontal: never behind the screen's left edge, never past the boss.
  const prevY = p.y
  p.x += p.vx
  const left = state.camX + 6 * FP
  // (A boss up in the air, like the crane, can be walked under.)
  const b = state.boss
  const right = !b
    ? (MISSIONS[state.mission].length - 6) * FP
    : BOSSES[b.type].solid
      ? b.x - 4 * FP
      : state.camX + (SCREEN_W - 6) * FP
  if (p.x < left) p.x = left
  if (p.x > right) p.x = right

  // Vertical, landing on one-way floors.
  p.vy = Math.min(p.vy + GRAVITY, MAX_FALL)
  p.y += p.vy
  p.onGround = false
  if (p.vy >= 0) {
    const xPx = Math.trunc(p.x / FP)
    for (const [x0, x1, y] of floorsOf(state)) {
      const top = y * FP
      if (xPx + 4 >= x0 && xPx - 4 <= x1 && prevY <= top && p.y >= top) {
        p.y = top
        p.vy = 0
        p.onGround = true
        if (y === GROUND_Y) p.safeX = p.x
        break
      }
    }
  }

  // Fell into a gap: lose a heart, back on the last solid ground.
  if (p.y > FALL_LIMIT) {
    state.events.push({ type: 'fall' })
    p.invuln = 0
    hurtPlayer(state, 'fall')
    p.x = Math.max(p.safeX - 24 * FP, state.camX + 16 * FP)
    p.y = GROUND_Y * FP
    p.vy = 0
    // Make sure it stands on something.
    const xPx = Math.trunc(p.x / FP)
    if (!floorAt(state, xPx, GROUND_Y)) {
      const back = floorsOf(state).filter(([x0, , y]) => y === GROUND_Y && x0 * FP <= p.x).pop()
      if (back) p.x = Math.min(p.x, back[1] * FP - 8 * FP)
    }
  }

  if (p.invuln > 0) p.invuln -= 1
  if (p.special > 0) p.special -= 1
  if (p.specialCooldown > 0) p.specialCooldown -= 1
  if (p.fireCooldown > 0) p.fireCooldown -= 1
  if (inp.fire && p.fireCooldown === 0 && !rolling) fire(state)
}

function stepCamera(state) {
  const p = state.player
  const mission = MISSIONS[state.mission]
  if (state.boss) return
  const target = p.x - CAMERA_LEAD * FP
  if (target > state.camX) state.camX = target
  const arena = mission.boss.x * FP
  if (state.camX >= arena) {
    state.camX = arena
    startBoss(state)
  }
}

function startBoss(state) {
  const mission = MISSIONS[state.mission]
  const kind = BOSSES[mission.boss.type]
  state.cameraLocked = true
  state.boss = {
    type: mission.boss.type,
    name: mission.boss.name,
    x: (mission.boss.x + kind.dx) * FP,
    y: kind.y * FP,
    homeX: (mission.boss.x + kind.dx) * FP,
    w: kind.w,
    h: kind.h,
    hp: mission.boss.hp,
    maxHp: mission.boss.hp,
    timer: 90,
    attack: 0,
    action: null, // { kind, t, … }
    flash: 0,
  }
  // Whatever is left of the level clears out for the duel.
  state.enemies = state.enemies.filter((e) => e.type === 'drone')
  state.events.push({ type: 'boss', name: mission.boss.name })
}

function enemyShot(state, x, y, vx, vy, kind = 'bullet') {
  state.enemyShots.push({ id: state.nextId++, x, y, vx, vy, kind })
}

function stepEnemies(state) {
  const p = state.player
  for (const e of state.enemies) {
    if (e.flash > 0) e.flash -= 1
    e.facing = p.x < e.x ? -1 : 1
    const dx = p.x - e.x
    const near = Math.abs(dx) < 200 * FP
    if (e.type === 'soldier') {
      if (Math.abs(dx) > 110 * FP) e.x += e.facing * 6
      e.x = Math.max(e.minX, Math.min(e.maxX, e.x))
      if (--e.cooldown <= 0 && near) {
        const my = e.y - 15 * FP
        if (Math.abs(p.y - e.y) < 20 * FP) enemyShot(state, e.x + e.facing * 6 * FP, my, e.facing * 36, 0)
        else {
          const [vx, vy] = aim(e.x, my, p.x, p.y - 12 * FP, 32)
          enemyShot(state, e.x, my, vx, vy)
        }
        e.cooldown = 90 + randomInt(state, 40)
      }
    } else if (e.type === 'runner') {
      e.x += e.facing * 22
      e.x = Math.max(e.minX, Math.min(e.maxX, e.x))
    } else if (e.type === 'sniper') {
      if (--e.cooldown <= 0 && near) {
        const my = e.y - 18 * FP
        const [vx, vy] = aim(e.x, my, p.x, p.y - 12 * FP, 40)
        enemyShot(state, e.x, my, vx, vy)
        e.cooldown = 110 + randomInt(state, 40)
      }
    } else if (e.type === 'jeep') {
      if (--e.cooldown <= 0 && near) {
        enemyShot(state, e.x - 18 * FP, e.y - 14 * FP, -40, 0)
        e.cooldown = 45 + randomInt(state, 20)
      }
    } else if (e.type === 'drone') {
      e.phase = (e.phase + 1) % 128
      e.x -= 8
      e.y = e.baseY + WAVE[e.phase >> 2] * 4
      if (--e.cooldown <= 0 && Math.abs(dx) < 10 * FP) {
        enemyShot(state, e.x, e.y + 4 * FP, 0, 34, 'bomb')
        e.cooldown = 70
      }
    }
    // Touching an enemy hurts.
    const [ex, ey, ew, eh] = enemyBox(e)
    const [px, py, pw, ph] = playerBox(p)
    if (overlaps(px, py, pw, ph, ex, ey, ew, eh)) {
      if (state.character === 'mboumba' && p.special > 0) e.hp = 0 // the commando roll knocks them down
      else hurtPlayer(state, e.type)
    }
  }
  // Gone off the left of the screen.
  state.enemies = state.enemies.filter((e) => e.hp > 0 && e.x > state.camX - 40 * FP)
}

function stepBoss(state) {
  const b = state.boss
  if (!b || b.hp <= 0) return
  const kind = BOSSES[b.type]
  const p = state.player
  if (b.flash > 0) b.flash -= 1
  const cx = b.x + (b.w / 2) * FP
  const cy = b.y + (b.h / 2) * FP
  const a = b.action

  if (a) {
    a.t += 1
    if (a.kind === 'drop') {
      // A shadow marks the spot for 40 ticks, then something falls on it.
      if (a.t === 40) enemyShot(state, a.x, -8 * FP, 0, 44, 'crate')
      if (a.t >= 50) b.action = null
    } else if (a.kind === 'fan') {
      if (a.t % 12 === 1) {
        const [vx, vy] = aim(cx, cy, p.x, p.y - 12 * FP, 36)
        enemyShot(state, cx, cy, vx, vy)
        enemyShot(state, cx, cy, vx, vy - 12)
        enemyShot(state, cx, cy, vx, vy + 12)
      }
      if (a.t >= 36) b.action = null
    } else if (a.kind === 'spray') {
      if (a.t % 6 === 1) enemyShot(state, cx, cy, -44, -36 + (a.t % 36) * 2)
      if (a.t >= 48) b.action = null
    } else if (a.kind === 'charge') {
      if (a.t > 20) b.x += a.dir * 48
      const minX = state.camX + 8 * FP
      if (b.x <= minX || a.t > 80) {
        b.x = Math.max(b.x, minX)
        a.kind = 'return'
      }
    } else if (a.kind === 'return') {
      b.x = Math.min(b.homeX, b.x + 24)
      if (b.x >= b.homeX) b.action = null
    } else if (a.kind === 'jump') {
      // Leaps up and crashes down, sending shockwaves both ways.
      const h = a.t < 30 ? a.t : 60 - a.t
      b.y = kind.y * FP - h * 3 * FP
      if (a.t === 60) {
        b.y = kind.y * FP
        enemyShot(state, b.x, (GROUND_Y - 6) * FP, -40, 0, 'wave')
        enemyShot(state, b.x + b.w * FP, (GROUND_Y - 6) * FP, 40, 0, 'wave')
        b.action = null
      }
    } else if (a.kind === 'summon') {
      if (a.t === 20 || a.t === 40) {
        state.enemies.push({
          id: state.nextId++, type: 'drone', x: b.x, y: 60 * FP, baseY: (56 + randomInt(state, 20)) * FP,
          hp: 2, facing: -1, minX: -Infinity, maxX: Infinity, cooldown: 30, phase: randomInt(state, 32), flash: 0,
        })
      }
      if (a.t >= 50) b.action = null
    }
  } else if (--b.timer <= 0) {
    const next = kind.attacks[b.attack % kind.attacks.length]
    b.attack += 1
    b.timer = kind.every - Math.min(40, Math.trunc((b.maxHp - b.hp) / 3)) // faster when hurt
    b.action = { kind: next, t: 0, x: p.x, dir: -1 }
    state.events.push({ type: 'bossAttack', attack: next })
  }

  if (kind.contact) {
    const [bx, by, bw, bh] = bossBox(b)
    const [px, py, pw, ph] = playerBox(p)
    if (overlaps(px, py, pw, ph, bx, by, bw, bh)) hurtPlayer(state, 'boss')
  }
}

function damageEnemy(state, e, dmg) {
  e.hp -= dmg
  e.flash = 6
  if (e.hp <= 0) {
    state.kills += 1
    state.score += ENEMIES[e.type].score
    state.events.push({ type: 'kill', enemy: e.type, x: e.x, y: e.y })
  } else {
    state.events.push({ type: 'hit' })
  }
}

function damageBoss(state, dmg) {
  const b = state.boss
  if (!b || b.hp <= 0) return
  b.hp -= dmg
  b.flash = 4
  if (b.hp <= 0) {
    b.hp = 0
    state.score += SCORE.boss
    state.bossDefeatedAt = state.tick
    state.enemyShots = []
    state.enemies = []
    state.events.push({ type: 'bossDown', name: b.name })
  } else {
    state.events.push({ type: 'hit' })
  }
}

function explode(state, x, y, dmg) {
  const r = 22 * FP
  for (const e of state.enemies) {
    if (e.hp > 0 && Math.abs(e.x - x) < r && Math.abs(e.y - 10 * FP - y) < r) damageEnemy(state, e, dmg)
  }
  const b = state.boss
  if (b && b.hp > 0) {
    const [bx, by, bw, bh] = bossBox(b)
    if (overlaps(x - r, y - r, 2 * r, 2 * r, bx, by, bw, bh)) damageBoss(state, dmg)
  }
  state.events.push({ type: 'explosion', x, y })
}

function stepBullets(state) {
  const minX = state.camX - 16 * FP
  const maxX = state.camX + (SCREEN_W + 16) * FP
  for (const s of state.bullets) {
    s.x += s.vx
    s.y += s.vy
    if (s.grenade) {
      s.vy += 4
      if (s.y >= GROUND_Y * FP) {
        explode(state, s.x, s.y, s.dmg)
        s.dead = true
        continue
      }
    }
    if (s.x < minX || s.x > maxX || s.y < -16 * FP || s.y > SCREEN_H * FP) {
      s.dead = true
      continue
    }
    for (const e of state.enemies) {
      if (e.hp <= 0 || s.hits.includes(e.id)) continue
      const [ex, ey, ew, eh] = enemyBox(e)
      if (s.x >= ex && s.x <= ex + ew && s.y >= ey && s.y <= ey + eh) {
        if (s.grenade) {
          explode(state, s.x, s.y, s.dmg)
          s.dead = true
          break
        }
        damageEnemy(state, e, s.dmg)
        s.hits.push(e.id)
        if (!s.pierce) {
          s.dead = true
          break
        }
      }
    }
    const b = state.boss
    if (!s.dead && b && b.hp > 0 && !s.hits.includes('boss')) {
      const [bx, by, bw, bh] = bossBox(b)
      if (s.x >= bx && s.x <= bx + bw && s.y >= by && s.y <= by + bh) {
        if (s.grenade) explode(state, s.x, s.y, s.dmg)
        else damageBoss(state, s.dmg)
        s.hits.push('boss')
        s.dead = true
      }
    }
  }
  state.bullets = state.bullets.filter((s) => !s.dead)

  const p = state.player
  const [px, py, pw, ph] = playerBox(p)
  for (const s of state.enemyShots) {
    s.x += s.vx
    s.y += s.vy
    if (s.kind === 'crate' && s.y >= (GROUND_Y - 12) * FP) {
      s.dead = true
      state.events.push({ type: 'explosion', x: s.x, y: s.y })
    }
    const size = s.kind === 'crate' ? 12 : s.kind === 'wave' ? 8 : 3
    if (overlaps(px, py, pw, ph, s.x - size * FP, s.y - size * FP, 2 * size * FP, 2 * size * FP)) {
      hurtPlayer(state, s.kind)
      s.dead = true
    }
    if (s.x < minX || s.x > maxX || s.y > SCREEN_H * FP || s.y < -40 * FP) s.dead = true
  }
  state.enemyShots = state.enemyShots.filter((s) => !s.dead)
}

function stepItems(state) {
  const p = state.player
  const [px, py, pw, ph] = playerBox(p)
  for (const it of state.items) {
    if (it.taken) continue
    if (!overlaps(px, py, pw, ph, it.x - 8 * FP, it.y - 8 * FP, 16 * FP, 16 * FP)) continue
    it.taken = true
    if (it.kind === 'T') p.weapon = 'triple'
    else if (it.kind === 'G') p.weapon = 'grenade'
    else if (it.kind === 'M') p.hp = Math.min(p.maxHp, p.hp + 1)
    else if (it.kind === 'H') {
      state.hostagesFreed += 1
      state.score += SCORE.hostage
    } else if (it.kind === 'I') {
      state.ivory += 1
      state.score += SCORE.ivory
    }
    state.events.push({ type: 'item', kind: it.kind })
  }
}

export function step(state, actions = []) {
  if (state.over) return state
  state.events = []
  state.tick += 1

  stepPlayer(state, actions)
  if (state.over) return state
  stepCamera(state)
  if (!state.boss) spawnEnemies(state)
  stepEnemies(state)
  stepBoss(state)
  stepBullets(state)
  stepItems(state)

  if (state.bossDefeatedAt && state.tick - state.bossDefeatedAt >= 90 && !state.over) {
    state.over = true
    state.completed = true
    if (state.hits === 0) state.score += SCORE.noHitBonus
    state.score += Math.max(0, SCORE.timeBonusMax - Math.trunc(state.tick / TICK_RATE) * 10)
    state.events.push({ type: 'victory' })
  } else if (state.tick >= MAX_TICKS) {
    state.over = true
  }
  return state
}

// 1 star for the mission, 1 for freeing every hostage, 1 for taking at most one hit.
export function starsFor(state) {
  if (!state.completed) return 0
  return 1 + (state.hostagesFreed === state.hostagesTotal ? 1 : 0) + (state.hits <= 1 ? 1 : 0)
}

export function summarize(state) {
  return {
    mission: state.mission,
    character: state.character,
    ticks: state.tick,
    completed: state.completed,
    stars: starsFor(state),
    score: state.score,
    kills: state.kills,
    hits: state.hits,
    hostagesFreed: state.hostagesFreed,
    hostagesTotal: state.hostagesTotal,
    ivory: state.ivory,
  }
}

// [[tick, action], …] sorted by tick, every tick before `endTick`.
export function validateInputs(inputs, endTick) {
  if (!Number.isInteger(endTick) || endTick < 1 || endTick > MAX_TICKS) return false
  if (!Array.isArray(inputs) || inputs.length > Math.ceil(endTick / 3) + 60) return false
  let last = 0
  for (const entry of inputs) {
    if (!Array.isArray(entry) || entry.length !== 2) return false
    const [tick, action] = entry
    if (!Number.isInteger(tick) || tick < last || tick >= endTick || !ACTIONS.includes(action)) return false
    last = tick
  }
  return true
}

export function simulateGame(seed, missionId, options, inputs, endTick) {
  const state = createGame(seed, missionId, options)
  let i = 0
  while (!state.over && state.tick < endTick) {
    const actions = []
    while (i < inputs.length && inputs[i][0] === state.tick) actions.push(inputs[i++][1])
    step(state, actions)
  }
  return summarize(state)
}

// ---- Progression (grades) -------------------------------------------------
// XP comes from missions (server-side); the grade sets the hearts and unlocks.
export const GRADES = [
  { name: 'Soldat', xp: 0 },
  { name: 'Caporal', xp: 300 },
  { name: 'Sergent', xp: 800 },
  { name: 'Adjudant', xp: 1600 },
  { name: 'Lieutenant', xp: 3000 },
  { name: 'Capitaine', xp: 5000 },
  { name: 'Commandant', xp: 8000 },
  { name: 'Colonel', xp: 12000 },
]

export function gradeFor(xp = 0) {
  let index = 0
  for (let i = 0; i < GRADES.length; i++) if (xp >= GRADES[i].xp) index = i
  const next = GRADES[index + 1] || null
  return {
    index,
    name: GRADES[index].name,
    xp,
    nextName: next?.name || null,
    nextXp: next?.xp || null,
    // Hearts: 4 for a soldier, +1 every two grades (7 for a colonel).
    maxHp: 4 + Math.trunc(index / 2),
    // Moussavou joins the unit at Caporal.
    characters: index >= 1 ? ['mboumba', 'moussavou'] : ['mboumba'],
  }
}

// XP for one mission run.
export function xpFor(result) {
  return Math.trunc(result.score / 50) + (result.completed ? 100 + result.stars * 50 : 0)
}
