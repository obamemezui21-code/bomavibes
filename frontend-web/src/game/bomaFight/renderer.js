// BOMA FIGHT's 2D canvas renderer: the stage photo, the floor, and the two
// fighters drawn as posed figures in their own colours and gear (see LOOKS).
// Purely visual — the fight itself is shared/boma-fight/engine.mjs.
import { ARENA, MOVES, FIGHTERS } from '../../../../shared/boma-fight/engine.mjs'

// How each fighter looks (portraits: assets/game/fight/<id>.webp).
//   skin, wrap: [main, stripe] cloth at the hips, top (women), gear on the
//   head, weapon in the front hand, size (1 = average build), glow (aura).
export const LOOKS = {
  nzeang: { skin: '#6b4429', wrap: ['#b8322a', '#1f4e9a'], head: 'mask', weapon: 'club', size: 1.12, beads: '#e8dcc0' },
  bikoulou: { skin: '#5a3a22', wrap: ['#1f8f4e', '#e2b33c'], top: '#1f8f4e', head: 'braids', size: 0.94, wraps: '#1f8f4e' },
  ondo: { skin: '#4b3020', wrap: ['#2457a6', '#f1f1f1'], robe: '#2457a6', head: 'cap', weapon: 'spear', size: 1 },
  amissa: { skin: '#5d3b23', wrap: ['#a87b45', '#6b4a28'], top: '#a87b45', head: 'bun', size: 0.96 },
  mebale: { skin: '#5a3820', wrap: ['#7a5a3a', '#3b2a1c'], head: 'shaved', weapon: 'shield', size: 1.08, tattoo: true },
  luku: { skin: '#4f3220', wrap: ['#7b5a3a', '#1b1b1b'], head: 'headband', weapon: 'machete', size: 1, beads: '#f1f1f1' },
  kassa: { skin: '#5a3922', wrap: ['#6d4c35', '#c0392b'], top: '#8a5a3a', head: 'crown', weapon: 'swords', size: 0.97, beads: '#2ecc71' },
  nzame: { skin: '#3d2a1e', wrap: ['#8a6e4b', '#5a4630'], head: 'headband', size: 1.04, glow: '#ffd34d', lines: '#4fc3ff' },
  obame: { skin: '#4e3220', wrap: ['#7d2f3a', '#2b3f8f'], head: 'shaved', weapon: 'gloves', gloves: '#c8a24a', size: 1.12, belt: '#d4af37' },
  sally: { skin: '#5a3a24', wrap: ['#2b8a3e', '#f2c230'], top: '#141414', head: 'bun', weapon: 'gloves', gloves: '#f3f3f3', size: 0.96 },
  biyogo: { skin: '#4a2f1f', wrap: ['#e2a23b', '#2f6db5'], head: 'short', weapon: 'gloves', gloves: '#1b1b1b', size: 0.92 },
  essono: { skin: '#4a3020', wrap: ['#6e5236', '#4a3826'], head: 'short', weapon: 'armor', armor: '#8a6a44', size: 1.08 },
}

const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (t) => Math.max(0, Math.min(1, t))
const ease = (t) => 1 - (1 - t) * (1 - t)

// Joint angles, in radians from straight down, positive = toward the opponent.
//   lean: torso; fa / ba: front / back arm [upper, forearm]; fl / bl: legs [thigh, shin].
const GUARD = { lean: 0.08, fa: [0.55, 2.5], ba: [0.25, 2.65], fl: [0.32, 0.1], bl: [-0.32, -0.12], drop: 0, lift: 0 }

function attackPose(f) {
  const m = MOVES[f.move]
  const startup = Math.max(2, m.startup - FIGHTERS[f.id].quick)
  const t = f.t
  // 0 → wind-up, 1 → fully out, then back to guard.
  const out = t < startup ? -0.35 * ease(t / startup) : t < startup + m.active ? 1 : 1 - ease((t - startup - m.active) / m.recovery)
  const k = Math.max(0, out)
  const wind = Math.min(0, out)
  if (f.move === 'punch') {
    return { ...GUARD, lean: 0.08 + 0.2 * k, fa: [lerp(0.55, 1.57, k) + wind, lerp(2.5, 1.57, k)], ba: [0.15, 2.7] }
  }
  if (f.move === 'kick') {
    return { ...GUARD, lean: 0.08 - 0.3 * k, fl: [lerp(0.32, 1.45, k) + wind, lerp(0.1, 1.6, k)], bl: [-0.15, -0.1], fa: [0.3, 2.2], ba: [-0.4, 1.8] }
  }
  // special: a lunge, both arms (and the weapon) thrown forward.
  return { ...GUARD, lean: 0.1 + 0.35 * k, fa: [lerp(0.55, 1.6, k) + wind, lerp(2.5, 1.6, k)], ba: [lerp(0.25, 1.45, k), lerp(2.65, 1.5, k)], fl: [0.6 * k + 0.3, 0.2], bl: [-0.6, -0.4] }
}

