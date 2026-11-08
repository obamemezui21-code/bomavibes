import { appFont } from '../../lib/fonts.js'
import { BOW, FP, GROUND, H, PULL_MAX, W, airYOf, flightPath, isAiming, sizeOf } from '../../../../shared/fleche-ebene/engine.mjs'

// FLÈCHE D'ÉBÈNE's drawing: the Ivindo forest, the hunter and his ebony bow,
// the targets and the arrows. The poachers, monsters and animals are the
// sheets of Œil de Panthère; the hunter, the hog and the guineafowl have their
// own, and what can't load in time is drawn by hand. The hunter's arms and the
// string are drawn here, because they follow the aim. Purely visual: nothing
// here feeds back into the simulation.

const BACKDROP_URL = '/commando/bg-ivindo.webp'
const BOW_URL = '/fleche/arc.webp'
const SHEETS = ['braconniers', 'gorille', 'sitatunga', 'elephant', 'pangolin', 'monstre', 'marais', 'chasseur', 'potamochere', 'pintade']
// By engine variant: the sheet, and how tall the figure is drawn for its hit box.
const ANIMALS = [
  { name: 'gorille', height: 1.15, steps: 5 },
  { name: 'sitatunga', height: 1.35, steps: 7 },
  { name: 'elephant', height: 1.05, steps: 4 },
  { name: 'pangolin', height: 1.1, steps: 6 },
]
const MONSTERS = [
  { name: 'monstre', height: 1.12, byHead: true },
  { name: 'marais', height: 1.1, byHead: false },
]
const PREVIEW_TICKS = 27 // the dotted line only shows the start of the flight
const LEAVES = 16
const HUNTER_X = 52
const HUNTER_HEIGHT = 112
const ARM_LENGTH = 34 // shoulder to the hand on the bow
const BOW_HEIGHT = 84
const BOW_THICKNESS = 2 // the picture is very slim: widened to read on the forest
const BOW_GRIP = 107 / 143 // across the picture: the grip, and the two tips
const BOW_TIP = 73 / 143
// The skin of the hunter's picture: lit side, middle, shadow.
const SKIN_NEAR = ['#b57a55', '#8d5637', '#5a3320']
const SKIN_FAR = ['#7d4b30', '#5f3923', '#3f2415']
const HURT_SECONDS = 0.7

let backdrop = null
let bowArt = null
const sheets = {}
let loading = null
export function preloadArt() {
  loading ||= Promise.all([
    new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        bowArt = img
        resolve()
      }
      img.onerror = () => resolve()
      img.src = BOW_URL
    }),
    new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        backdrop = img
        resolve()
      }
      img.onerror = () => resolve()
      img.src = BACKDROP_URL
    }),
    ...SHEETS.map((name) =>
      fetch(`/commando/sprites-${name}.json`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('missing'))))
        .then(
          (manifest) =>
            new Promise((resolve) => {
              const img = new Image()
              img.onload = () => {
                sheets[name] = { img, manifest }
                resolve()
              }
              img.onerror = () => resolve()
              img.src = `/commando/sprites-${name}.webp`
            }),
        )
        .catch(() => {}),
    ),
  ])
  return loading
}

// One frame of a sheet, feet on `base`, `height` units tall for the figure,
// facing right (1) or left (-1); centred on x, or on the head with byHead.
function drawFrame(g, name, pose, index, x, base, height, facing, byHead = false) {
  const sh = sheets[name]
  const frames = sh?.manifest.frames[pose] || sh?.manifest.frames.stand
  if (!frames) return false
  const f = frames[index % frames.length]
  const sc = height / sh.manifest.figureHeight
  g.save()
  g.translate(x, base)
  g.scale(facing, 1)
  const ax = byHead ? f.anchorX : f.w / 2
  g.drawImage(sh.img, f.x, f.y, f.w, f.h, -ax * sc, -f.h * sc, f.w * sc, f.h * sc)
  g.restore()
  return true
}

// Grass along the ground, fixed; wide screens show more than the scene.
const GRASS_MARGIN = 500
const GRASS = (() => {
  const blades = []
  let n = 41
  for (let x = -GRASS_MARGIN; x < W + GRASS_MARGIN; x += 5) {
    n = (n * 1103515245 + 12345) % 2147483648
    blades.push({ x, h: 5 + (n % 9), lean: ((n >> 8) % 7) - 3 })
  }
  return blades
})()

