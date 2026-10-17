// COMMANDO OKOUMÉ bosses, drawn in the same style as the sprites: thin dark
// outlines, light on top, shadow underneath, mechanical detail and a little
// animation. Each boss is painted on its own small canvas so a hit can
// flash it white without touching the rest of the scene.
import { FP, GROUND_Y, SCREEN_W } from '../../../../shared/commando-okoume/engine.mjs'
import { shade } from './sprites.js'

const OUTLINE = '#15140f'
const PAD = 40 // room around the boss for arms, barrels, smoke…

function helpers(g) {
  const fill = (x, y, w, h, c) => {
    g.fillStyle = c
    g.fillRect(x, y, w, h)
  }
  // An armour plate / panel: outline, fill, light on top, shadow under and on the right.
  const plate = (x, y, w, h, c) => {
    fill(x - 0.5, y - 0.5, w + 1, h + 1, OUTLINE)
    fill(x, y, w, h, c)
    fill(x, y, w, 0.5, shade(c, 0.3))
    fill(x, y, 0.5, h, shade(c, 0.15))
    fill(x, y + h - 0.5, w, 0.5, shade(c, -0.35))
    fill(x + w - 0.5, y, 0.5, h, shade(c, -0.25))
  }
  const disc = (x, y, radius, c, outline = true) => {
    if (outline) {
      g.fillStyle = OUTLINE
      g.beginPath()
      g.arc(x, y, radius + 0.5, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = c
    g.beginPath()
    g.arc(x, y, radius, 0, Math.PI * 2)
    g.fill()
  }
  const glow = (x, y, radius, rgb, alpha) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, radius)
    grad.addColorStop(0, `rgba(${rgb},${alpha})`)
    grad.addColorStop(1, `rgba(${rgb},0)`)
    g.fillStyle = grad
    g.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  const line = (x0, y0, x1, y1, c, width = 0.5) => {
    g.strokeStyle = c
    g.lineWidth = width
    g.beginPath()
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
    g.stroke()
  }
  const rivets = (x, y, w, step, c = '#00000066') => {
    for (let i = 1; i < w; i += step) fill(x + i, y, 0.5, 0.5, c)
  }
  return { fill, plate, disc, glow, line, rivets }
}

// Barrel pointing from (x, y) at the player, clamped to the half-space in front.
function aimAngle(fromX, fromY, toX, toY, minA, maxA) {
  const a = Math.atan2(toY - fromY, toX - fromX)
  return Math.max(minA, Math.min(maxA, a))
}

function drawGrutier(g, b, time, aim) {
  const { fill, plate, disc, glow, line, rivets } = helpers(g)
  // Trolley on the rail, cables down to the cab.
  plate(14, -8, 28, 6, '#3d4a55')
  for (const wx of [18, 26, 30, 38]) disc(wx, -9, 2, '#22282e')
  line(20, -2, 18, 0, '#1a1a1a', 0.8)
  line(36, -2, 38, 0, '#1a1a1a', 0.8)
  // Cab.
  plate(0, 0, 56, 38, '#e8b923')
  plate(2, 1, 52, 3, '#c99a12') // roof edge
  rivets(1, 5, 54, 4)
  // Windows with the sky reflected and an operator inside.
  plate(4, 7, 48, 17, '#1b2631')
  const glass = g.createLinearGradient(0, 8, 0, 23)
  glass.addColorStop(0, '#a9cce3')
  glass.addColorStop(1, '#4a6a85')
  g.fillStyle = glass
  g.fillRect(5, 8, 21, 15)
  g.fillRect(30, 8, 21, 15)
  fill(10, 13, 6, 10, '#2a1b12') // operator
  fill(9, 12, 8, 2, '#56672c') // cap
  fill(13, 19, 6, 4, '#3d4a55') // controls
  for (const wx of [7, 33]) line(wx, 22, wx + 9, 9, 'rgba(255,255,255,0.45)', 1)
  fill(26, 8, 4, 15, '#1b2631')
  // Hazard stripes.
  plate(0, 32, 56, 6, '#e8b923')
  g.save()
  g.beginPath()
  g.rect(0, 32, 56, 6)
  g.clip()
  g.fillStyle = OUTLINE
  for (let s = -6; s < 60; s += 6) {
    g.beginPath()
    g.moveTo(s, 38)
    g.lineTo(s + 3, 38)
    g.lineTo(s + 9, 32)
    g.lineTo(s + 6, 32)
    g.closePath()
    g.fill()
  }
  g.restore()
  // Machinery under the cab, with vents.
  plate(8, 38, 40, 16, '#5d6d7e')
  for (let v = 41; v < 52; v += 2.5) fill(12, v, 18, 0.5, '#2c3e50')
  plate(34, 41, 10, 9, '#4a5a68')
  // Twin-barrel turret, aiming at the player.
  disc(28, 57, 6, '#3d4a55')
  disc(28, 57, 3, '#566573', false)
  g.save()
  g.translate(28, 57)
  g.rotate(aim)
  fill(2, -3, 16, 2.5, OUTLINE)
  fill(2, 0.5, 16, 2.5, OUTLINE)
  fill(2.5, -2.5, 15, 1.5, '#4a4a4a')
  fill(2.5, 1, 15, 1.5, '#4a4a4a')
  g.restore()
  // Orange beacon.
  plate(44, -3, 5, 3, '#7a5a0a')
  const on = Math.floor(time * 3) % 2 === 0
  disc(46.5, -4, 2, on ? '#ff9f1c' : '#8a4a00')
  if (on) glow(46.5, -4, 12, '255,159,28', 0.5)
}

function drawGorille(g, b, time, aim) {
  const { fill, plate, disc, glow, line, rivets } = helpers(g)
  const charging = b.action?.kind === 'charge' && b.action.t > 20
  const lean = charging ? -3 : 0
  const breathe = charging ? 0 : Math.round(Math.sin(time * 3)) * 0.5
  const steel = '#4a5866'
  const dark = '#2c3640'
  // Legs and feet.
  plate(11, 38, 9, 12, dark)
  plate(25, 38, 9, 12, dark)
  plate(9, 49, 13, 3, '#1f262d')
  plate(23, 49, 13, 3, '#1f262d')
  // Back arm (right side, further away).
  plate(36 + lean, 18 + breathe, 7, 22, dark)
  plate(35 + lean, 40, 9, 9, '#232b33')
  // Torso: a hunched armoured trunk.
  g.fillStyle = OUTLINE
  g.beginPath()
  g.moveTo(6 + lean - 0.5, 12 + breathe)
  g.lineTo(40 + lean + 0.5, 10 + breathe)
  g.lineTo(37 + lean + 0.5, 40.5)
  g.lineTo(9 + lean - 0.5, 40.5)
  g.closePath()
  g.fill()
  const torso = g.createLinearGradient(0, 10, 0, 40)
  torso.addColorStop(0, '#62717f')
  torso.addColorStop(1, '#2c3640')
  g.fillStyle = torso
  g.beginPath()
  g.moveTo(6 + lean, 12 + breathe)
  g.lineTo(40 + lean, 10 + breathe)
  g.lineTo(37 + lean, 40)
  g.lineTo(9 + lean, 40)
  g.closePath()
  g.fill()
  // Chest plates and a pulsing reactor.
  plate(13 + lean, 18 + breathe, 20, 7, steel)
  plate(15 + lean, 27 + breathe, 16, 6, steel)
  rivets(13 + lean, 19 + breathe, 20, 3, '#1c2329')
  const pulse = 0.5 + Math.sin(time * 6) * 0.25
  disc(23 + lean, 30 + breathe, 3, '#5a1810')
  disc(23 + lean, 30 + breathe, 2, `rgba(255,${80 + pulse * 100},40,1)`, false)
  glow(23 + lean, 30 + breathe, 10, '255,90,40', pulse * 0.6)
  // Shoulders, with a cannon on the near one.
  disc(8 + lean, 15 + breathe, 7, steel)
  disc(38 + lean, 13 + breathe, 6, dark)
  rivets(3 + lean, 15 + breathe, 10, 3, '#1c2329')
  g.save()
  g.translate(6 + lean, 9 + breathe)
  g.rotate(aim)
  fill(0, -2, 14, 4, OUTLINE)
  fill(0.5, -1.5, 13, 3, '#3a3a3a')
  fill(12, -2.5, 3, 5, '#222')
  g.restore()
  // Head sunk between the shoulders, glowing visor.
  plate(15 + lean, 1 + breathe, 15, 13, dark)
  plate(14 + lean, 3 + breathe, 17, 4, steel) // brow
  fill(16 + lean, 8 + breathe, 13, 2.5, '#120808')
  fill(17 + lean, 8.5 + breathe, 4, 1.5, '#ff3b30')
  fill(24 + lean, 8.5 + breathe, 4, 1.5, '#ff3b30')
  glow(19 + lean, 9 + breathe, 7, '255,59,48', 0.55)
  glow(26 + lean, 9 + breathe, 7, '255,59,48', 0.55)
  for (let t = 17; t < 29; t += 2) fill(t + lean, 11.5 + breathe, 1, 1.5, '#1c2329') // jaw vents
  // Near arm: long, knuckles on the ground (forward when charging).
  plate(0 + lean, 17 + breathe, 8, 20, steel)
  line(2 + lean, 19 + breathe, 2 + lean, 35, '#9aa7b3', 0.8) // hydraulic piston
  plate(-3 + lean * 2, 36, 12, 13, '#3a4651')
  for (let k = 0; k < 3; k++) fill(-2 + lean * 2 + k * 4, 46, 3, 2.5, '#22282e') // knuckles
}

function drawDrague(g, b, time, aim) {
  const { fill, plate, disc, line, rivets } = helpers(g)
  // Hull with a sloping bow (facing left), rust and a waterline.
  g.fillStyle = OUTLINE
  g.beginPath()
  g.moveTo(-0.5, 23.5)
  g.lineTo(72.5, 23.5)
  g.lineTo(72.5, 45.5)
  g.lineTo(8, 45.5)
  g.closePath()
  g.fill()
  const hull = g.createLinearGradient(0, 24, 0, 45)
  hull.addColorStop(0, '#9a4a14')
  hull.addColorStop(1, '#3d1700')
  g.fillStyle = hull
  g.beginPath()
  g.moveTo(0, 24)
  g.lineTo(72, 24)
  g.lineTo(72, 45)
  g.lineTo(8.5, 45)
  g.closePath()
  g.fill()
  fill(0, 24, 72, 1.5, '#c06a28')
  fill(5, 38, 67, 2, '#8e1b10') // waterline
  rivets(4, 27, 66, 3, '#2b1100')
  for (let s = 14; s < 70; s += 11) fill(s, 29 + (s % 3), 2, 4, 'rgba(200,120,40,0.6)') // rust streaks
  g.fillStyle = '#f1c40f'
  g.font = 'bold 4px monospace'
  g.textAlign = 'left'
  g.fillText('SERPENT NOIR', 30, 35)
  // Cabin, lit windows, railing.
  plate(40, 4, 26, 20, '#b4bcc2')
  plate(40, 4, 26, 3, '#8d969c')
  for (const wx of [43, 51, 59]) {
    plate(wx, 9, 5, 5, '#f5d76e')
    fill(wx, 9, 5, 1, '#fff3c4')
  }
  for (let rx = 40; rx <= 66; rx += 4) fill(rx, 0, 0.5, 4, '#2b2b2b')
  fill(40, 0, 26, 0.5, '#2b2b2b')
  // Smokestack with a red band.
  plate(56, -10, 5, 14, '#2a2a2a')
  fill(56, -6, 5, 2, '#a52a1a')
  // Serpent flag, waving.
  line(44, -14, 44, 4, '#2b2b2b', 0.8)
  const wave = Math.sin(time * 5)
  g.fillStyle = OUTLINE
  g.beginPath()
  g.moveTo(44, -14)
  g.quadraticCurveTo(48, -15 + wave, 53, -14 - wave)
  g.lineTo(53, -8 - wave)
  g.quadraticCurveTo(48, -9 + wave, 44, -8)
  g.closePath()
  g.fill()
  line(46, -11, 48, -12 + wave, '#f1c40f', 0.8)
  line(48, -12 + wave, 51, -10 - wave, '#f1c40f', 0.8)
  // Gold sluice with sparkles.
  plate(8, 17, 26, 7, '#7d6a4a')
  for (let s = 0; s < 4; s++) {
    if (Math.floor(time * 6 + s) % 3 === 0) fill(11 + s * 6, 19, 1, 1, '#ffe066')
  }
  // Bucket-chain dredge boom going down into the river, buckets moving.
  line(36, 8, -2, 41, OUTLINE, 3.5)
  line(36, 8, -2, 41, '#c98a1a', 2.5)
  for (let k = 0; k < 7; k++) {
    const t = ((k / 7 + time * 0.25) % 1)
    const bx = 36 - 38 * t
    const by = 8 + 33 * t
    plate(bx - 1.5, by - 1.5, 3, 3, '#6e4a1a')
  }
  disc(36, 8, 3, '#7a5a12')
  // Deck gun at the bow, aiming at the player.
  disc(6, 21, 3.5, '#3a3a3a')
  g.save()
  g.translate(6, 21)
  g.rotate(aim)
  fill(0, -1.5, 13, 3, OUTLINE)
  fill(0.5, -1, 12, 2, '#555')
  g.restore()
}

/**
 * Draws the boss onto the scene buffer `g` (world units, already scaled).
 * @param {CanvasRenderingContext2D} g
 * @param {object} state - the engine state
 * @param {number} cam - camera x (world px)
 * @param {number} time - seconds, for animation
 * @param {{ canvas: HTMLCanvasElement, res: number }} layer - scratch canvas for the boss
 * @param {(x: number, y: number, kind: 'smoke'|'spark') => void} emit - damage effects
 */
export function drawBoss(g, state, cam, time, layer, emit) {
  const b = state.boss
  if (!b) return
  const x = b.x / FP - cam
  const y = b.y / FP
  const p = state.player
  const px = p.x / FP - cam
  const py = p.y / FP - 12

  // Scenery attached to the boss, drawn straight on the scene.
  if (b.type === 'grutier') {
    // The gantry girder across the arena.
    g.fillStyle = OUTLINE
    g.fillRect(0, y - 16.5, SCREEN_W, 11)
    g.fillStyle = '#7b8a8c'
    g.fillRect(0, y - 16, SCREEN_W, 2)
    g.fillRect(0, y - 8, SCREEN_W, 2)
    g.strokeStyle = '#5f6b6d'
    g.lineWidth = 1
    g.beginPath()
    const off = -((cam * 1) % 12)
    for (let gx = off - 12; gx < SCREEN_W + 12; gx += 12) {
      g.moveTo(gx, y - 14)
      g.lineTo(gx + 6, y - 8)
      g.lineTo(gx + 12, y - 14)
    }
    g.stroke()
  } else if (b.type === 'drague') {
    // A pool of river water the hull floats in, cut into the bank.
    const wy = y + 38
    const water = g.createLinearGradient(0, wy, 0, GROUND_Y + 10)
    water.addColorStop(0, 'rgba(60,120,120,0.9)')
    water.addColorStop(1, 'rgba(20,60,60,0.9)')
    g.fillStyle = water
    g.fillRect(x - 24, wy, b.w + 48, GROUND_Y + 10 - wy)
    for (let i = 0; i < 8; i++) {
      g.fillStyle = 'rgba(255,255,255,0.35)'
      g.fillRect(x - 20 + ((i * 13 + time * 12) % (b.w + 40)), wy + 1 + (i % 3) * 2, 5, 0.5)
    }
  }

  // The boss itself, on its own layer (so a hit can flash it white).
  const lc = layer.canvas
  const lw = (b.w + PAD * 2) * layer.res
  const lh = (b.h + PAD * 2) * layer.res
  if (lc.width !== lw || lc.height !== lh) {
    lc.width = lw
    lc.height = lh
  }
  const lg = lc.getContext('2d')
  lg.setTransform(layer.res, 0, 0, layer.res, 0, 0)
  lg.clearRect(0, 0, b.w + PAD * 2, b.h + PAD * 2)
  lg.translate(PAD, PAD)
  const local = (wx, wy) => [wx - x, wy - y]
  if (b.type === 'grutier') {
    const [tx, ty] = local(px, py)
    drawGrutier(lg, b, time, aimAngle(28, 57, tx, ty, Math.PI * 0.5, Math.PI * 1.05))
  } else if (b.type === 'gorille') {
    const [tx, ty] = local(px, py)
    drawGorille(lg, b, time, aimAngle(6, 9, tx, ty, Math.PI * 0.85, Math.PI * 1.15))
  } else {
    const [tx, ty] = local(px, py)
    drawDrague(lg, b, time, aimAngle(6, 21, tx, ty, Math.PI * 0.8, Math.PI * 1.2))
  }
  if (b.flash > 0) {
    lg.setTransform(1, 0, 0, 1, 0, 0)
    lg.globalCompositeOperation = 'source-atop'
    lg.fillStyle = 'rgba(255,255,255,0.85)'
    lg.fillRect(0, 0, lw, lh)
    lg.globalCompositeOperation = 'source-over'
  }
  g.drawImage(lc, x - PAD, y - PAD, b.w + PAD * 2, b.h + PAD * 2)

  // Damage: smoke below half health, sparks below a quarter.
  const health = b.hp / b.maxHp
  if (health < 0.5 && Math.random() < 0.12) emit(b.x / FP + Math.random() * b.w, y + Math.random() * b.h * 0.6, 'smoke')
  if (health < 0.25 && Math.random() < 0.15) emit(b.x / FP + Math.random() * b.w, y + Math.random() * b.h, 'spark')
}