export function poseOf(f, time) {
  const breath = Math.sin(time * 3 + (f.id.length % 3)) * 0.03
  switch (f.state) {
    case 'walk': {
      const s = Math.sin(f.t * 0.25)
      return { ...GUARD, fl: [0.25 + s * 0.35, 0.05 + Math.max(0, s) * 0.3], bl: [-0.25 - s * 0.35, -0.1 + Math.max(0, -s) * 0.3], drop: Math.abs(s) * 2 }
    }
    case 'attack':
      return attackPose(f)
    case 'block':
      return { ...GUARD, lean: 0.02, fa: [0.95, 2.95], ba: [0.75, 3.0], drop: 4 }
    case 'hit':
      return { ...GUARD, lean: -0.4, fa: [-0.2, 0.6], ba: [-0.5, 0.3], fl: [0.45, 0.2], bl: [-0.15, -0.05], drop: 3 }
    case 'down':
    case 'ko':
      return { ...GUARD, lean: -0.15, fa: [-1.2, -1.4], ba: [-0.9, -1.2], fl: [0.15, 0.1], bl: [-0.1, 0], lying: true }
    case 'win':
      return { ...GUARD, lean: -0.05, fa: [0.4, 2.2], ba: [2.9, 3.05], fl: [0.18, 0.05], bl: [-0.18, -0.05] }
    default:
      return { ...GUARD, lean: GUARD.lean + breath, fa: [0.55 + breath, 2.5], drop: 2 + breath * 40 }
  }
}

// A point `len` away from (x, y) at `angle` (0 = down), facing `dir`.
const from = (x, y, angle, len, dir) => [x + Math.sin(angle) * len * dir, y + Math.cos(angle) * len]

const OUTLINE = '#1a0f0a'

// A limb (or any thick line) with a dark outline, cel-shaded style.
function limb(ctx, pts, width, color, outline = true) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const path = () => {
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1])
  }
  if (outline) {
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = width + Math.max(2, width * 0.22)
    path()
    ctx.stroke()
  }
  ctx.strokeStyle = color
  ctx.lineWidth = width
  path()
  ctx.stroke()
}

// A tapered limb: thick at the joint it starts from, thinner at its end.
function taper(ctx, a, b, w1, w2, color) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const shape = (grow) => {
    ctx.beginPath()
    ctx.moveTo(a[0] + nx * (w1 / 2 + grow), a[1] + ny * (w1 / 2 + grow))
    ctx.lineTo(b[0] + nx * (w2 / 2 + grow), b[1] + ny * (w2 / 2 + grow))
    ctx.arc(b[0], b[1], w2 / 2 + grow, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true)
    ctx.lineTo(a[0] - nx * (w1 / 2 + grow), a[1] - ny * (w1 / 2 + grow))
    ctx.arc(a[0], a[1], w1 / 2 + grow, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, true)
    ctx.closePath()
  }
  ctx.fillStyle = OUTLINE
  shape(Math.max(1.2, w1 * 0.12))
  ctx.fill()
  ctx.fillStyle = color
  shape(0)
  ctx.fill()
}