export function createFlecheRenderer(canvas) {
  const g = canvas.getContext('2d')
  let cssW = 1
  let cssH = 1
  let dpr = 1
  let s = 1
  let offX = 0
  let offY = 0
  let snap = 0 // the string still shaking after a shot
  let hurt = 0 // seconds left of the hunter's hurt pose
  const popups = []
  const stuck = [] // arrows planted in the ground
  const sparks = []
  const leaves = Array.from({ length: LEAVES }, () => ({
    x: Math.random() * W,
    y: Math.random() * GROUND,
    speed: 10 + Math.random() * 14,
    phase: Math.random() * 6,
  }))

  function resize(w, h) {
    cssW = Math.max(1, w)
    cssH = Math.max(1, h)
    dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    s = Math.min(cssW / W, cssH / H)
    offX = (cssW - W * s) / 2
    offY = (cssH - H * s) * 0.75 // on a tall phone, the scene sits low, under the sky
  }

  function drawBackdrop() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (backdrop) {
      const cover = Math.max(cssW / backdrop.width, cssH / backdrop.height)
      const w = backdrop.width * cover
      const h = backdrop.height * cover
      g.drawImage(backdrop, (cssW - w) / 2, (cssH - h) / 2, w, h)
    } else {
      const sky = g.createLinearGradient(0, 0, 0, cssH)
      sky.addColorStop(0, '#3d4a35')
      sky.addColorStop(1, '#141c10')
      g.fillStyle = sky
      g.fillRect(0, 0, cssW, cssH)
    }
    g.fillStyle = 'rgba(8,14,6,0.28)'
    g.fillRect(0, 0, cssW, cssH)
  }

  function drawGround() {
    const left = -offX / s - 2
    const right = (cssW - offX) / s + 2
    const bottom = (cssH - offY) / s + 2
    const earth = g.createLinearGradient(0, GROUND, 0, bottom)
    earth.addColorStop(0, '#2c2a14')
    earth.addColorStop(1, '#100d07')
    g.fillStyle = earth
    g.fillRect(left, GROUND, right - left, bottom - GROUND)
    g.strokeStyle = '#4c6a27'
    g.lineWidth = 1.4
    g.beginPath()
    for (const b of GRASS) {
      g.moveTo(b.x, GROUND + 1)
      g.lineTo(b.x + b.lean, GROUND - b.h)
    }
    g.stroke()
  }

  function drawLeaves(state, dt) {
    g.fillStyle = 'rgba(190,200,90,0.75)'
    for (const leaf of leaves) {
      leaf.x += (state.wind * 16 - 4) * dt
      leaf.y += leaf.speed * dt
      if (leaf.y > GROUND) leaf.y = -10
      if (leaf.x < -10) leaf.x = W + 10
      if (leaf.x > W + 10) leaf.x = -10
      g.save()
      g.translate(leaf.x, leaf.y)
      g.rotate(Math.sin(leaf.y * 0.05 + leaf.phase))
      g.beginPath()
      g.ellipse(0, 0, 3, 1.5, 0, 0, 6.3)
      g.fill()
      g.restore()
    }
  }

  // ── Targets ────────────────────────────────────────────────────────────
  function drawCible(t) {
    const { w, h } = sizeOf(t)
    const x = t.x / FP
    const r = w / 2
    const cy = GROUND - h + r
    g.fillStyle = '#5a3a1e'
    g.fillRect(x - 3, cy, 6, h - r)
    const rings = ['#f3e3b5', '#c0392b', '#f3e3b5', '#c0392b', '#ffd23f']
    rings.forEach((color, i) => {
      g.fillStyle = color
      g.beginPath()
      g.arc(x, cy, r * (1 - i * 0.2), 0, 6.3)
      g.fill()
    })
    g.strokeStyle = '#5a3a1e'
    g.lineWidth = 1.5
    g.beginPath()
    g.arc(x, cy, r, 0, 6.3)
    g.stroke()
  }

  function drawPotamochere(t, time) {
    const { w, h } = sizeOf(t)
    const x = t.x / FP
    if (drawFrame(g, 'potamochere', 'run', Math.floor(time * 12 + t.id), x, GROUND, h * 1.25, t.facing)) return
    const legs = Math.sin(time * 22 + t.id) * 6
    const u = w / 64 // drawn for a 64-unit-long hog
    const v = h / 42
    g.save()
    g.translate(x, GROUND)
    g.scale(t.facing * u, v)
    // Thin black legs, the far pair darker.
    g.lineCap = 'round'
    g.lineWidth = 3.4
    g.strokeStyle = '#150a05'
    g.beginPath()
    g.moveTo(-19, -14)
    g.lineTo(-19 - legs, 0)
    g.moveTo(15, -14)
    g.lineTo(15 + legs, 0)
    g.stroke()
    g.strokeStyle = '#241108'
    g.beginPath()
    g.moveTo(-13, -14)
    g.lineTo(-13 + legs, 0)
    g.moveTo(21, -14)
    g.lineTo(21 - legs, 0)
    g.stroke()
    // A tail with a tuft.
    g.lineWidth = 1.6
    g.beginPath()
    g.moveTo(-28, -28)
    g.quadraticCurveTo(-36, -26 + legs * 0.5, -34, -15)
    g.stroke()
    // Rust-red body, high at the shoulder, sloping to the rump.
    g.fillStyle = '#b4532a'
    g.beginPath()
    g.moveTo(-29, -22)
    g.bezierCurveTo(-30, -34, -14, -38, 2, -38)
    g.bezierCurveTo(14, -38, 22, -36, 25, -28)
    g.bezierCurveTo(24, -16, 10, -11, -6, -11)
    g.bezierCurveTo(-20, -11, -29, -13, -29, -22)
    g.fill()
    g.fillStyle = 'rgba(70,24,8,0.4)'
    g.beginPath()
    g.ellipse(-3, -14, 21, 4, 0, 0, 6.3)
    g.fill()
    // The white crest along the spine.
    g.strokeStyle = '#f5ead0'
    g.lineWidth = 1.4
    g.beginPath()
    for (let i = 0; i <= 9; i++) {
      const cx = -24 + i * 5
      const cy = -35.5 - Math.sin((i / 9) * 3.1) * 3
      g.moveTo(cx, cy + 2)
      g.lineTo(cx - 1.5, cy - 3)
    }
    g.stroke()
    // The head: a long black-and-white mask, a tufted ear, a pale snout.
    g.fillStyle = '#1f110a'
    g.beginPath()
    g.moveTo(20, -35)
    g.bezierCurveTo(30, -33, 38, -25, 42, -17)
    g.lineTo(37, -13)
    g.bezierCurveTo(29, -14, 20, -18, 16, -26)
    g.fill()
    g.fillStyle = '#f5ead0'
    g.beginPath()
    g.moveTo(25, -31)
    g.lineTo(38, -18)
    g.lineTo(35, -17)
    g.lineTo(24, -28)
    g.fill()
    g.fillStyle = '#d9a184'
    g.beginPath()
    g.ellipse(40, -15.5, 3.2, 2.6, 0.5, 0, 6.3)
    g.fill()
    g.fillStyle = '#fff'
    g.beginPath()
    g.arc(27, -27.5, 1.5, 0, 6.3)
    g.fill()
    g.fillStyle = '#f5ead0'
    g.beginPath()
    g.moveTo(19, -35)
    g.lineTo(14, -46)
    g.lineTo(24, -36)
    g.fill()
    g.restore()
  }

  function drawPintade(t, time) {
    const x = t.x / FP
    const y = airYOf(t)
    // Wings up, level, down, level.
    const beat = [0, 1, 2, 1][Math.floor(time * 11 + t.id) % 4]
    if (drawFrame(g, 'pintade', 'run', beat, x, y + 15, 60, t.facing)) return
    const wing = Math.sin(time * 16 + t.id) // 1 up, -1 down
    g.save()
    g.translate(x, y)
    g.scale(t.facing, 1)
    // Round, dark, pearl-spotted body with a short drooping tail.
    g.fillStyle = '#2f343c'
    g.beginPath()
    g.moveTo(-20, 3)
    g.bezierCurveTo(-14, -11, 6, -12, 12, -5)
    g.bezierCurveTo(13, 4, 3, 11, -8, 9)
    g.bezierCurveTo(-14, 8, -18, 6, -20, 3)
    g.fill()
    g.fillStyle = '#e8edf2'
    for (const [dx, dy] of [[-13, 2], [-8, -3], [-7, 5], [-2, -6], [-1, 1], [0, 7], [5, -4], [6, 2]]) {
      g.beginPath()
      g.arc(dx, dy, 0.9, 0, 6.3)
      g.fill()
    }
    // Thin bare neck, little blue head, bony casque, red wattle, pale beak.
    g.strokeStyle = '#7fa6d6'
    g.lineWidth = 3.4
    g.lineCap = 'round'
    g.beginPath()
    g.moveTo(10, -3)
    g.quadraticCurveTo(15, -6, 16, -11)
    g.stroke()
    g.fillStyle = '#7fa6d6'
    g.beginPath()
    g.arc(17.5, -12, 3.3, 0, 6.3)
    g.fill()
    g.fillStyle = '#d9b777'
    g.beginPath()
    g.moveTo(15.5, -14.5)
    g.lineTo(16.5, -20)
    g.lineTo(19, -14.5)
    g.fill()
    g.fillStyle = '#c0392b'
    g.beginPath()
    g.ellipse(19, -8, 1.3, 2.2, 0, 0, 6.3)
    g.fill()
    g.fillStyle = '#e8d29a'
    g.beginPath()
    g.moveTo(20.5, -13.5)
    g.lineTo(25, -11.5)
    g.lineTo(20.5, -10.5)
    g.fill()
    // The wing beats from the shoulder, up and down.
    g.fillStyle = '#1f2329'
    g.beginPath()
    g.moveTo(6, -4)
    g.lineTo(-9, -3)
    g.quadraticCurveTo(-13, -3 - wing * 14, -8, -3 - wing * 21)
    g.quadraticCurveTo(2, -3 - wing * 15, 6, -4)
    g.fill()
    g.restore()
  }

  function drawCoin(t, time) {
    const x = t.x / FP
    const r = sizeOf(t).w / 2
    const squash = Math.abs(Math.cos(time * 5))
    g.fillStyle = '#b8860b'
    g.beginPath()
    g.ellipse(x, t.y, r * Math.max(0.25, squash), r, 0, 0, 6.3)
    g.fill()
    g.fillStyle = '#ffd23f'
    g.beginPath()
    g.ellipse(x, t.y, (r - 3) * Math.max(0.2, squash), r - 3, 0, 0, 6.3)
    g.fill()
  }

  function drawPoacher(t, time) {
    const { h } = sizeOf(t)
    const x = t.x / FP
    const pose = t.state === 'hit' ? 'lying' : t.state === 'aim' ? (isAiming(t) ? 'kneel' : 'stand') : 'run'
    if (drawFrame(g, 'braconniers', pose, Math.floor(time * 10), x, GROUND, h, t.state === 'aim' ? -1 : t.facing, true)) return
    g.fillStyle = '#2d2a22'
    g.fillRect(x - h * 0.13, GROUND - h * 0.8, h * 0.26, h * 0.8)
    g.beginPath()
    g.arc(x, GROUND - h * 0.88, h * 0.11, 0, 6.3)
    g.fill()
  }

  function drawMonster(t, time) {
    const { w, h } = sizeOf(t)
    const look = MONSTERS[t.variant] || MONSTERS[0]
    const x = t.x / FP
    const bob = Math.abs(Math.sin(time * 6 + t.id)) * 3
    const hurt = t.hp < sizeOfHp(t)
    if (!drawFrame(g, look.name, hurt ? 'hurt' : 'stand', 0, x, GROUND - bob, h * look.height, -1, look.byHead)) {
      g.fillStyle = '#3f5a2a'
      g.beginPath()
      g.ellipse(x, GROUND - h / 2 - bob, w / 2, h / 2, 0, 0, 6.3)
      g.fill()
    }
    if (hurt) {
      g.fillStyle = 'rgba(0,0,0,0.5)'
      g.fillRect(x - 15, GROUND - h - 10, 30, 4)
      g.fillStyle = '#e74c3c'
      g.fillRect(x - 15, GROUND - h - 10, 15, 4)
    }
  }
  const sizeOfHp = (t) => (t.kind === 'monstre' ? 2 : 1)

  function drawAnimal(t, time) {
    const { w, h } = sizeOf(t)
    const look = ANIMALS[t.variant] || ANIMALS[0]
    const x = t.x / FP
    const speed = t.state === 'flee' ? 2.4 : 1
    if (!drawFrame(g, look.name, 'run', Math.floor(time * look.steps * speed + t.id), x, GROUND, h * look.height, t.facing)) {
      g.fillStyle = '#26221c'
      g.beginPath()
      g.ellipse(x, GROUND - h / 2, w / 2, h / 2, 0, 0, 6.3)
      g.fill()
    }
    if (t.state !== 'flee') {
      // The green badge of the protected animals.
      g.fillStyle = '#22a35a'
      g.beginPath()
      g.arc(x, GROUND - h - 11, 7, 0, 6.3)
      g.fill()
      g.fillStyle = '#fff'
      g.font = `bold 9px ${appFont()}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('♥', x, GROUND - h - 10.5)
    }
  }

  function drawTarget(t, time) {
    const falling = t.state === 'hit'
    if (falling) {
      g.save()
      g.globalAlpha = Math.max(0, 1 - t.t / 30)
      if (t.kind !== 'braconnier') {
        const y = t.kind === 'pintade' || t.kind === 'or' ? airYOf(t) + t.t * 2 : GROUND
        g.translate(t.x / FP, y)
        g.rotate((t.t / 30) * 1.4 * (t.facing || 1))
        g.translate(-t.x / FP, -(t.kind === 'pintade' || t.kind === 'or' ? airYOf(t) : GROUND))
      }
    }
    if (t.kind === 'cible') drawCible(t)
    else if (t.kind === 'potamochere') drawPotamochere(t, time)
    else if (t.kind === 'pintade') drawPintade(t, time)
    else if (t.kind === 'or') drawCoin(t, time)
    else if (t.kind === 'braconnier') drawPoacher(t, time)
    else if (t.kind === 'monstre') drawMonster(t, time)
    else drawAnimal(t, time)
    if (falling) g.restore()

    if (isAiming(t)) {
      const { h } = sizeOf(t)
      g.fillStyle = Math.floor(time * 8) % 2 ? '#ff5340' : '#ffd23f'
      g.font = `bold 22px ${appFont()}`
      g.textAlign = 'center'
      g.textBaseline = 'alphabetic'
      g.fillText('!', t.x / FP, GROUND - h - 8)
    }
  }

  // ── The hunter and his bow ─────────────────────────────────────────────
  // A limb from a to b, tapering from width wa to wb: rounded at both ends and
  // shaded across, lit from the top like the hunter's picture.
  function drawLimb(a, b, wa, wb, [light, middle, dark]) {
    const angle = Math.atan2(b.y - a.y, b.x - a.x)
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    g.save()
    g.translate(a.x, a.y)
    g.rotate(angle)
    // Which side faces up decides where the light falls, whatever the angle.
    const top = Math.cos(angle) >= 0 ? -1 : 1
    const shade = g.createLinearGradient(0, (-top * wa) / 2, 0, (top * wa) / 2)
    shade.addColorStop(0, dark)
    shade.addColorStop(0.45, middle)
    shade.addColorStop(0.85, light)
    shade.addColorStop(1, middle)
    g.fillStyle = shade
    g.beginPath()
    g.arc(0, 0, wa / 2, Math.PI / 2, -Math.PI / 2)
    g.lineTo(length, -wb / 2)
    g.arc(length, 0, wb / 2, -Math.PI / 2, Math.PI / 2)
    g.closePath()
    g.fill()
    g.restore()
  }

  // A band around a limb, at this share of its length.
  function drawBand(a, b, share, width, color) {
    const x = a.x + (b.x - a.x) * share
    const y = a.y + (b.y - a.y) * share
    const angle = Math.atan2(b.y - a.y, b.x - a.x)
    g.save()
    g.translate(x, y)
    g.rotate(angle)
    g.fillStyle = color
    g.fillRect(-1.2, -width / 2, 2.4, width)
    g.fillStyle = '#d9b36a'
    g.fillRect(-1.9, -width / 2, 0.7, width)
    g.fillRect(1.2, -width / 2, 0.7, width)
    g.restore()
  }

  // His picture has no near arm: the arm holding the bow goes behind him, the
  // one on the string in front, and the bow turns around his shoulder.
  function drawHunterArt(state, aim, time) {
    const pose = state.over ? (state.lives > 0 ? 'up' : 'hurt') : hurt > 0 ? 'hurt' : 'stand'
    if (pose !== 'stand') {
      drawFrame(g, 'chasseur', pose, 0, HUNTER_X, GROUND, HUNTER_HEIGHT, 1, true)
      return
    }
    const pull = aim ? Math.min(1, Math.hypot(aim.ax, aim.ay) / PULL_MAX) : 0
    const angle = aim ? Math.atan2(aim.ay, aim.ax) : -0.18
    const [dx, dy] = [Math.cos(angle), Math.sin(angle)]
    const hand = { x: BOW.x + dx * ARM_LENGTH, y: BOW.y + dy * ARM_LENGTH }
    const nock = { x: hand.x - dx * (10 + pull * 34), y: hand.y - dy * (10 + pull * 34) }
    const shake = snap > 0 ? Math.sin(time * 70) * snap * 3 : 0

    // The arm holding the bow, then the bow, with a rim of light so the dark
    // ebony reads on the forest.
    const farShoulder = { x: BOW.x - 3, y: BOW.y + 2 }
    drawLimb(farShoulder, hand, 8, 5.5, SKIN_FAR)

    g.save()
    g.translate(hand.x, hand.y)
    g.rotate(angle)
    const bowW = bowArt ? ((BOW_HEIGHT * bowArt.width) / bowArt.height) * BOW_THICKNESS : 0
    const tipX = (BOW_TIP - BOW_GRIP) * bowW
    if (bowArt) {
      g.shadowColor = 'rgba(255,214,130,0.95)'
      g.shadowBlur = 5 * dpr * s
      g.drawImage(bowArt, -BOW_GRIP * bowW, -BOW_HEIGHT / 2, bowW, BOW_HEIGHT)
      g.shadowBlur = 0
    }
    g.restore()
    drawBand(farShoulder, hand, 0.82, 6, '#a8432f')

    // The body, then the string, the arrow and the arm pulling them.
    drawFrame(g, 'chasseur', 'stand', 0, HUNTER_X, GROUND, HUNTER_HEIGHT, 1, true)

    const along = (back, across) => ({ x: hand.x + dx * back - dy * across, y: hand.y + dy * back + dx * across })
    const [top, bottom] = [along(tipX, -BOW_HEIGHT / 2), along(tipX, BOW_HEIGHT / 2)]
    const stringAt = aim ? nock : along(tipX + shake, 0)
    g.strokeStyle = 'rgba(245,235,210,0.7)'
    g.lineWidth = 0.7
    g.beginPath()
    g.moveTo(top.x, top.y)
    g.lineTo(stringAt.x, stringAt.y)
    g.lineTo(bottom.x, bottom.y)
    g.stroke()

    if (state.nock === 0) {
      g.save()
      g.translate(nock.x + dx * 19, nock.y + dy * 19)
      g.rotate(angle)
      drawArrowShape()
      g.restore()
    }

    const shoulder = { x: BOW.x - 13, y: BOW.y + 2 }
    const elbow = {
      x: (shoulder.x + nock.x) / 2 - dx * (6 + pull * 12),
      y: (shoulder.y + nock.y) / 2 - dy * (6 + pull * 12) + 7,
    }
    drawLimb(shoulder, elbow, 9.5, 7, SKIN_NEAR)
    drawLimb(elbow, nock, 7, 5, SKIN_NEAR)
    drawBand(shoulder, elbow, 0.5, 8, '#a8432f')
    drawBand(elbow, nock, 0.84, 6, '#a8432f')
    // The fingers on the string.
    g.fillStyle = SKIN_NEAR[1]
    g.beginPath()
    g.arc(nock.x, nock.y, 3.6, 0, 6.3)
    g.fill()
  }

  function drawHunter(state, aim, time) {
    if (sheets.chasseur) {
      drawHunterArt(state, aim, time)
      return
    }
    const pull = aim ? Math.min(1, Math.hypot(aim.ax, aim.ay) / PULL_MAX) : 0
    const angle = aim ? Math.atan2(aim.ay, aim.ax) : -0.18
    const breathe = Math.sin(time * 2) * 0.8
    const hipY = GROUND - 36
    const shoulderY = GROUND - 66 + breathe
    const skin = '#5a3a24'

    // Quiver on the back.
    g.save()
    g.translate(HUNTER_X - 9, shoulderY + 4)
    g.rotate(-0.35)
    g.fillStyle = '#6e4a24'
    g.fillRect(-4, -14, 8, 30)
    g.strokeStyle = '#d9c9a0'
    g.lineWidth = 1.2
    g.beginPath()
    for (const dx of [-2, 1, 3]) {
      g.moveTo(dx, -14)
      g.lineTo(dx, -24)
    }
    g.stroke()
    g.restore()

    // Legs, body, raphia skirt, head.
    g.strokeStyle = skin
    g.lineCap = 'round'
    g.lineWidth = 7
    g.beginPath()
    g.moveTo(HUNTER_X - 3, hipY)
    g.lineTo(HUNTER_X - 14, GROUND - 1)
    g.moveTo(HUNTER_X + 3, hipY)
    g.lineTo(HUNTER_X + 14, GROUND - 1)
    g.stroke()
    g.lineWidth = 13
    g.beginPath()
    g.moveTo(HUNTER_X, hipY)
    g.lineTo(HUNTER_X, shoulderY + 6)
    g.stroke()
    g.fillStyle = '#c9a25a'
    g.beginPath()
    g.moveTo(HUNTER_X - 9, hipY - 5)
    g.lineTo(HUNTER_X + 9, hipY - 5)
    g.lineTo(HUNTER_X + 14, hipY + 14)
    g.lineTo(HUNTER_X - 14, hipY + 14)
    g.fill()
    g.strokeStyle = '#8a6a30'
    g.lineWidth = 1
    g.beginPath()
    for (let x = -10; x <= 10; x += 4) {
      g.moveTo(HUNTER_X + x * 0.8, hipY - 3)
      g.lineTo(HUNTER_X + x * 1.3, hipY + 13)
    }
    g.stroke()
    g.fillStyle = skin
    g.beginPath()
    g.arc(HUNTER_X + 1, shoulderY - 12, 9, 0, 6.3)
    g.fill()
    g.fillStyle = '#c0392b'
    g.fillRect(HUNTER_X - 8, shoulderY - 17, 18, 3.5)
    g.fillStyle = '#fcd116'
    g.beginPath()
    g.moveTo(HUNTER_X - 7, shoulderY - 17)
    g.lineTo(HUNTER_X - 15, shoulderY - 33)
    g.lineTo(HUNTER_X - 3, shoulderY - 20)
    g.fill()

    // The bow turns around its grip; the string comes back with the draw.
    g.save()
    g.translate(BOW.x, BOW.y)
    g.rotate(angle)
    const nock = -6 - pull * 34
    const shake = snap > 0 ? Math.sin(time * 70) * snap * 3 : 0
    g.strokeStyle = skin
    g.lineWidth = 5
    g.beginPath()
    g.moveTo(-16, 0)
    g.lineTo(2, 0)
    g.stroke()
    g.beginPath()
    g.moveTo(-16, 8)
    g.lineTo(nock, 0)
    g.stroke()
    g.strokeStyle = '#1b1310'
    g.lineWidth = 4
    g.beginPath()
    g.moveTo(-8, -34)
    g.quadraticCurveTo(14 - pull * 6, 0, -8, 34)
    g.stroke()
    g.strokeStyle = '#d4a017'
    g.lineWidth = 1.2
    g.beginPath()
    g.moveTo(5, -9)
    g.lineTo(5, 9)
    g.stroke()
    g.strokeStyle = 'rgba(245,235,210,0.9)'
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(-8, -34)
    g.lineTo(aim ? nock : -6 + shake, 0)
    g.lineTo(-8, 34)
    g.stroke()
    if (state.nock === 0) {
      g.translate(nock + 34, 0)
      drawArrowShape()
    }
    g.restore()
  }

  // An arrow pointing right, its point at (17, 0).
  function drawArrowShape() {
    g.strokeStyle = '#2a1a10'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(-17, 0)
    g.lineTo(13, 0)
    g.stroke()
    g.fillStyle = '#d7dde2'
    g.beginPath()
    g.moveTo(21, 0)
    g.lineTo(12, -3.5)
    g.lineTo(12, 3.5)
    g.fill()
    g.fillStyle = '#c0392b'
    g.beginPath()
    g.moveTo(-17, 0)
    g.lineTo(-23, -4)
    g.lineTo(-13, 0)
    g.lineTo(-23, 4)
    g.fill()
  }

  function drawArrows(state) {
    for (const arrow of state.arrows) {
      g.save()
      g.translate(arrow.x / FP, arrow.y / FP)
      g.rotate(Math.atan2(arrow.vy, arrow.vx))
      drawArrowShape()
      g.restore()
    }
  }

  function drawStuck(dt) {
    for (let i = stuck.length - 1; i >= 0; i--) {
      const a = stuck[i]
      a.life -= dt
      if (a.life <= 0) {
        stuck.splice(i, 1)
        continue
      }
      g.save()
      g.globalAlpha = Math.min(1, a.life)
      g.translate(a.x, a.y - 8)
      g.rotate(a.angle)
      drawArrowShape()
      g.restore()
    }
  }

  // Dots along the start of the flight: the rest is the archer's eye.
  function drawPreview(aim, wind) {
    const path = flightPath(aim.ax, aim.ay, wind, PREVIEW_TICKS)
    for (let i = 2; i < path.length; i += 3) {
      g.fillStyle = `rgba(255,240,190,${0.85 * (1 - i / path.length)})`
      g.beginPath()
      g.arc(path[i][0], path[i][1], 2.2, 0, 6.3)
      g.fill()
    }
  }

  function drawEffects(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]
      p.life -= dt
      if (p.life <= 0) {
        sparks.splice(i, 1)
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 200 * dt
      g.fillStyle = p.color
      g.globalAlpha = Math.min(1, p.life * 3)
      g.fillRect(p.x, p.y, 2.5, 2.5)
    }
    g.globalAlpha = 1
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i]
      p.life -= dt
      if (p.life <= 0) {
        popups.splice(i, 1)
        continue
      }
      p.y -= 26 * dt
      g.globalAlpha = Math.min(1, p.life * 2)
      g.font = `bold ${p.size}px ${appFont()}`
      g.lineWidth = 3
      g.strokeStyle = 'rgba(0,0,0,0.7)'
      g.strokeText(p.text, p.x, p.y)
      g.fillStyle = p.color
      g.fillText(p.text, p.x, p.y)
    }
    g.globalAlpha = 1
  }

  function burst(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      sparks.push({ x, y, vx: (Math.random() - 0.5) * 150, vy: -Math.random() * 120, life: 0.35 + Math.random() * 0.3, color })
    }
  }

  function popup(x, y, text, color, size = 15) {
    popups.push({ x, y, text, color, size, life: 1 })
  }

  function handleEvents(state) {
    for (const e of state.events) {
      if (e.type === 'hit') {
        burst(e.x, e.y, e.kind === 'or' ? '#ffd23f' : '#f3e3b5')
        popup(e.x, e.y - 8, `+${e.points}`, e.zone === 'body' ? '#fde68a' : '#ffd23f', e.zone === 'body' ? 15 : 19)
        if (e.long) popup(e.x, e.y - 26, 'TIR LOINTAIN ×2', '#7dd3fc', 11)
        else if (e.zone !== 'body') popup(e.x, e.y - 26, e.zone === 'head' ? 'EN PLEINE TÊTE ×2' : 'EN PLEIN CENTRE ×2', '#fbbf24', 11)
      } else if (e.type === 'wound') {
        burst(e.x, e.y, '#e74c3c', 6)
      } else if (e.type === 'attack') {
        hurt = HURT_SECONDS
      } else if (e.type === 'protected') {
        popup(e.x, e.y - 8, `${e.points}`, '#ff6b5a', 17)
      } else if (e.type === 'miss' && e.grounded) {
        burst(e.x, e.y - 1, '#8a7a4a', 5)
        stuck.push({ x: e.x, y: e.y, angle: Math.atan2(e.vy, e.vx), life: 2.5 })
      }
    }
  }

  function render(state, aim, time, dt) {
    drawBackdrop()
    g.setTransform(dpr * s, 0, 0, dpr * s, dpr * offX, dpr * offY)
    snap = Math.max(0, snap - dt * 4)
    hurt = Math.max(0, hurt - dt)
    drawLeaves(state, dt)
    drawGround()
    drawStuck(dt)
    for (const t of state.targets) drawTarget(t, time)
    drawHunter(state, aim, time)
    if (aim && state.nock === 0) drawPreview(aim, state.wind)
    drawArrows(state)
    drawEffects(dt)
  }

  return {
    resize,
    render,
    handleEvents,
    fired() {
      snap = 1
    },
  }
}
