import { H, KINDS, RIFLES, RISE_TICKS, ROWS, W, baseOf, isAiming, shownOf, sizeOf } from '../../../../shared/oeil-de-panthere/engine.mjs'
import { FLAG_BORDER, FLAG_DESIGNS, paintFlag } from '../flags.js'

// ŒIL DE PANTHÈRE's drawing: the Lopé at dusk with three rows of bushes the
// targets rise from, the rifle, and the scope — a magnified circle of the
// scene around the aim, with its reticle. The scene is drawn once per frame
// into a sharp offscreen buffer; the screen shows it dimmed, and the scope
// shows a zoomed-in part of the same buffer. Purely visual: nothing here
// feeds back into the simulation.

const FP = 16
const BACKDROP_URL = '/commando/bg-lope.webp'
// Sprite sheets (backend/scripts/buildCommandoSprites.js): the poachers are
// Commando Okoumé's; each animal variant (engine: 0 gorilla, 1 antelope) and
// the monster have their own. Until one loads, its figure is drawn by hand.
const SHEETS = [
  'braconniers',
  'gorille',
  'sitatunga',
  'elephant',
  'pangolin',
  'monstre',
  'marais',
  'fusil-carabine',
  'fusil-precision',
  'fusil-assaut',
]
// The rifles' pictures (first-person, stock cut at the bottom): where the
// stock leaves the picture and where the muzzle is, in the frame's pixels.
const RIFLE_ART = {
  carabine: { bottom: [82, 548], muzzle: [285, 0] },
  precision: { bottom: [84, 549], muzzle: [256, 0] },
  assaut: { bottom: [139, 545], muzzle: [257, 0] },
}
// By engine variant: the sheet and how tall the figure is drawn for its hit box
// (horns, trunks and tails stick out of it); the monsters' head anchor or not.
const ANIMAL_SHEETS = [
  { name: 'gorille', height: 1.15, steps: 5 },
  { name: 'sitatunga', height: 1.35, steps: 7 },
  { name: 'elephant', height: 1.05, steps: 4 },
  { name: 'pangolin', height: 1.1, steps: 6 },
]
const MONSTER_SHEETS = [
  { name: 'monstre', height: 1.12, byHead: true },
  { name: 'marais', height: 1.1, byHead: false },
]