function blob(ctx, x, y, rx, ry, color, outline = true) {
  if (outline) {
    ctx.fillStyle = OUTLINE
    ctx.beginPath()
    ctx.ellipse(x, y, rx + Math.max(1.2, rx * 0.12), ry + Math.max(1.2, ry * 0.12), 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const c = (v) => Math.max(0, Math.min(255, Math.round(v + amount)))
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`
}

function drawWeapon(ctx, look, hand, forearmAngle, dir, u, front) {
  const [hx, hy] = hand
  const a = forearmAngle
  if (look.weapon === 'club') {
    const tip = from(hx, hy, a + 0.25, u * 1.1, dir)
    taper(ctx, [hx, hy], tip, u * 0.12, u * 0.3, '#7a5532')
    blob(ctx, tip[0], tip[1], u * 0.2, u * 0.2, '#6b4a2b')
  } else if (look.weapon === 'spear') {
    const back = from(hx, hy, a + Math.PI, u * 0.95, dir)
    const tip = from(hx, hy, a, u * 1.55, dir)
    limb(ctx, [back, tip], u * 0.07, '#9a7444')
    const head = from(tip[0], tip[1], a, u * 0.35, dir)
    taper(ctx, tip, head, u * 0.16, u * 0.02, '#d7dee4')
  } else if (look.weapon === 'machete' || look.weapon === 'swords') {
    const grip = from(hx, hy, a, u * 0.16, dir)
    limb(ctx, [[hx, hy], grip], u * 0.11, '#3b2a1c')
    const tip = from(hx, hy, a + 0.05, look.weapon === 'machete' ? u * 1.0 : u * 0.95, dir)
    taper(ctx, grip, tip, look.weapon === 'machete' ? u * 0.2 : u * 0.12, u * 0.04, '#e3e9ed')
  }
  if (look.weapon === 'gloves') blob(ctx, hx, hy, u * 0.17, u * 0.17, look.gloves)
  else if (front || look.weapon !== 'swords') blob(ctx, hx, hy, u * 0.11, u * 0.11, look.skin)
}

function drawHead(ctx, look, x, y, u, dir) {
  const r = u * 0.3
  const hair = '#17110c'
  // Hair behind the head.
  if (look.head === 'bun' || look.head === 'braids') blob(ctx, x - dir * r * 0.3, y - r * 1.05, r * 0.45, r * 0.42, hair)
  blob(ctx, x, y, r * 0.86, r, look.skin)
  // Ear and jaw shading, away from the opponent.
  ctx.fillStyle = shade(look.skin, -25)
  ctx.beginPath()
  ctx.ellipse(x - dir * r * 0.35, y + r * 0.05, r * 0.16, r * 0.22, 0, 0, Math.PI * 2)
  ctx.fill()
  if (look.head === 'mask') {
    blob(ctx, x + dir * r * 0.18, y + r * 0.12, r * 0.72, r * 1.08, '#eadfc4')
    ctx.fillStyle = '#2a1d14'
    for (const ex of [-0.1, 0.48]) {
      ctx.beginPath()
      ctx.ellipse(x + dir * r * ex, y - r * 0.08, r * 0.18, r * 0.07, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#b8322a'
    ctx.fillRect(x + dir * r * 0.1 - r * 0.2, y + r * 0.55, r * 0.4, r * 0.08)
    limb(ctx, [[x - r * 0.75, y - r * 1.05], [x - r * 0.3, y - r * 1.6], [x + r * 0.3, y - r * 1.6], [x + r * 0.75, y - r * 1.05]], u * 0.06, '#3b2a1c')
    return
  }
  // Eye, brow and mouth on the side facing the opponent.
  ctx.fillStyle = '#f5efe6'
  ctx.beginPath()
  ctx.ellipse(x + dir * r * 0.45, y - r * 0.08, r * 0.14, r * 0.1, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1a120c'
  ctx.beginPath()
  ctx.arc(x + dir * r * 0.5, y - r * 0.08, r * 0.07, 0, Math.PI * 2)
  ctx.fill()
  limb(ctx, [[x + dir * r * 0.28, y - r * 0.3], [x + dir * r * 0.66, y - r * 0.22]], r * 0.09, hair, false)
  limb(ctx, [[x + dir * r * 0.45, y + r * 0.45], [x + dir * r * 0.7, y + r * 0.42]], r * 0.07, '#3a2016', false)
  if (look.head === 'cap') {
    ctx.fillStyle = '#eef2f7'
    ctx.beginPath()
    ctx.ellipse(x, y - r * 0.62, r * 0.9, r * 0.5, 0, Math.PI, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2457a6'
    ctx.fillRect(x - r * 0.9, y - r * 0.66, r * 1.8, r * 0.14)
  } else if (look.head === 'headband' || look.head === 'crown') {
    ctx.fillStyle = hair
    ctx.beginPath()
    ctx.ellipse(x, y - r * 0.5, r * 0.86, r * 0.55, 0, Math.PI, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = look.head === 'crown' ? '#d4af37' : look.glow ? '#ffd34d' : '#b8322a'
    ctx.fillRect(x - r * 0.86, y - r * 0.62, r * 1.72, r * 0.2)
    if (look.head === 'crown') blob(ctx, x, y - r * 0.72, r * 0.12, r * 0.12, '#e74c3c', false)
  } else if (look.head === 'bun' || look.head === 'braids' || look.head === 'short') {
    ctx.fillStyle = hair
    ctx.beginPath()
    ctx.ellipse(x, y - r * 0.45, r * 0.88, r * 0.6, 0, Math.PI, Math.PI * 2)
    ctx.fill()
  }
}

// One fighter, feet at (x, floor), `h` tall.
function drawFighter(ctx, f, x, floor, h, time, flash) {
  const look = LOOKS[f.id] || LOOKS.nzame
  const pose = poseOf(f, time)
  const dir = f.facing
  const u = (h / 3.3) * look.size // one "head-and-a-bit" unit
  const bulk = look.size // broader shoulders for the big ones
  ctx.save()
  // Struck: a white flash (where canvas filters exist).
  if (flash && 'filter' in ctx) ctx.filter = `brightness(${1 + flash * 1.6})`
  if (pose.lying) {
    // On the floor, head away from the opponent.
    const px = x
    const py = floor - u * 0.3
    ctx.translate(px, py)
    ctx.rotate(-dir * (Math.PI / 2) * Math.min(1, f.t / 12))
    ctx.translate(-px, -py)
  }
  const hipY = floor - u * 1.68 + (pose.drop || 0)
  const hip = [x, hipY]

  if (look.glow) {
    const g = ctx.createRadialGradient(x, hipY - u * 0.6, u * 0.3, x, hipY - u * 0.6, u * 2.3)
    g.addColorStop(0, `rgba(255, 211, 77, ${0.3 + Math.sin(time * 4) * 0.08})`)
    g.addColorStop(1, 'rgba(79, 195, 255, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, hipY - u * 0.6, u * 2.3, 0, Math.PI * 2)
    ctx.fill()
  }

  const neck = from(hip[0], hip[1], Math.PI - pose.lean, u * 1.3, dir)
  const sw = u * 0.42 * bulk // half shoulder width
  const shoulderF = [neck[0] + dir * sw * 0.55, neck[1] + u * 0.14]
  const shoulderB = [neck[0] - dir * sw * 0.55, neck[1] + u * 0.14]
  const leg = (angles) => {
    const knee = from(hip[0], hip[1], angles[0], u * 0.86, dir)
    return [hip, knee, from(knee[0], knee[1], angles[1], u * 0.84, dir)]
  }
  const arm = (shoulder, angles) => {
    const elbow = from(shoulder[0], shoulder[1], angles[0], u * 0.58, dir)
    return [shoulder, elbow, from(elbow[0], elbow[1], angles[1], u * 0.55, dir)]
  }
  const fl = leg(pose.fl)
  const bl = leg(pose.bl)
  const fa = arm(shoulderF, pose.fa)
  const ba = arm(shoulderB, pose.ba)
  const skin = look.skin
  const skinDark = shade(skin, -26)
  const armW = u * 0.3 * bulk
  const legW = u * 0.36 * bulk
  const foot = (l, color) => {
    const toe = [l[2][0] + dir * u * 0.22, l[2][1]]
    limb(ctx, [l[2], toe], u * 0.14, color)
  }

  // Back limbs first, in a darker tone.
  taper(ctx, ba[0], ba[1], armW, armW * 0.85, skinDark)
  taper(ctx, ba[1], ba[2], armW * 0.85, armW * 0.7, skinDark)
  if (look.weapon === 'swords' || look.weapon === 'gloves') drawWeapon(ctx, look, ba[2], pose.ba[1], dir, u, false)
  else blob(ctx, ba[2][0], ba[2][1], u * 0.11, u * 0.11, skinDark)
  taper(ctx, bl[0], bl[1], legW, legW * 0.8, skinDark)
  taper(ctx, bl[1], bl[2], legW * 0.8, legW * 0.55, skinDark)
  foot(bl, skinDark)
  if (look.wraps) taper(ctx, from(bl[2][0], bl[2][1], Math.PI, u * 0.28, dir), bl[2], legW * 0.6, legW * 0.6, look.wraps)
  if (look.armor) taper(ctx, from(bl[2][0], bl[2][1], Math.PI, u * 0.5, dir), bl[2], legW * 0.7, legW * 0.62, shade(look.armor, -20))

  // Torso: broad at the shoulders, narrower at the waist.
  const torso = (grow, color) => {
    ctx.fillStyle = color
    ctx.beginPath()
    // Sloping shoulders, a broad chest, then in to the waist (a V).
    const top = neck[1] - grow
    const chest = neck[1] + u * 0.45
    const waist = hip[0]
    ctx.moveTo(neck[0] - dir * (sw * 0.35 + grow), top)
    ctx.quadraticCurveTo(neck[0] - dir * (sw + grow), top, neck[0] - dir * (sw + grow), neck[1] + u * 0.25)
    ctx.quadraticCurveTo(neck[0] - dir * (sw * 0.95 + grow), chest, waist - dir * (u * 0.28 * bulk + grow), hip[1] + grow)
    ctx.lineTo(waist + dir * (u * 0.28 * bulk + grow), hip[1] + grow)
    ctx.quadraticCurveTo(neck[0] + dir * (sw * 0.95 + grow), chest, neck[0] + dir * (sw + grow), neck[1] + u * 0.25)
    ctx.quadraticCurveTo(neck[0] + dir * (sw + grow), top, neck[0] + dir * (sw * 0.35 + grow), top)
    ctx.closePath()
    ctx.fill()
  }
  torso(Math.max(1.5, u * 0.05), OUTLINE)
  torso(0, look.robe || skin)
  if (!look.robe && !look.armor) {
    // Chest and belly, lit from the front.
    ctx.fillStyle = shade(skin, 14)
    ctx.beginPath()
    ctx.ellipse(neck[0] + dir * sw * 0.25, neck[1] + u * 0.42, sw * 0.55, u * 0.22, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = shade(skin, -30)
    ctx.lineWidth = Math.max(1, u * 0.03)
    ctx.beginPath()
    ctx.moveTo(neck[0] + dir * sw * 0.05, neck[1] + u * 0.3)
    ctx.lineTo(hip[0] + dir * sw * 0.08, hip[1] - u * 0.2)
    ctx.stroke()
  }
  if (look.robe) {
    ctx.fillStyle = '#f1f1f1'
    ctx.fillRect(neck[0] - u * 0.06, neck[1] + u * 0.1, u * 0.12, hip[1] - neck[1])
  }
  if (look.armor) {
    ctx.save()
    torso(-u * 0.04, look.armor)
    ctx.strokeStyle = shade(look.armor, -45)
    ctx.lineWidth = Math.max(1, u * 0.045)
    for (let i = 1; i < 5; i++) {
      const yy = neck[1] + ((hip[1] - neck[1]) * i) / 5
      ctx.beginPath()
      ctx.moveTo(hip[0] - sw * 0.85, yy)
      ctx.lineTo(hip[0] + sw * 0.85, yy)
      ctx.stroke()
    }
    blob(ctx, shoulderF[0], shoulderF[1], u * 0.24, u * 0.18, look.armor)
    ctx.restore()
  }
  if (look.top) {
    ctx.fillStyle = look.top
    const ty = neck[1] + u * 0.22
    ctx.beginPath()
    ctx.ellipse(neck[0] + dir * sw * 0.1, ty + u * 0.18, sw * 0.85, u * 0.24, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  if (look.lines) {
    limb(ctx, [[neck[0], neck[1] + u * 0.25], [hip[0], hip[1] - u * 0.15]], u * 0.05, look.lines, false)
    limb(ctx, [[neck[0] - sw * 0.8, neck[1] + u * 0.2], [neck[0], neck[1] + u * 0.45], [neck[0] + sw * 0.8, neck[1] + u * 0.2]], u * 0.045, look.lines, false)
  }
  if (look.tattoo) {
    limb(ctx, [[neck[0] - dir * sw * 0.8, neck[1] + u * 0.15], [neck[0] - dir * sw * 0.2, neck[1] + u * 0.45]], u * 0.05, shade(skin, -45), false)
  }
  if (look.beads) {
    ctx.strokeStyle = look.beads
    ctx.lineWidth = u * 0.07
    ctx.beginPath()
    ctx.arc(neck[0], neck[1] + u * 0.05, u * 0.2, 0.25, Math.PI - 0.25)
    ctx.stroke()
  }

  // Cloth at the hips (a long robe for the elder).
  const clothLen = look.robe ? u * 1.45 : u * 0.62
  const flare = dir * Math.max(0, pose.fl[0] - 0.3) * u * 0.35
  const cloth = (grow, color) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(hip[0] - u * 0.34 * bulk - grow, hip[1] - u * 0.14 - grow)
    ctx.lineTo(hip[0] + u * 0.34 * bulk + grow, hip[1] - u * 0.14 - grow)
    ctx.lineTo(hip[0] + u * 0.4 * bulk + flare + grow, hip[1] + clothLen + grow)
    ctx.lineTo(hip[0] - u * 0.4 * bulk + grow * -1, hip[1] + clothLen + grow)
    ctx.closePath()
    ctx.fill()
  }
  cloth(Math.max(1.2, u * 0.04), OUTLINE)
  cloth(0, look.wrap[0])
  ctx.fillStyle = look.wrap[1]
  for (let i = 0; i < 3; i++) ctx.fillRect(hip[0] - u * 0.34 * bulk, hip[1] - u * 0.04 + i * clothLen * 0.3, u * 0.68 * bulk, Math.max(1.5, u * 0.06))
  if (look.belt) {
    blob(ctx, hip[0] + dir * u * 0.05, hip[1] - u * 0.1, u * 0.22, u * 0.13, look.belt)
  }

  taper(ctx, fl[0], fl[1], legW, legW * 0.8, skin)
  taper(ctx, fl[1], fl[2], legW * 0.8, legW * 0.55, skin)
  foot(fl, skin)
  if (look.wraps) taper(ctx, from(fl[2][0], fl[2][1], Math.PI, u * 0.28, dir), fl[2], legW * 0.6, legW * 0.6, look.wraps)
  if (look.armor) taper(ctx, from(fl[2][0], fl[2][1], Math.PI, u * 0.5, dir), fl[2], legW * 0.7, legW * 0.62, look.armor)

  // Neck and head.
  taper(ctx, [neck[0], neck[1] + u * 0.12], [neck[0] + dir * u * 0.04, neck[1] - u * 0.14], u * 0.24, u * 0.2, skin)
  drawHead(ctx, look, neck[0] + dir * u * 0.06, neck[1] - u * 0.36, u, dir)

  taper(ctx, fa[0], fa[1], armW, armW * 0.85, skin)
  taper(ctx, fa[1], fa[2], armW * 0.85, armW * 0.7, skin)
  if (look.weapon === 'shield') {
    const [hx, hy] = fa[2]
    blob(ctx, hx + dir * u * 0.08, hy, u * 0.34, u * 0.8, '#5b4330')
    ctx.fillStyle = '#e1d0aa'
    ctx.beginPath()
    ctx.ellipse(hx + dir * u * 0.08, hy, u * 0.1, u * 0.7, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#3b2a1c'
    for (let i = -2; i <= 2; i++) ctx.fillRect(hx + dir * u * 0.08 - u * 0.13, hy + i * u * 0.24, u * 0.26, u * 0.05)
  } else {
    drawWeapon(ctx, look, fa[2], pose.fa[1], dir, u, true)
  }

  ctx.restore()
}

// Drawn first, under both fighters.
function drawShadow(ctx, x, floor, h, size) {
  const u = (h / 3.3) * size
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)'
  ctx.beginPath()
  ctx.ellipse(x, floor + 2, u * 0.8, u * 0.14, 0, 0, Math.PI * 2)
  ctx.fill()
}

export function createFightRenderer(canvas, { stage }) {
  const ctx = canvas.getContext('2d')
  let W = 0
  let H = 0
  let dpr = 1
  let inset = 0 // room kept under the floor for the on-screen controls
  const bg = new Image()
  bg.src = stage
  const sparks = [] // { x, y, vx, vy, life, color }
  const popups = [] // { text, x, y, life, color, size }
  const flashes = [0, 0]
  let shake = 0

  // Arena units → screen x: the whole ring fits the width.
  const toX = (x) => (x / ARENA) * W
  const floorY = () => Math.min(H * 0.86, H - inset)
  const fighterH = () => Math.min(floorY() * 0.5, W * 0.32)

  return {
    resize(width, height, bottomInset = 0) {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = width
      H = height
      inset = bottomInset
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
    },
    // A blow landed: sparks where it hit, the struck fighter flashes.
    hit(e, target) {
      const x = toX(e.x)
      const y = floorY() - fighterH() * (e.move === 'kick' ? 0.45 : 0.68)
      const heavy = e.move === 'special'
      const n = heavy ? 26 : e.guarded ? 6 : 12
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const s = (heavy ? 7 : 4) * (0.4 + Math.random())
        sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, life: 1, color: e.guarded ? '#9ad7ff' : heavy ? '#ffd34d' : '#fff3c4' })
      }
      popups.push({ text: e.guarded ? 'GARDE' : `-${e.damage}`, x, y: y - 20, life: 1, color: e.guarded ? '#9ad7ff' : '#ffe066', size: heavy ? 34 : 24 })
      if (!e.guarded) flashes[target] = 0.7
      shake = heavy ? 14 : e.guarded ? 2 : 5
    },
    render(state, { alpha, prev, time }) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const sx = shake ? (Math.random() - 0.5) * shake : 0
      const sy = shake ? (Math.random() - 0.5) * shake : 0
      shake = Math.max(0, shake - 0.8)
      ctx.save()
      ctx.translate(sx, sy)

      // Stage photo, down to just behind the fighters' feet.
      const floor = floorY()
      const skyH = floor - Math.min(40, H * 0.05)
      if (bg.complete && bg.naturalWidth) {
        const scale = Math.max(W / bg.naturalWidth, skyH / bg.naturalHeight)
        const iw = bg.naturalWidth * scale
        const ih = bg.naturalHeight * scale
        ctx.drawImage(bg, (W - iw) / 2, skyH - ih, iw, ih)
      } else {
        const g = ctx.createLinearGradient(0, 0, 0, skyH)
        g.addColorStop(0, '#2a1650')
        g.addColorStop(1, '#e9805a')
        ctx.fillStyle = g
        ctx.fillRect(-20, -20, W + 40, skyH + 20)
      }
      const dim = ctx.createLinearGradient(0, skyH * 0.4, 0, skyH)
      dim.addColorStop(0, 'rgba(10, 5, 20, 0)')
      dim.addColorStop(1, 'rgba(10, 5, 20, 0.45)')
      ctx.fillStyle = dim
      ctx.fillRect(-20, 0, W + 40, skyH)

      // The stone terrace they fight on.
      const g = ctx.createLinearGradient(0, skyH, 0, H)
      g.addColorStop(0, '#8a6247')
      g.addColorStop(1, '#4a3022')
      ctx.fillStyle = g
      ctx.fillRect(-20, skyH, W + 40, H - skyH + 20)
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)'
      ctx.lineWidth = 1.5
      for (let i = -6; i <= 6; i++) {
        ctx.beginPath()
        ctx.moveTo(W / 2 + i * W * 0.09, skyH)
        ctx.lineTo(W / 2 + i * W * 0.2, H)
        ctx.stroke()
      }
      ctx.fillStyle = 'rgba(255, 220, 180, 0.12)'
      ctx.fillRect(-20, skyH, W + 40, 3)

      const h = fighterH()
      const order = state.fighters[0].state === 'attack' ? [1, 0] : [0, 1] // the attacker on top
      const xs = state.fighters.map((f, i) => toX(prev ? lerp(prev[i], f.x, alpha) : f.x))
      for (const [i, f] of state.fighters.entries()) drawShadow(ctx, xs[i], floor, h, (LOOKS[f.id] || LOOKS.nzame).size)
      for (const i of order) {
        drawFighter(ctx, state.fighters[i], xs[i], floor, h, time, flashes[i])
        flashes[i] = Math.max(0, flashes[i] - 0.08)
      }

      for (const s of sparks) {
        s.x += s.vx
        s.y += s.vy
        s.vy += 0.25
        s.life -= 0.04
        ctx.globalAlpha = clamp01(s.life)
        ctx.fillStyle = s.color
        ctx.fillRect(s.x - 2, s.y - 2, 4, 4)
      }
      for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) sparks.splice(i, 1)
      for (const p of popups) {
        p.y -= 1
        p.life -= 0.022
        ctx.globalAlpha = clamp01(p.life * 1.5)
        ctx.font = `900 ${p.size}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.lineWidth = 4
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'
        ctx.strokeText(p.text, p.x, p.y)
        ctx.fillStyle = p.color
        ctx.fillText(p.text, p.x, p.y)
      }
      for (let i = popups.length - 1; i >= 0; i--) if (popups[i].life <= 0) popups.splice(i, 1)
      ctx.globalAlpha = 1
      ctx.restore()
    },
    dispose() {
      sparks.length = 0
      popups.length = 0
    },
  }
}