let backdrop = null
const sheets = {}
let loading = null
export function preloadArt() {
  loading ||= Promise.all([
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

// Bumpy tops of each row's bushes, fixed.
const BUSHES = ROWS.map((row, r) => {
  const bumps = []
  let x = -10
  let n = r * 97 + 13
  while (x < W + 20) {
    n = (n * 1103515245 + 12345) % 2147483648
    const size = (10 + (n % 14)) * (row.scale / 100) + 4
    bumps.push({ x, r: size })
    x += size * 1.25
  }
  return bumps
})
// Grass tufts on the field, fixed: [x, y, height].
const TUFTS = (() => {
  const out = []
  let n = 7
  for (let i = 0; i < 260; i++) {
    n = (n * 1103515245 + 12345) % 2147483648
    const x = n % W
    n = (n * 1103515245 + 12345) % 2147483648
    const y = ROWS[0].y + 6 + (n % (H - ROWS[0].y))
    out.push([x, y, 2 + ((y - ROWS[0].y) / (H - ROWS[0].y)) * 9])
  }
  return out.sort((a, b) => a[1] - b[1])
})()
const BUSH_COLORS = [
  ['#33432a', '#3f5233'],
  ['#25361c', '#304626'],
  ['#18270f', '#22361a'],
]

export function createPantherRenderer(canvas) {
  const ctx = canvas.getContext('2d')
  const scene = document.createElement('canvas')
  const sctx = scene.getContext('2d')
  let cssW = 1
  let cssH = 1
  let dpr = 1
  let s = 1 // css px per world unit
  let offX = 0
  let offY = 0
  let k = 2 // scene buffer px per world unit
  const popups = []
  const sparks = []
  let flash = 0 // red flash when the player is hit
  let muzzle = 0
  let kick = 0 // rifle recoil on screen

  function resize(w, h) {
    cssW = Math.max(1, w)
    cssH = Math.max(1, h)
    dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    s = Math.min(cssW / W, cssH / H)
    offX = (cssW - W * s) / 2
    offY = (cssH - H * s) / 2
    k = Math.min(4, Math.max(2, s * dpr * 1.5))
    scene.width = Math.round(W * k)
    scene.height = Math.round(H * k)
  }

  // Screen (css px) ↔ world units.
  const toWorld = (px, py) => ({ x: (px - offX) / s, y: (py - offY) / s })
  const scopeRadiusCss = () => Math.max(70, Math.min(cssW, cssH) * 0.27)

  // ── Targets ────────────────────────────────────────────────────────────
  function drawCible(g, t, time) {
    const { w, h } = sizeOf(t)
    const r = w / 2
    const x = t.x / FP
    const base = baseOf(t)
    g.save()
    if (t.state === 'hit') {
      // Knocked flat backwards.
      g.translate(x, base)
      g.scale(1, Math.max(0.05, 1 - t.t / 12))
      g.translate(-x, -base)
    }
    g.fillStyle = '#6b4a2b'
    g.fillRect(x - w * 0.05, base - h + r, w * 0.1, h - r)
    const cy = base - h + r
    const rings = ['#f5f0e6', '#c0392b', '#f5f0e6', '#c0392b', '#f5f0e6']
    rings.forEach((c, i) => {
      g.beginPath()
      g.arc(x, cy, r * (1 - i * 0.18), 0, Math.PI * 2)
      g.fillStyle = c
      g.fill()
    })
    g.beginPath()
    g.arc(x, cy, r / 3 - r * 0.04, 0, Math.PI * 2)
    g.fillStyle = '#f1c40f'
    g.fill()
    g.lineWidth = Math.max(0.6, r * 0.06)
    g.strokeStyle = '#3b2a1a'
    g.beginPath()
    g.arc(x, cy, r, 0, Math.PI * 2)
    g.stroke()
    g.restore()
    void time
  }

  function drawPoacher(g, t, time) {
    const { h } = sizeOf(t)
    const x = t.x / FP
    const base = baseOf(t)
    const facing = t.moving ? Math.sign(t.vx) : x > W / 2 ? -1 : 1
    let pose = 'stand'
    if (t.state === 'hit') pose = 'lying'
    else if (isAiming(t)) pose = 'kneel'
    else if (t.moving) pose = 'run'
    g.save()
    if (t.state === 'hit') g.globalAlpha = Math.max(0, 1 - t.t / 30)
    if (!drawFrame(g, 'braconniers', pose, Math.floor(time * 10), x, base, h, facing, true)) {
      // Until the sheet loads: a dark silhouette with a rifle.
      g.fillStyle = '#2d2a22'
      g.fillRect(x - h * 0.13, base - h * 0.8, h * 0.26, h * 0.8)
      g.beginPath()
      g.arc(x, base - h * 0.88, h * 0.1, 0, Math.PI * 2)
      g.fill()
      g.fillRect(x, base - h * 0.62, h * 0.4 * facing, h * 0.04)
    }
    g.restore()
  }

  function drawMonster(g, t, time) {
    const { w, h } = sizeOf(t)
    const x = t.x / FP
    const bob = Math.sin(time * 4 + t.id) * h * 0.03
    const base = baseOf(t) + bob
    const aiming = isAiming(t)
    const look = MONSTER_SHEETS[t.variant] || MONSTER_SHEETS[0]
    if (sheets[look.name]) {
      // Breathes while it waits, strikes when it's about to attack, recoils when shot.
      const pose = t.state === 'hit' ? 'hurt' : aiming ? 'throw' : Math.floor(time * 1.6 + t.id) % 2 ? 'up' : 'stand'
      const facing = t.vx ? Math.sign(t.vx) : x > W / 2 ? -1 : 1
      g.save()
      if (t.state === 'hit') g.globalAlpha = Math.max(0, 1 - t.t / 30)
      drawFrame(g, look.name, pose, 0, x, baseOf(t), h * look.height, facing, look.byHead)
      g.restore()
      return
    }
    g.save()
    if (t.state === 'hit') {
      const p = t.t / 30
      g.globalAlpha = Math.max(0, 1 - p)
      g.translate(x, base)
      g.scale(1 + p * 0.4, 1 - p * 0.6)
      g.translate(-x, -base)
    }
    const cy = base - h * 0.45
    // Arms with claws, raised when it's about to strike.
    g.strokeStyle = '#2c3a1c'
    g.lineWidth = w * 0.12
    g.lineCap = 'round'
    const lift = aiming ? -h * 0.25 : 0
    for (const side of [-1, 1]) {
      g.beginPath()
      g.moveTo(x + side * w * 0.3, cy)
      g.quadraticCurveTo(x + side * w * 0.62, cy + h * 0.1 + lift, x + side * w * 0.6, cy - h * 0.08 + lift)
      g.stroke()
      g.fillStyle = '#e8e0c8'
      for (let c = 0; c < 3; c++) {
        g.beginPath()
        const cx = x + side * (w * 0.55 + c * w * 0.045)
        const cyy = cy - h * 0.14 + lift
        g.moveTo(cx, cyy)
        g.lineTo(cx + side * w * 0.03, cyy - h * 0.09)
        g.lineTo(cx + side * w * 0.05, cyy + h * 0.01)
        g.fill()
      }
    }
    // Hairy body.
    const body = g.createRadialGradient(x - w * 0.1, cy - h * 0.15, w * 0.05, x, cy, w * 0.55)
    body.addColorStop(0, '#5a6e33')
    body.addColorStop(1, '#22301a')
    g.fillStyle = body
    g.beginPath()
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2
      const fur = 1 + (i % 2 ? 0.08 : -0.02)
      g.lineTo(x + Math.cos(a) * w * 0.42 * fur, cy + Math.sin(a) * h * 0.45 * fur)
    }
    g.fill()
    // Horns.
    g.fillStyle = '#d9cfae'
    for (const side of [-1, 1]) {
      g.beginPath()
      g.moveTo(x + side * w * 0.18, cy - h * 0.36)
      g.quadraticCurveTo(x + side * w * 0.42, cy - h * 0.55, x + side * w * 0.34, cy - h * 0.72)
      g.quadraticCurveTo(x + side * w * 0.3, cy - h * 0.5, x + side * w * 0.08, cy - h * 0.4)
      g.fill()
    }
    // Glowing eyes.
    const eye = aiming ? '#ff3b30' : '#ffd23f'
    for (const side of [-1, 1]) {
      const glow = g.createRadialGradient(x + side * w * 0.14, cy - h * 0.14, 0, x + side * w * 0.14, cy - h * 0.14, w * 0.12)
      glow.addColorStop(0, eye)
      glow.addColorStop(1, 'rgba(255,200,60,0)')
      g.fillStyle = glow
      g.fillRect(x + side * w * 0.14 - w * 0.12, cy - h * 0.26, w * 0.24, w * 0.24)
      g.fillStyle = eye
      g.beginPath()
      g.ellipse(x + side * w * 0.14, cy - h * 0.14, w * 0.06, w * 0.04, side * 0.3, 0, Math.PI * 2)
      g.fill()
    }
    // Mouth and teeth.
    g.fillStyle = '#1a0d0a'
    g.beginPath()
    g.ellipse(x, cy + h * 0.06, w * 0.2, h * (aiming ? 0.1 : 0.06), 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#f2ead3'
    for (let i = -3; i <= 3; i++) {
      g.beginPath()
      g.moveTo(x + i * w * 0.05 - w * 0.02, cy + h * 0.01)
      g.lineTo(x + i * w * 0.05, cy + h * 0.06)
      g.lineTo(x + i * w * 0.05 + w * 0.02, cy + h * 0.01)
      g.fill()
    }
    g.restore()
  }

  function drawAnimal(g, t, time) {
    const { w, h } = sizeOf(t)
    const x = t.x / FP
    const base = baseOf(t)
    const facing = t.vx ? Math.sign(t.vx) : x > W / 2 ? -1 : 1
    const step = t.moving ? Math.sin(time * 9 + t.id) : 0
    g.save()
    if (t.state === 'hit') g.globalAlpha = Math.max(0, 1 - t.t / 30)
    const look = ANIMAL_SHEETS[t.variant] || ANIMAL_SHEETS[0]
    if (sheets[look.name]) {
      const height = h * look.height
      const frame = t.moving ? Math.floor(time * look.steps + t.id) : 0
      drawFrame(g, look.name, t.moving ? 'run' : 'stand', frame, x, base, height, facing)
      g.restore()
      drawBadge(g, t, x, base - height, w)
      return
    }
    g.translate(x, base)
    g.scale(facing, 1)
    if (t.variant === 0) {
      // A gorilla, knuckle-walking.
      g.fillStyle = '#26262a'
      g.beginPath()
      g.ellipse(-w * 0.05, -h * 0.5, w * 0.36, h * 0.32, -0.15, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#3a3a40'
      g.beginPath()
      g.ellipse(-w * 0.12, -h * 0.62, w * 0.22, h * 0.16, -0.2, 0, Math.PI * 2)
      g.fill() // silver back
      g.fillStyle = '#26262a'
      g.lineCap = 'round'
      g.strokeStyle = '#26262a'
      g.lineWidth = w * 0.11
      for (const [ax, sw] of [[0.2, step], [-0.3, -step]]) {
        g.beginPath()
        g.moveTo(w * ax, -h * 0.5)
        g.lineTo(w * (ax + 0.05 + sw * 0.04), -h * 0.04)
        g.stroke()
      }
      g.beginPath()
      g.arc(w * 0.3, -h * 0.66, w * 0.14, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#5b4a42'
      g.beginPath()
      g.ellipse(w * 0.36, -h * 0.62, w * 0.08, h * 0.08, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#111'
      g.fillRect(w * 0.33, -h * 0.71, w * 0.03, h * 0.025)
      g.fillRect(w * 0.39, -h * 0.71, w * 0.03, h * 0.025)
    } else {
      // A sitatunga antelope.
      g.strokeStyle = '#6b4226'
      g.lineWidth = w * 0.04
      for (const [lx, sw] of [[-0.25, step], [-0.15, -step], [0.18, -step], [0.28, step]]) {
        g.beginPath()
        g.moveTo(w * lx, -h * 0.42)
        g.lineTo(w * (lx + sw * 0.05), 0)
        g.stroke()
      }
      g.fillStyle = '#8a5a34'
      g.beginPath()
      g.ellipse(0, -h * 0.5, w * 0.34, h * 0.15, 0, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = '#f1e6d0'
      g.lineWidth = w * 0.012
      for (let i = -2; i <= 2; i++) {
        g.beginPath()
        g.moveTo(i * w * 0.08, -h * 0.63)
        g.lineTo(i * w * 0.08 + w * 0.02, -h * 0.38)
        g.stroke()
      }
      g.fillStyle = '#8a5a34'
      g.beginPath()
      g.moveTo(w * 0.24, -h * 0.58)
      g.lineTo(w * 0.36, -h * 0.86)
      g.lineTo(w * 0.44, -h * 0.82)
      g.lineTo(w * 0.34, -h * 0.5)
      g.fill()
      g.beginPath()
      g.ellipse(w * 0.44, -h * 0.84, w * 0.08, h * 0.05, 0.4, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = '#2b2118'
      g.lineWidth = w * 0.02
      g.beginPath()
      g.moveTo(w * 0.38, -h * 0.88)
      g.quadraticCurveTo(w * 0.3, -h * 1.05, w * 0.36, -h * 1.15)
      g.moveTo(w * 0.42, -h * 0.89)
      g.quadraticCurveTo(w * 0.38, -h * 1.05, w * 0.45, -h * 1.15)
      g.stroke()
    }
    g.restore()
    drawBadge(g, t, x, base - h, w)
  }

  // The green "protected" badge above an animal.
  function drawBadge(g, t, x, top, w) {
    if (t.state !== 'hit') {
      const r = Math.max(3, w * 0.08)
      const by = top - r * 1.2
      g.fillStyle = '#16a34a'
      g.beginPath()
      g.arc(x, by, r, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = '#fff'
      g.lineWidth = r * 0.3
      g.beginPath()
      g.moveTo(x - r * 0.45, by)
      g.lineTo(x - r * 0.1, by + r * 0.4)
      g.lineTo(x + r * 0.5, by - r * 0.4)
      g.stroke()
    }
  }

  function drawCoin(g, t, time) {
    if (t.state === 'hit') return
    const r = sizeOf(t).w / 2
    const x = t.x / FP
    const y = t.y
    const squash = Math.abs(Math.cos(time * 5))
    const glow = g.createRadialGradient(x, y, 0, x, y, r * 2.2)
    glow.addColorStop(0, 'rgba(255,215,90,0.55)')
    glow.addColorStop(1, 'rgba(255,215,90,0)')
    g.fillStyle = glow
    g.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4)
    g.save()
    g.translate(x, y)
    g.scale(Math.max(0.25, squash), 1)
    g.fillStyle = '#b7791f'
    g.beginPath()
    g.arc(0, 0, r, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#f6c945'
    g.beginPath()
    g.arc(0, 0, r * 0.82, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#9a5b12'
    g.font = `900 ${r * 1.1}px system-ui, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('N', 0, r * 0.06)
    g.restore()
  }

  const DRAW = { cible: drawCible, braconnier: drawPoacher, monstre: drawMonster, animal: drawAnimal }

  function drawWarning(g, t, time) {
    if (!isAiming(t) || Math.sin(time * 18) < -0.2) return
    const { h } = sizeOf(t)
    const x = t.x / FP
    const y = baseOf(t) - h - 10 * (ROWS[t.row].scale / 100) - 6
    const r = 4 + 6 * (ROWS[t.row].scale / 100)
    g.fillStyle = '#ef4444'
    g.beginPath()
    g.moveTo(x, y - r)
    g.lineTo(x + r, y + r * 0.8)
    g.lineTo(x - r, y + r * 0.8)
    g.closePath()
    g.fill()
    g.fillStyle = '#fff'
    g.font = `900 ${r * 1.2}px system-ui, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('!', x, y + r * 0.25)
  }

  function drawBushes(g, r) {
    const row = ROWS[r]
    const [dark, light] = BUSH_COLORS[r]
    // Foliage: bumps on top of a strip (down to the bottom for the near row).
    const depth = r === ROWS.length - 1 ? H - row.y + 10 : 4 + 8 * (row.scale / 100)
    const bottom = row.y + 4 + depth
    g.fillStyle = dark
    g.beginPath()
    g.moveTo(-10, bottom)
    for (const b of BUSHES[r]) g.arc(b.x, row.y + b.r * 0.35, b.r, Math.PI, 0)
    g.lineTo(W + 20, bottom)
    g.closePath()
    g.fill()
    g.fillStyle = light
    for (const b of BUSHES[r]) {
      g.beginPath()
      g.arc(b.x - b.r * 0.25, row.y + b.r * 0.15, b.r * 0.45, Math.PI, 0)
      g.fill()
    }
    g.fillStyle = 'rgba(0,0,0,0.22)'
    g.fillRect(-10, bottom - 2, W + 30, 2)
  }

  // The camp's flags (BomaVibes, Gabon, SW, 2NK3) at the back of the field,
  // behind the far row: scenery only, a shot there is a miss.
  function drawCampFlags(g, time) {
    const base = ROWS[0].y + 2
    FLAG_DESIGNS.forEach((design, i) => {
      const x = 70 + i * 167
      const top = base - 66
      const fw = 40
      const fh = 26
      g.strokeStyle = '#d4d4d8'
      g.lineWidth = 1.6
      g.beginPath()
      g.moveTo(x, base)
      g.lineTo(x, top - 2)
      g.stroke()
      g.fillStyle = '#fcd116'
      g.beginPath()
      g.arc(x, top - 2.5, 1.6, 0, Math.PI * 2)
      g.fill()
      const N = 6
      const wave = (j) => Math.sin(time * 4 + i * 1.7 + j * 0.9) * 2.6 * (j / N)
      g.beginPath()
      for (let j = 0; j <= N; j++) g.lineTo(x + (fw * j) / N, top + wave(j))
      for (let j = N; j >= 0; j--) g.lineTo(x + (fw * j) / N, top + fh + wave(j))
      g.closePath()
      g.save()
      g.clip()
      paintFlag(g, design, x, top + wave(N / 2), fw, fh)
      g.restore()
      g.strokeStyle = FLAG_BORDER[design]
      g.lineWidth = 1.2
      g.stroke()
    })
  }

  function drawScene(state, time) {
    const g = sctx
    g.setTransform(k, 0, 0, k, 0, 0)
    if (backdrop) {
      const ratio = Math.max(W / backdrop.width, H / backdrop.height)
      const bw = backdrop.width * ratio
      const bh = backdrop.height * ratio
      g.drawImage(backdrop, (W - bw) / 2, (H - bh) / 2 - 20, bw, bh)
    } else {
      const sky = g.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, '#2b1b3d')
      sky.addColorStop(0.6, '#c2603a')
      sky.addColorStop(1, '#3a2a1a')
      g.fillStyle = sky
      g.fillRect(0, 0, W, H)
    }
    // Dusk: warm haze, darker at the top.
    const dusk = g.createLinearGradient(0, 0, 0, H)
    dusk.addColorStop(0, 'rgba(30,14,48,0.45)')
    dusk.addColorStop(0.55, 'rgba(255,140,60,0.12)')
    dusk.addColorStop(1, 'rgba(10,8,4,0.35)')
    g.fillStyle = dusk
    g.fillRect(0, 0, W, H)

    // The savanna field the rows stand in.
    const field = g.createLinearGradient(0, ROWS[0].y, 0, H)
    field.addColorStop(0, '#8a7d45')
    field.addColorStop(0.45, '#5e6a30')
    field.addColorStop(1, '#2f3f1a')
    g.fillStyle = field
    g.fillRect(0, ROWS[0].y, W, H - ROWS[0].y)
    g.strokeStyle = 'rgba(40,52,20,0.55)'
    g.lineWidth = 0.8
    g.beginPath()
    for (const [x, y, h] of TUFTS) {
      g.moveTo(x, y)
      g.lineTo(x - h * 0.3, y - h)
      g.moveTo(x, y)
      g.lineTo(x + h * 0.25, y - h * 0.9)
    }
    g.stroke()

    drawCampFlags(g, time)
    for (const t of state.targets) if (t.row < 0) drawCoin(g, t, time)

    for (let r = 0; r < ROWS.length; r++) {
      const row = ROWS[r]
      for (const t of state.targets) {
        if (t.row !== r) continue
        const { h } = sizeOf(t)
        const hidden = t.state === 'hit' ? 0 : (h * (RISE_TICKS - shownOf(t))) / RISE_TICKS
        g.save()
        g.beginPath()
        g.rect(-50, -50, W + 100, row.y + 50 + 2)
        g.clip()
        g.translate(0, hidden)
        DRAW[t.kind](g, t, time)
        g.restore()
      }
      drawBushes(g, r)
      for (const t of state.targets) if (t.row === r) drawWarning(g, t, time)
      if (r < 2) {
        g.fillStyle = 'rgba(120,90,140,0.08)' // a little haze in front of the far rows
        g.fillRect(0, 0, W, H)
      }
    }

    // Effects.
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]
      const age = time - p.t0
      if (age > 0.5) {
        sparks.splice(i, 1)
        continue
      }
      g.globalAlpha = 1 - age / 0.5
      g.fillStyle = p.color
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * Math.PI * 2 + p.seed
        const d = 2 + age * 40
        g.beginPath()
        g.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 1.4 * (1 - age), 0, Math.PI * 2)
        g.fill()
      }
      g.globalAlpha = 1
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i]
      const age = time - p.t0
      if (age > 1.1) {
        popups.splice(i, 1)
        continue
      }
      g.globalAlpha = Math.min(1, 2.2 - age * 2)
      g.font = `900 ${p.size}px system-ui, sans-serif`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.lineWidth = 3
      g.strokeStyle = 'rgba(0,0,0,0.75)'
      g.strokeText(p.text, p.x, p.y - age * 22)
      g.fillStyle = p.color
      g.fillText(p.text, p.x, p.y - age * 22)
      g.globalAlpha = 1
    }
  }

  // ── The rifle (screen space) ───────────────────────────────────────────
  // Seen from behind the shooter's shoulder: it rises from the bottom of the
  // screen, under the scope, and points at its centre (it follows the aim).
  // Every part is a band along that axis, narrower further away, shaded
  // across like a cylinder; the scope sits on top, down the middle.
  const RIFLE_LOOKS = {
    carabine: { stock: ['#3b200e', '#a0622e', '#6b3d1e'], metal: ['#14161a', '#6a7282', '#2a2e36'], guard: ['#3b200e', '#9a5c2a', '#62381a'], bolt: true },
    precision: { stock: ['#262b1d', '#7a8560', '#454d36'], metal: ['#111311', '#5d6458', '#262a24'], guard: ['#262b1d', '#76815c', '#434a34'], bolt: true, brake: true },
    assaut: { stock: ['#0e0f11', '#55585f', '#24262a'], metal: ['#0b0c0e', '#4d5058', '#1d1f23'], guard: ['#0e0f11', '#50535a', '#222428'], rail: true },
  }
  const SCOPE_TUBE = ['#050506', '#4a4e57', '#16171a']

  // The rifle's picture: the stock comes in from the bottom right (the
  // shoulder) and the muzzle goes just inside the scope's ring, so the rifle
  // turns with the aim. Returns false until the picture has loaded.
  function drawRifleArt(rifle, cx, cy, R) {
    const sh = sheets[`fusil-${rifle}`]
    const art = RIFLE_ART[rifle]
    const f = sh?.manifest.frames.stand?.[0]
    if (!f || !art) return false
    const g = ctx
    const size = Math.min(cssW, cssH) * dpr
    const px0 = canvas.width / 2 + (cx - canvas.width / 2) * 0.5 + size * 0.16
    const py0 = canvas.height + size * 0.12
    const toward = Math.hypot(cx - px0, cy - py0) || 1
    const ux = (cx - px0) / toward
    const uy = (cy - py0) / toward
    const back = kick * size * 0.07
    const px = px0 - ux * back
    const py = py0 - uy * back
    const length = Math.max(size * 0.3, toward - R * 0.3)
    const [bx, by] = art.bottom
    const [mx, my] = art.muzzle
    const own = Math.hypot(mx - bx, my - by)
    const scale = length / own
    const angle = Math.atan2(uy, ux) - Math.atan2(my - by, mx - bx)
    g.save()
    g.translate(px, py)
    g.rotate(angle)
    g.scale(scale, scale)
    g.drawImage(sh.img, f.x, f.y, f.w, f.h, -bx, -by, f.w, f.h)
    g.restore()
    if (muzzle > 0) {
      // The flash shows just outside the ring, where the barrel goes under it.
      const d = toward - R * 1.08
      const fx = px0 + ux * d
      const fy = py0 + uy * d
      const r = size * 0.12 * muzzle
      const fl = g.createRadialGradient(fx, fy, 0, fx, fy, r)
      fl.addColorStop(0, 'rgba(255,250,220,0.95)')
      fl.addColorStop(0.35, 'rgba(255,190,80,0.75)')
      fl.addColorStop(1, 'rgba(255,120,40,0)')
      g.fillStyle = fl
      g.beginPath()
      g.arc(fx, fy, r, 0, Math.PI * 2)
      g.fill()
    }
    return true
  }

  function drawRifle(rifle, cx, cy, R) {
    if (drawRifleArt(rifle, cx, cy, R)) return
    const g = ctx
    const look = RIFLE_LOOKS[rifle] || RIFLE_LOOKS.carabine
    const size = Math.min(cssW, cssH) * dpr
    const width = canvas.width
    const height = canvas.height
    // Axis: from below the bottom edge (a little towards the middle) to just
    // under the scope's ring, pointing at its centre; pushed back by recoil.
    const nx = width / 2 + (cx - width / 2) * 0.55
    const ny = height + size * 0.32
    const dx0 = cx - nx
    const dy0 = cy - ny
    const full = Math.hypot(dx0, dy0) || 1
    const ux = dx0 / full
    const uy = dy0 / full
    const reach = Math.max(size * 0.3, full - R * 0.8)
    const back = kick * size * 0.06
    const sx = nx - ux * back
    const sy = ny - uy * back
    const px = -uy // across the rifle, to its right
    const py = ux
    const wNear = size * 0.46
    const wFar = size * 0.12
    const wid = (t) => wNear + (wFar - wNear) * t
    const at = (t, s) => {
      const w = (wid(t) / 2) * s
      return [sx + ux * reach * t + px * w, sy + uy * reach * t + py * w]
    }

    // A band from t0 to t1, half-width f0 → f1 (share of the rifle's width),
    // shifted sideways by `off`, shaded across with `colors` [dark, light, mid].
    function band(t0, t1, f0, f1, colors, off = 0) {
      const a = at(t0, off - f0)
      const b = at(t1, off - f1)
      const c = at(t1, off + f1)
      const d = at(t0, off + f0)
      const tm = (t0 + t1) / 2
      const fm = (f0 + f1) / 2
      const l = at(tm, off - fm)
      const r = at(tm, off + fm)
      const grad = g.createLinearGradient(l[0], l[1], r[0], r[1])
      grad.addColorStop(0, colors[0])
      grad.addColorStop(0.32, colors[1])
      grad.addColorStop(0.62, colors[2])
      grad.addColorStop(1, colors[0])
      g.fillStyle = grad
      g.beginPath()
      g.moveTo(a[0], a[1])
      g.lineTo(b[0], b[1])
      g.lineTo(c[0], c[1])
      g.lineTo(d[0], d[1])
      g.closePath()
      g.fill()
      g.strokeStyle = 'rgba(0,0,0,0.55)'
      g.lineWidth = Math.max(1, size * 0.002)
      g.stroke()
    }
    // A cross-section (end of a tube) at t: an ellipse seen from behind.
    function ring(t, f, fill, off = 0, squash = 0.32) {
      const [x, y] = at(t, off)
      const w = (wid(t) / 2) * f
      g.save()
      g.translate(x, y)
      g.rotate(Math.atan2(py, px))
      g.fillStyle = fill
      g.beginPath()
      g.ellipse(0, 0, w, w * squash, 0, 0, Math.PI * 2)
      g.fill()
      g.restore()
    }
    function line(t0, s0, t1, s1, color, lw) {
      const a = at(t0, s0)
      const b = at(t1, s1)
      g.strokeStyle = color
      g.lineWidth = lw
      g.beginPath()
      g.moveTo(a[0], a[1])
      g.lineTo(b[0], b[1])
      g.stroke()
    }

    g.save()
    g.lineJoin = 'round'
    g.lineCap = 'round'
    // Stock and cheek rest, receiver, handguard.
    band(0, 0.34, 1, 0.9, look.stock)
    band(0.05, 0.3, 0.35, 0.32, ['rgba(0,0,0,0.25)', 'rgba(255,255,255,0.12)', 'rgba(0,0,0,0.1)'], -0.45)
    band(0.32, 0.62, 0.74, 0.68, look.metal)
    // Ejection port and bolt (or the charging handle).
    band(0.42, 0.52, 0.2, 0.18, ['#050506', '#2b2d33', '#0d0e10'], 0.48)
    if (look.bolt) {
      line(0.43, 0.72, 0.4, 1.35, '#8a909c', size * 0.012)
      const [kx, ky] = at(0.4, 1.4)
      const knob = g.createRadialGradient(kx - size * 0.004, ky - size * 0.004, 0, kx, ky, size * 0.016)
      knob.addColorStop(0, '#c9ced8')
      knob.addColorStop(1, '#2a2d33')
      g.fillStyle = knob
      g.beginPath()
      g.arc(kx, ky, size * 0.016, 0, Math.PI * 2)
      g.fill()
    } else {
      band(0.36, 0.4, 0.12, 0.12, look.metal, -0.8)
    }
    band(0.6, 1, 0.62, 0.56, look.guard)
    if (look.rail) {
      for (let k = 0; k < 9; k++) {
        const t = 0.63 + k * 0.042
        line(t, -0.62, t, -0.42, 'rgba(0,0,0,0.6)', size * 0.004)
        line(t, 0.42, t, 0.62, 'rgba(0,0,0,0.6)', size * 0.004)
      }
    } else {
      // Chequering on the wood (or vents on the precision rifle's handguard).
      for (let k = 0; k < 6; k++) {
        const t = 0.66 + k * 0.05
        line(t, -0.55, t + 0.03, -0.35, 'rgba(0,0,0,0.35)', size * 0.003)
        line(t, 0.35, t + 0.03, 0.55, 'rgba(0,0,0,0.35)', size * 0.003)
      }
    }
    if (look.brake) band(0.93, 1, 0.3, 0.3, look.metal) // muzzle brake peeking out
    // Highlight down the left edge of the metal.
    line(0.33, -0.58, 0.61, -0.54, 'rgba(255,255,255,0.18)', size * 0.004)

    // The scope: eyepiece, tube, rings, turrets, objective bell.
    band(0.32, 0.4, 0.44, 0.42, SCOPE_TUBE)
    band(0.4, 0.86, 0.3, 0.3, SCOPE_TUBE)
    for (const t of [0.45, 0.75]) {
      band(t, t + 0.05, 0.46, 0.45, look.metal)
      const [sx1, sy1] = at(t + 0.025, 0.43)
      g.fillStyle = '#9aa0ab'
      g.beginPath()
      g.arc(sx1, sy1, size * 0.004, 0, Math.PI * 2)
      g.fill()
    }
    band(0.86, 1.02, 0.32, 0.5, SCOPE_TUBE)
    // Turrets: elevation on top, windage on the right, both knurled.
    ring(0.6, 0.3, '#1d1f24', 0, 0.9)
    ring(0.6, 0.22, '#3a3d45', 0, 0.9)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      const [tx, ty] = at(0.6, 0)
      const r = (wid(0.6) / 2) * 0.3
      g.strokeStyle = 'rgba(255,255,255,0.15)'
      g.lineWidth = Math.max(1, size * 0.002)
      g.beginPath()
      g.moveTo(tx + Math.cos(a) * r * 0.75, ty + Math.sin(a) * r * 0.75)
      g.lineTo(tx + Math.cos(a) * r, ty + Math.sin(a) * r)
      g.stroke()
    }
    band(0.57, 0.63, 0.2, 0.2, ['#0b0c0e', '#4a4e57', '#1a1b1f'], 0.48)
    // Eyepiece glass: dark, with a blue glint.
    ring(0.32, 0.44, '#020203')
    ring(0.32, 0.3, 'rgba(70,130,220,0.22)', -0.08, 0.25)
    // Highlight down the tube.
    line(0.4, -0.16, 0.86, -0.14, 'rgba(255,255,255,0.22)', size * 0.004)

    // Muzzle flash, at the far end under the scope.
    if (muzzle > 0) {
      const [fx, fy] = at(1.05, 0)
      const r = size * 0.16 * muzzle
      const fl = g.createRadialGradient(fx, fy, 0, fx, fy, r)
      fl.addColorStop(0, 'rgba(255,250,220,1)')
      fl.addColorStop(0.35, 'rgba(255,190,80,0.85)')
      fl.addColorStop(1, 'rgba(255,120,40,0)')
      g.fillStyle = fl
      g.beginPath()
      g.arc(fx, fy, r, 0, Math.PI * 2)
      g.fill()
    }
    g.restore()
  }

  // ── The scope ──────────────────────────────────────────────────────────
  function drawScope(cx, cy, R, zoom, aimWorld, aiming) {
    const g = ctx
    const rw = R / (s * dpr) / zoom // world radius seen through the lens
    g.save()
    g.beginPath()
    g.arc(cx, cy, R, 0, Math.PI * 2)
    g.clip()
    g.fillStyle = '#000'
    g.fillRect(cx - R, cy - R, R * 2, R * 2)
    g.drawImage(scene, (aimWorld.x - rw) * k, (aimWorld.y - rw) * k, rw * 2 * k, rw * 2 * k, cx - R, cy - R, R * 2, R * 2)
    const lens = g.createRadialGradient(cx, cy, R * 0.55, cx, cy, R)
    lens.addColorStop(0, 'rgba(0,0,0,0)')
    lens.addColorStop(0.85, 'rgba(0,0,0,0.35)')
    lens.addColorStop(1, 'rgba(0,0,0,0.85)')
    g.fillStyle = lens
    g.fillRect(cx - R, cy - R, R * 2, R * 2)
    g.fillStyle = 'rgba(120,170,255,0.05)'
    g.fillRect(cx - R, cy - R, R * 2, R * 2)
    // Reticle: thin cross, thick posts at the edge, mil dots, red centre.
    const ink = aiming ? '#b91c1c' : '#0a0a0a'
    g.strokeStyle = ink
    g.fillStyle = ink
    g.lineWidth = Math.max(1, R * 0.008)
    g.beginPath()
    g.moveTo(cx - R, cy)
    g.lineTo(cx + R, cy)
    g.moveTo(cx, cy - R)
    g.lineTo(cx, cy + R)
    g.stroke()
    const post = R * 0.035
    g.fillRect(cx - R, cy - post / 2, R * 0.45, post)
    g.fillRect(cx + R * 0.55, cy - post / 2, R * 0.45, post)
    g.fillRect(cx - post / 2, cy + R * 0.55, post, R * 0.45)
    for (let i = 1; i <= 4; i++) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        g.beginPath()
        g.arc(cx + dx * i * R * 0.1, cy + dy * i * R * 0.1, R * 0.011, 0, Math.PI * 2)
        g.fill()
      }
    }
    g.fillStyle = '#ef4444'
    g.beginPath()
    g.arc(cx, cy, Math.max(1.5, R * 0.012), 0, Math.PI * 2)
    g.fill()
    g.restore()
    // Housing.
    g.strokeStyle = '#050505'
    g.lineWidth = R * 0.09
    g.beginPath()
    g.arc(cx, cy, R + R * 0.04, 0, Math.PI * 2)
    g.stroke()
    g.strokeStyle = 'rgba(255,255,255,0.12)'
    g.lineWidth = Math.max(1, R * 0.012)
    g.beginPath()
    g.arc(cx, cy, R + R * 0.085, Math.PI * 1.1, Math.PI * 1.6)
    g.stroke()
  }

  function render(state, aim, time) {
    drawScene(state, time)
    const g = ctx
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.fillStyle = '#07090a'
    g.fillRect(0, 0, canvas.width, canvas.height)
    g.drawImage(scene, offX * dpr, offY * dpr, W * s * dpr, H * s * dpr)

    const cx = (offX + aim.x * s) * dpr
    const cy = (offY + aim.y * s) * dpr
    const R = scopeRadiusCss() * dpr
    // Everything outside the scope is seen with the naked eye: dimmer.
    g.fillStyle = 'rgba(0,0,0,0.38)'
    g.beginPath()
    g.rect(0, 0, canvas.width, canvas.height)
    g.arc(cx, cy, R * 1.04, 0, Math.PI * 2, true)
    g.fill('evenodd')

    drawRifle(state.rifle, cx, cy, R)
    const over = state.targets.some((t) => {
      if (t.state === 'hit' || t.row < 0 || KINDS[t.kind].protected) return false
      const { w, h } = sizeOf(t)
      const tx = t.x / FP
      const top = baseOf(t) - (h * shownOf(t)) / RISE_TICKS
      return Math.abs(aim.x - tx) <= w / 2 && aim.y >= top && aim.y <= baseOf(t)
    })
    drawScope(cx, cy, R, RIFLES[state.rifle].zoom, aim, over)

    if (flash > 0) {
      g.fillStyle = `rgba(220,30,30,${flash * 0.45})`
      g.fillRect(0, 0, canvas.width, canvas.height)
      flash = Math.max(0, flash - 0.04)
    }
    muzzle = Math.max(0, muzzle - 0.12)
    kick = Math.max(0, kick * 0.86 - 0.01)
  }

  function handleEvents(state, time) {
    for (const e of state.events) {
      if (e.type === 'hit') {
        const text = e.zone === 'head' ? `TÊTE ! +${e.points}` : e.zone === 'centre' ? `DANS LE MILLE ! +${e.points}` : `+${e.points}`
        popups.push({ x: e.x, y: e.y - 8, text, color: e.kind === 'or' ? '#fde047' : e.zone !== 'body' ? '#fbbf24' : '#ffffff', size: e.zone !== 'body' ? 12 : 11, t0: time })
        sparks.push({ x: e.x, y: e.y, t0: time, color: e.kind === 'monstre' ? '#a855f7' : e.kind === 'or' ? '#fde047' : '#fca5a5', seed: e.x })
      } else if (e.type === 'wound') {
        sparks.push({ x: e.x, y: e.y, t0: time, color: '#a855f7', seed: e.y })
      } else if (e.type === 'protected') {
        popups.push({ x: e.x, y: e.y - 8, text: 'ANIMAL PROTÉGÉ ! −50', color: '#f87171', size: 11, t0: time })
      } else if (e.type === 'miss') {
        sparks.push({ x: e.x, y: e.y, t0: time, color: '#d6c7a1', seed: e.x + e.y })
      } else if (e.type === 'attack') {
        flash = 1
      }
    }
  }

  function fired() {
    muzzle = 1
    kick = 1
  }

  return { resize, render, handleEvents, fired, toWorld, scopeRadiusCss: () => scopeRadiusCss() / s }
}
