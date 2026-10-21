import { FP, H, JETS, KINDS, SCROLL, W, ZONES } from '../../../../shared/escadrille-ogooue/engine.mjs'

// ESCADRILLE OGOUÉ's drawing: Gabon seen from the cockpit, scrolling north —
// the ocean along Libreville's coast, which narrows into the Ogooué through
// the forest, then the rocky Monts de Cristal — with the jets, the Serpent
// Noir's craft, bullets, explosions and parachutes on top, and clouds above
// everything. The ground is drawn in chunks once and cached. Purely visual:
// nothing here feeds back into the simulation.

const UNITS_PER_TICK = SCROLL / FP
const ZONE_V = ZONES.map((z) => z.from * UNITS_PER_TICK) // where each leg starts, in units flown
const CHUNK = 320 // ground chunk height, in units
const SPR = 3 // sprite canvases: px per unit

// ── Small helpers ──────────────────────────────────────────────────────────
function lcg(seed) {
  let n = (seed * 2654435761) >>> 0 || 1
  return () => {
    n = (Math.imul(n, 1103515245) + 12345) >>> 0
    return (n >>> 8) / 16777216
  }
}

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))
const lerp = (a, b, t) => a + (b - a) * t

function mix(c1, c2, t) {
  const a = parseInt(c1.slice(1), 16)
  const b = parseInt(c2.slice(1), 16)
  const r = Math.round(lerp(a >> 16, b >> 16, t))
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t))
  const bl = Math.round(lerp(a & 255, b & 255, t))
  return `rgb(${r},${g},${bl})`
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  return c
}

// A sprite drawn once at SPR px per unit, centred: size in units.
function sprite(w, h, draw) {
  const c = makeCanvas(w * SPR, h * SPR)
  const g = c.getContext('2d')
  g.scale(SPR, SPR)
  g.translate(w / 2, h / 2)
  draw(g)
  return { canvas: c, w, h }
}

// The same sprite as a flat dark silhouette, for its shadow on the ground.
function shadowOf(sp) {
  const c = makeCanvas(sp.canvas.width, sp.canvas.height)
  const g = c.getContext('2d')
  g.drawImage(sp.canvas, 0, 0)
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = '#000'
  g.fillRect(0, 0, c.width, c.height)
  return { canvas: c, w: sp.w, h: sp.h }
}

// Same sprite, lit white: shown for a few frames when hit.
function flashOf(sp) {
  const c = makeCanvas(sp.canvas.width, sp.canvas.height)
  const g = c.getContext('2d')
  g.drawImage(sp.canvas, 0, 0)
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = 'rgba(255,255,255,0.85)'
  g.fillRect(0, 0, c.width, c.height)
  return { canvas: c, w: sp.w, h: sp.h }
}

function blit(g, sp, x, y, angle = 0, scale = 1) {
  if (!angle && scale === 1) {
    g.drawImage(sp.canvas, x - sp.w / 2, y - sp.h / 2, sp.w, sp.h)
    return
  }
  g.save()
  g.translate(x, y)
  if (angle) g.rotate(angle)
  if (scale !== 1) g.scale(scale, scale)
  g.drawImage(sp.canvas, -sp.w / 2, -sp.h / 2, sp.w, sp.h)
  g.restore()
}

function poly(g, pts, fill, stroke, lw = 0.6) {
  g.beginPath()
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  g.closePath()
  if (fill) {
    g.fillStyle = fill
    g.fill()
  }
  if (stroke) {
    g.lineWidth = lw
    g.strokeStyle = stroke
    g.stroke()
  }
}

// Mirrors the right half of a shape (points with x ≥ 0) into a whole one.
function mirrored(half) {
  return [...half, ...half.slice().reverse().map(([x, y]) => [-x, y])]
}

// ── The jets (facing north) ────────────────────────────────────────────────
const FLAG = ['#009e60', '#fcd116', '#3a75c4']

const JET_LOOKS = {
  aigle: {
    body: '#6f7d64',
    dark: '#465140',
    light: '#97a58a',
    fuselage: mirrored([[0, -21], [2, -15], [3, -6], [3, 14], [2, 19]]),
    wing: mirrored([[3, -6], [18, 7], [18, 10], [3, 8]]),
    tail: mirrored([[3, 12], [10, 17], [10, 19], [2, 18]]),
    canopy: [0, -11, 1.8, 4.5],
    engines: [[0, 20]],
    size: [38, 44],
  },
  faucon: {
    body: '#94a7ba',
    dark: '#5d6f82',
    light: '#c5d3e0',
    fuselage: mirrored([[0, -23], [1.6, -16], [2.6, -6], [2.6, 15], [1.8, 19]]),
    wing: mirrored([[2.6, -2], [15, 10], [15, 12.5], [2.6, 9]]),
    tail: mirrored([[2.4, 13], [8, 18.5], [8, 20], [2, 19]]),
    canopy: [0, -12, 1.5, 4.5],
    engines: [[0, 20]],
    size: [32, 46],
  },
  calao: {
    body: '#46613f',
    dark: '#2d4029',
    light: '#6f8a62',
    fuselage: mirrored([[0, -20], [3, -15], [5, -7], [5, 14], [4.5, 18]]),
    wing: mirrored([[5, -4], [20, 4], [20, 9], [5, 8]]),
    tail: mirrored([[4.5, 11], [12, 15], [12, 18], [4, 17]]),
    canopy: [0, -10, 2.2, 5],
    engines: [[-2.6, 19], [2.6, 19]],
    beak: '#f0a32a', // the hornbill's beak on the nose
    size: [42, 42],
  },
}

function drawJetShape(g, id) {
  const L = JET_LOOKS[id]
  const grad = g.createLinearGradient(-20, 0, 20, 0)
  grad.addColorStop(0, L.dark)
  grad.addColorStop(0.5, L.light)
  grad.addColorStop(1, L.dark)
  poly(g, L.wing, L.body, '#1c2219', 0.5)
  // wing camo / panel lines
  g.save()
  g.globalAlpha = 0.35
  g.strokeStyle = L.dark
  g.lineWidth = 0.5
  for (const side of [-1, 1]) {
    g.beginPath()
    g.moveTo(side * 6, 1)
    g.lineTo(side * 15, 7)
    g.stroke()
  }
  g.restore()
  poly(g, L.tail, L.body, '#1c2219', 0.5)
  // the tail stripes, green-yellow-blue
  for (const side of [-1, 1]) {
    FLAG.forEach((c, i) => {
      g.fillStyle = c
      g.fillRect(side > 0 ? 5.5 + i * 1.2 : -6.7 - i * 1.2, 15, 1.2, 3)
    })
  }
  poly(g, L.fuselage, grad, '#1c2219', 0.5)
  if (L.beak) {
    poly(g, [[0, -20], [3, -15], [3.6, -12.5], [-3.6, -12.5], [-3, -15]], L.beak, '#7a4a10', 0.4)
  }
  // canopy
  const [cx, cy, rx, ry] = L.canopy
  const cg = g.createLinearGradient(cx, cy - ry, cx, cy + ry)
  cg.addColorStop(0, '#d8f4ff')
  cg.addColorStop(0.4, '#3fa7d6')
  cg.addColorStop(1, '#0b2a40')
  g.beginPath()
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  g.fillStyle = cg
  g.fill()
  g.lineWidth = 0.4
  g.strokeStyle = '#0d1a22'
  g.stroke()
  // missiles under the wings
  g.fillStyle = '#d9d9d9'
  for (const side of [-1, 1]) g.fillRect(side * 11 - 0.6, 0, 1.2, 7)
  // nozzles
  for (const [ex, ey] of L.engines) {
    g.beginPath()
    g.ellipse(ex, ey, 1.9, 1.1, 0, 0, Math.PI * 2)
    g.fillStyle = '#2a2a2a'
    g.fill()
  }
}

// ── The Serpent Noir's craft (facing south) ────────────────────────────────
const SERPENT = '#c0392b'

function drawSerpentMark(g, x, y, r) {
  g.save()
  g.strokeStyle = SERPENT
  g.lineWidth = r * 0.35
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(x - r, y - r * 0.6)
  g.bezierCurveTo(x + r, y - r, x - r, y + r, x + r, y + r * 0.6)
  g.stroke()
  g.fillStyle = SERPENT
  g.beginPath()
  g.arc(x + r, y + r * 0.6, r * 0.32, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

function makeSprites() {
  const jets = {}
  for (const id of Object.keys(JETS)) {
    const [w, h] = JET_LOOKS[id].size
    jets[id] = sprite(w, h, (g) => drawJetShape(g, id))
    jets[id].shadow = shadowOf(jets[id])
    jets[id].flash = flashOf(jets[id])
  }

  const drone = sprite(26, 26, (g) => {
    g.strokeStyle = '#2b2f33'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(-8, -8)
    g.lineTo(8, 8)
    g.moveTo(8, -8)
    g.lineTo(-8, 8)
    g.stroke()
    for (const [x, y] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) {
      g.beginPath()
      g.arc(x, y, 2.2, 0, Math.PI * 2)
      g.fillStyle = '#1a1d20'
      g.fill()
    }
    const bg = g.createRadialGradient(-1, -1, 0, 0, 0, 5)
    bg.addColorStop(0, '#5a6066')
    bg.addColorStop(1, '#202428')
    g.beginPath()
    if (g.roundRect) g.roundRect(-4.5, -5, 9, 10, 2.5)
    else g.rect(-4.5, -5, 9, 10)
    g.fillStyle = bg
    g.fill()
    g.fillStyle = SERPENT
    g.fillRect(-4.5, -1, 9, 1.4)
    // camera
    g.beginPath()
    g.arc(0, 4, 1.6, 0, Math.PI * 2)
    g.fillStyle = '#0b0b0b'
    g.fill()
  })

  const avion = sprite(34, 34, (g) => {
    // facing south: nose at +y
    poly(g, mirrored([[0, 16], [2.4, 10], [3, 0], [2.6, -12], [1.6, -15]]), '#24272b', '#0b0c0d', 0.5)
    poly(g, mirrored([[2.8, 2], [16, -4], [16, -7], [2.8, -5]]), '#2f3338', '#0b0c0d', 0.5)
    poly(g, mirrored([[2.2, -10], [8, -14], [8, -16], [1.6, -15]]), '#2f3338', '#0b0c0d', 0.5)
    // red zigzag on the wings
    g.strokeStyle = SERPENT
    g.lineWidth = 1
    for (const side of [-1, 1]) {
      g.beginPath()
      g.moveTo(side * 5, -3)
      g.lineTo(side * 8, -5)
      g.lineTo(side * 11, -3.5)
      g.lineTo(side * 14, -5.5)
      g.stroke()
    }
    g.beginPath()
    g.ellipse(0, 6, 1.6, 3.6, 0, 0, Math.PI * 2)
    g.fillStyle = '#c94f2a'
    g.fill()
    g.fillStyle = '#bbb'
    for (const side of [-1, 1]) g.fillRect(side * 9 - 0.5, -3, 1, 5)
  })

  const helico = sprite(30, 48, (g) => {
    // facing south: cabin at +y, tail boom north
    poly(g, [[-1.2, -4], [1.2, -4], [0.9, -21], [-0.9, -21]], '#2a2d31', '#0b0c0d', 0.4)
    poly(g, [[-5, -21], [5, -21], [5, -19], [-5, -19]], '#2a2d31', '#0b0c0d', 0.4)
    const cg = g.createRadialGradient(-2, 4, 1, 0, 3, 10)
    cg.addColorStop(0, '#4d535a')
    cg.addColorStop(1, '#1d2023')
    g.beginPath()
    g.ellipse(0, 3, 7, 11, 0, 0, Math.PI * 2)
    g.fillStyle = cg
    g.fill()
    g.lineWidth = 0.5
    g.strokeStyle = '#0b0c0d'
    g.stroke()
    // cockpit glass
    g.beginPath()
    g.ellipse(0, 9.5, 4.5, 3.4, 0, 0, Math.PI)
    g.fillStyle = '#2d6f8f'
    g.fill()
    // gun pods
    g.fillStyle = '#121416'
    g.fillRect(-9.5, 0, 3, 7)
    g.fillRect(6.5, 0, 3, 7)
    drawSerpentMark(g, 0, -2, 3)
  })

  const vedette = sprite(36, 16, (g) => {
    // facing east (flipped for boats going west)
    poly(g, [[-16, -6], [8, -6], [17, 0], [8, 6], [-16, 6]], '#f1f1ec', '#555', 0.5)
    poly(g, [[-16, -6], [8, -6], [10, -4.5], [-16, -4.5]], SERPENT)
    poly(g, [[-16, 4.5], [10, 4.5], [8, 6], [-16, 6]], SERPENT)
    g.fillStyle = '#2b3036'
    g.fillRect(-6, -3, 9, 6)
    g.fillStyle = '#5ab0d6'
    g.fillRect(1, -2.5, 2, 5)
    g.beginPath()
    g.arc(-11, 0, 2, 0, Math.PI * 2)
    g.fillStyle = '#1a1a1a'
    g.fill()
  })

  const tourellePad = sprite(40, 40, (g) => {
    const pts = Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4 + Math.PI / 8) * 18, Math.sin((i * Math.PI) / 4 + Math.PI / 8) * 18])
    poly(g, pts, '#8c8a80', '#4e4c45', 0.8)
    // sandbags
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      g.beginPath()
      g.ellipse(Math.cos(a) * 12, Math.sin(a) * 12, 3, 2, a + Math.PI / 2, 0, Math.PI * 2)
      g.fillStyle = i % 2 ? '#b59a68' : '#a08657'
      g.fill()
    }
    g.beginPath()
    g.arc(0, 0, 8.5, 0, Math.PI * 2)
    g.fillStyle = '#5d6150'
    g.fill()
  })

  const tourelleGun = sprite(28, 28, (g) => {
    // barrels toward +x (rotated to aim)
    g.fillStyle = '#23261f'
    g.fillRect(2, -3, 12, 2)
    g.fillRect(2, 1, 12, 2)
    g.beginPath()
    g.arc(0, 0, 6, 0, Math.PI * 2)
    g.fillStyle = '#3c4234'
    g.fill()
    g.lineWidth = 0.6
    g.strokeStyle = '#1a1c16'
    g.stroke()
    drawSerpentMark(g, -0.5, 0, 2.4)
  })

  const boss = sprite(160, 80, (g) => {
    // the Condor Noir, a flying wing, facing south (leading edge at +y)
    const wing = mirrored([[0, 26], [24, 20], [78, -6], [76, -12], [52, -10], [40, -22], [20, -16], [0, -20]])
    const wg = g.createLinearGradient(0, -24, 0, 28)
    wg.addColorStop(0, '#15181c')
    wg.addColorStop(0.6, '#2b3036')
    wg.addColorStop(1, '#3a4047')
    poly(g, wing, wg, '#07080a', 0.8)
    // panel lines
    g.strokeStyle = 'rgba(255,255,255,0.06)'
    g.lineWidth = 0.6
    for (let i = -3; i <= 3; i++) {
      g.beginPath()
      g.moveTo(i * 16, 18 - Math.abs(i) * 5)
      g.lineTo(i * 18, -14)
      g.stroke()
    }
    // engines (exhaust north) and gun pods
    for (const x of [-46, -22, 22, 46]) {
      g.fillStyle = '#0d0f12'
      g.fillRect(x - 4, -18, 8, 14)
      g.beginPath()
      g.ellipse(x, -18, 4, 1.8, 0, 0, Math.PI * 2)
      g.fillStyle = '#3a1a10'
      g.fill()
    }
    for (const x of [-34, 34]) {
      g.beginPath()
      g.arc(x, 4, 5, 0, Math.PI * 2)
      g.fillStyle = '#1b1e22'
      g.fill()
      g.fillStyle = '#0a0a0a'
      g.fillRect(x - 1, 4, 2, 9)
    }
    // cockpit
    g.beginPath()
    g.ellipse(0, 16, 7, 5, 0, 0, Math.PI * 2)
    g.fillStyle = '#7a1f1a'
    g.fill()
    drawSerpentMark(g, 0, -4, 9)
    // red trim along the leading edge
    g.strokeStyle = SERPENT
    g.lineWidth = 1.2
    g.beginPath()
    g.moveTo(-78, -6)
    g.lineTo(-24, 20)
    g.lineTo(0, 26)
    g.lineTo(24, 20)
    g.lineTo(78, -6)
    g.stroke()
  })

  const all = { drone, avion, helico, vedette, tourellePad, tourelleGun, boss }
  for (const key of ['drone', 'avion', 'helico', 'boss']) {
    all[key].shadow = shadowOf(all[key])
  }
  for (const key of Object.keys(all)) all[key].flash = flashOf(all[key])

  // Bullets.
  const orb = sprite(16, 16, (g) => {
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, 8)
    rg.addColorStop(0, '#ffffff')
    rg.addColorStop(0.22, '#ffe08a')
    rg.addColorStop(0.4, '#ff6a24')
    rg.addColorStop(0.65, 'rgba(235,40,60,0.55)')
    rg.addColorStop(1, 'rgba(235,40,60,0)')
    g.fillStyle = rg
    g.fillRect(-8, -8, 16, 16)
  })
  const tracer = sprite(6, 14, (g) => {
    const lg = g.createLinearGradient(0, -7, 0, 7)
    lg.addColorStop(0, '#fffbe0')
    lg.addColorStop(0.5, '#ffd84a')
    lg.addColorStop(1, 'rgba(255,170,0,0)')
    g.fillStyle = lg
    g.beginPath()
    g.ellipse(0, 0, 1.4, 7, 0, 0, Math.PI * 2)
    g.fill()
  })

  // Bonuses.
  const capsule = (color, letter) =>
    sprite(22, 22, (g) => {
      const rg = g.createRadialGradient(-3, -3, 1, 0, 0, 10)
      rg.addColorStop(0, '#ffffff')
      rg.addColorStop(0.25, color)
      rg.addColorStop(1, mix(color, '#000000', 0.45))
      g.beginPath()
      g.arc(0, 0, 9, 0, Math.PI * 2)
      g.fillStyle = rg
      g.fill()
      g.lineWidth = 1
      g.strokeStyle = 'rgba(255,255,255,0.8)'
      g.stroke()
      g.fillStyle = '#fff'
      g.font = 'bold 11px system-ui, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(letter, 0, 0.8)
    })
  const bonus = {
    power: capsule('#e74c3c', 'P'),
    bomb: capsule('#f39c12', 'B'),
    repair: capsule('#27ae60', '+'),
    ngori: sprite(22, 22, (g) => {
      const rg = g.createRadialGradient(-3, -3, 1, 0, 0, 10)
      rg.addColorStop(0, '#fff7c2')
      rg.addColorStop(0.4, '#f5c518')
      rg.addColorStop(1, '#a8740a')
      g.beginPath()
      g.arc(0, 0, 9, 0, Math.PI * 2)
      g.fillStyle = rg
      g.fill()
      g.lineWidth = 1.2
      g.strokeStyle = '#7a5208'
      g.stroke()
      g.fillStyle = '#7a5208'
      g.font = 'bold 11px system-ui, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('N', 0, 0.8)
    }),
  }

  const clouds = [0, 1, 2].map((i) =>
    // every puff stays inside the sprite, or its edge shows as a straight cut
    sprite(200, 130, (g) => {
      const rnd = lcg(i * 31 + 7)
      for (let k = 0; k < 14; k++) {
        const x = (rnd() - 0.5) * 100
        const y = (rnd() - 0.5) * 40
        const r = 16 + rnd() * 22
        const rg = g.createRadialGradient(x, y, 0, x, y, r)
        rg.addColorStop(0, 'rgba(255,255,255,0.75)')
        rg.addColorStop(0.6, 'rgba(255,255,255,0.35)')
        rg.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = rg
        g.fillRect(x - r, y - r, r * 2, r * 2)
      }
    }),
  )

  return { jets, ...all, orb, tracer, bonus, clouds }
}

let SPRITES = null
function sprites() {
  SPRITES ||= makeSprites()
  return SPRITES
}

// Draws one jet, for the lobby's choice cards.
export function drawJetPreview(canvas, id) {
  const g = canvas.getContext('2d')
  const sp = sprites().jets[id]
  const sc = Math.min(canvas.width / sp.w, canvas.height / sp.h) * 0.9
  g.clearRect(0, 0, canvas.width, canvas.height)
  g.save()
  g.translate(canvas.width / 2, canvas.height / 2)
  g.scale(sc, sc)
  g.drawImage(sp.canvas, -sp.w / 2, -sp.h / 2, sp.w, sp.h)
  g.restore()
}

// ── The ground ─────────────────────────────────────────────────────────────
function coastX(v) {
  return 118 + 46 * Math.sin(v / 170) + 18 * Math.sin(v / 53)
}
function riverX(v) {
  return 180 + 80 * Math.sin(v / 240) + 24 * Math.sin(v / 83)
}

// How much of each leg (0 coast, 1 river, 2 mountains) a point of the ground belongs to.
function legs(v) {
  const t1 = smooth((v - (ZONE_V[1] - 700)) / 700)
  const t2 = smooth((v - (ZONE_V[2] - 500)) / 500)
  return [1 - t1, t1 * (1 - t2), t2]
}

// The water at a point of the ground: [left, right] edges.
function waterAt(v) {
  const t1 = smooth((v - (ZONE_V[1] - 700)) / 700)
  const t2 = smooth((v - (ZONE_V[2] - 500)) / 500)
  const rx = riverX(v)
  const width = lerp(66 + 18 * Math.sin(v / 130), 14, t2)
  const left = lerp(coastX(v), rx - width / 2, t1)
  const right = lerp(W + 60, rx + width / 2, t1)
  return [left, right]
}

const LAND = ['#3f6d2f', '#2b5223', '#55614a']
const WATER = ['#16607f', '#3d6a5c', '#4f7f86']
const TREE = [
  ['#284f20', '#3a7130', '#5d9a45'],
  ['#1b4119', '#2a6025', '#4a8a3a'],
  ['#2a4424', '#3e5f35', '#5d7d50'],
]

function blendColor(colors, w) {
  const first = mix(colors[0], colors[1], w[1] + w[2])
  if (w[2] <= 0) return first
  return mix(colors[1], colors[2], w[2] / (w[1] + w[2] || 1))
}

// The trees of a chunk, the same every time ([x, v, radius]): its neighbours
// draw the ones that overhang their edge too, so the canopy has no seams.
function treesOf(c) {
  const rnd = lcg(c * 7919 + 3)
  const out = []
  const count = 300 - Math.round(150 * legs((c + 0.5) * CHUNK)[2])
  for (let i = 0; i < count; i++) {
    const v = (c + rnd()) * CHUNK
    const x = rnd() * W
    const size = 4 + rnd() * 6
    const [L, R] = waterAt(v)
    if (x > L - size - 6 && x < R + size + 6) continue
    if (v < 2600 && x < L - 24 && rnd() < 0.8) continue // the town
    out.push([x, v, size])
  }
  return out
}

function renderChunk(c, k) {
  const canvas = makeCanvas(W * k, CHUNK * k)
  const g = canvas.getContext('2d')
  g.scale(k, k)
  const vTop = (c + 1) * CHUNK
  const vAt = (r) => vTop - r
  const rnd = lcg(c * 977 + 13)
  const STRIP = 4

  // Land and water, strip by strip.
  for (let r = 0; r < CHUNK; r += STRIP) {
    const v = vAt(r + STRIP / 2)
    const w = legs(v)
    g.fillStyle = blendColor(LAND, w)
    g.fillRect(0, r, W, STRIP + 0.5)
    const [L, R] = waterAt(v)
    if (v < 0) continue
    g.fillStyle = blendColor(WATER, w)
    g.fillRect(L, r, R - L, STRIP + 0.5)
    // shallow water along the shore
    g.fillStyle = 'rgba(120,200,210,0.18)'
    g.fillRect(L, r, Math.min(14, R - L), STRIP + 0.5)
    if (R < W) g.fillRect(R - Math.min(10, R - L), r, Math.min(10, R - L), STRIP + 0.5)
  }

  // Shores: sand on the coast, mud banks on the river, rocks in the mountains.
  // (strip by strip, so the width and colour match across chunk edges)
  g.lineCap = 'round'
  for (const side of [0, 1]) {
    for (let r = -STRIP; r <= CHUNK; r += STRIP) {
      const v = vAt(r + STRIP / 2)
      const w = legs(v)
      const x0 = waterAt(vAt(r))[side]
      const x1 = waterAt(vAt(r + STRIP))[side]
      g.beginPath()
      g.moveTo(x0, r)
      g.lineTo(x1, r + STRIP)
      g.lineWidth = lerp(9, 4, w[1] + w[2])
      g.strokeStyle = blendColor(['#d8c48e', '#9c8a5c', '#8a8a80'], w)
      g.stroke()
    }
    g.beginPath()
    for (let r = -STRIP; r <= CHUNK + STRIP; r += STRIP) {
      const x = waterAt(vAt(r))[side]
      if (r > -STRIP) g.lineTo(x, r)
      else g.moveTo(x, r)
    }
    g.lineWidth = 1.2
    g.strokeStyle = 'rgba(255,255,255,0.55)'
    g.stroke()
  }
  g.lineCap = 'butt'

  // Waves on the water.
  g.strokeStyle = 'rgba(255,255,255,0.22)'
  g.lineWidth = 0.8
  for (let i = 0; i < 70; i++) {
    const r = rnd() * CHUNK
    const [L, R] = waterAt(vAt(r))
    const x = L + 8 + rnd() * Math.max(0, Math.min(R, W) - L - 16)
    if (x > R - 6) continue
    g.beginPath()
    g.moveTo(x - 4, r)
    g.quadraticCurveTo(x, r - 1.5, x + 4, r)
    g.stroke()
  }

  // Libreville: blocks of houses and a road along the coast, at the start.
  if (vTop - CHUNK < 2600) {
    for (let i = 0; i < 46; i++) {
      const r = rnd() * CHUNK
      const v = vAt(r)
      if (v > 2600 || v < 0) continue
      const coast = waterAt(v)[0]
      const x = 6 + rnd() * (coast - 30)
      if (x > coast - 22) continue
      const bw = 6 + rnd() * 8
      const bh = 5 + rnd() * 7
      g.fillStyle = 'rgba(0,0,0,0.25)'
      g.fillRect(x + 1.5, r + 1.5, bw, bh)
      g.fillStyle = ['#c0533a', '#e6e2d6', '#9a9a92', '#d18b4a', '#5f8fb0'][Math.floor(rnd() * 5)]
      g.fillRect(x, r, bw, bh)
      g.fillStyle = 'rgba(255,255,255,0.18)'
      g.fillRect(x, r, bw, bh / 2)
    }
    g.beginPath()
    for (let r = 0; r <= CHUNK; r += STRIP) {
      const v = vAt(r)
      const x = waterAt(v)[0] - 16
      if (r) g.lineTo(x, r)
      else g.moveTo(x, r)
    }
    g.lineWidth = 4
    g.strokeStyle = '#55575a'
    g.stroke()
    g.setLineDash([3, 4])
    g.lineWidth = 0.6
    g.strokeStyle = '#e8e2c8'
    g.stroke()
    g.setLineDash([])
  }

  // Mountain ridges and rocks.
  const wMid = legs(vAt(CHUNK / 2))
  if (wMid[2] > 0.05) {
    const ridges = Math.round(5 * wMid[2])
    for (let i = 0; i < ridges; i++) {
      let x = rnd() * W
      let r = rnd() * CHUNK
      g.beginPath()
      g.moveTo(x, r)
      const pts = [[x, r]]
      for (let s = 0; s < 8; s++) {
        x += 10 + rnd() * 14
        r += (rnd() - 0.5) * 22
        pts.push([x, r])
        g.lineTo(x, r)
      }
      g.lineWidth = 7
      g.strokeStyle = 'rgba(40,46,36,0.35)'
      g.stroke()
      g.beginPath()
      pts.forEach(([px, py], j) => (j ? g.lineTo(px, py - 2) : g.moveTo(px, py - 2)))
      g.lineWidth = 2
      g.strokeStyle = 'rgba(210,214,200,0.35)'
      g.stroke()
    }
    for (let i = 0; i < 40 * wMid[2]; i++) {
      const x = rnd() * W
      const r = rnd() * CHUNK
      const [L, R] = waterAt(vAt(r))
      if (x > L - 6 && x < R + 6) continue
      const s = 2 + rnd() * 5
      g.beginPath()
      g.ellipse(x, r, s * 1.3, s, rnd() * 3, 0, Math.PI * 2)
      g.fillStyle = ['#7d8276', '#9aa093', '#c9cdc2'][Math.floor(rnd() * 3)]
      g.fill()
    }
  }

  // The forest canopy.
  const trees = []
  for (const n of [c - 1, c, c + 1]) {
    for (const [x, v, size] of treesOf(n)) {
      const r = vTop - v
      if (r > -12 && r < CHUNK + 12) trees.push([x, r, size, legs(v)])
    }
  }
  trees.sort((a, b) => a[1] - b[1])
  for (const [x, r, size, w] of trees) {
    const zone = w[0] >= w[1] && w[0] >= w[2] ? 0 : w[1] >= w[2] ? 1 : 2
    const [dark, mid, light] = TREE[zone]
    g.beginPath()
    g.arc(x + 1.6, r + 2, size, 0, Math.PI * 2)
    g.fillStyle = 'rgba(0,0,0,0.28)'
    g.fill()
    g.beginPath()
    g.arc(x, r, size, 0, Math.PI * 2)
    g.fillStyle = dark
    g.fill()
    g.beginPath()
    g.arc(x - size * 0.2, r - size * 0.2, size * 0.72, 0, Math.PI * 2)
    g.fillStyle = mid
    g.fill()
    g.beginPath()
    g.arc(x - size * 0.38, r - size * 0.4, size * 0.34, 0, Math.PI * 2)
    g.fillStyle = light
    g.fill()
  }
  return canvas
}

// ── The renderer ───────────────────────────────────────────────────────────
export function createEscadrilleRenderer(canvas) {
  const ctx = canvas.getContext('2d')
  const S = sprites()
  let cssW = 1
  let cssH = 1
  let dpr = 1
  let s = 1 // css px per world unit
  let offX = 0
  let offY = 0
  let k = 2 // ground chunk px per unit
  const chunks = new Map()
  const fx = [] // explosions, smoke, sparks
  const chutes = [] // parachutes
  const popups = []
  let shake = 0
  let flash = 0 // white, after a bomb
  let hurt = 0 // red, after a hit
  let bombRing = null
  let lastTick = -1

  function resize(w, h) {
    cssW = Math.max(1, w)
    cssH = Math.max(1, h)
    dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    s = Math.min(cssW / W, cssH / H)
    offX = (cssW - W * s) / 2
    offY = (cssH - H * s) / 2
    const nk = Math.min(3, Math.max(1, Math.round(s * dpr * 10) / 10))
    if (nk !== k) {
      k = nk
      chunks.clear()
    }
  }

  const toWorld = (px, py) => ({ x: (px - offX) / s, y: (py - offY) / s })
  const scale = () => s

  function chunk(c) {
    let cv = chunks.get(c)
    if (!cv) {
      cv = renderChunk(c, k)
      chunks.set(c, cv)
      for (const key of chunks.keys()) if (key < c - 2) chunks.delete(key)
    }
    return cv
  }

  function drawGround(g, flown) {
    const first = Math.floor(flown / CHUNK)
    const last = Math.floor((flown + H) / CHUNK)
    for (let c = first; c <= last; c++) {
      const top = H + flown - (c + 1) * CHUNK
      g.drawImage(chunk(c), 0, top, W, CHUNK)
    }
  }

  // ── Effects ──────────────────────────────────────────────────────────────
  function explode(x, y, size) {
    shake = Math.max(shake, size * 0.25)
    fx.push({ type: 'ring', x, y, t: 0, life: 18, r: size * 1.6 })
    fx.push({ type: 'fire', x, y, t: 0, life: 26 + size, r: size })
    for (let i = 0; i < 4 + size / 3; i++) {
      const a = Math.random() * Math.PI * 2
      const d = Math.random() * size * 0.7
      fx.push({ type: 'fire', x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, t: -Math.random() * 8, life: 18 + Math.random() * 14, r: size * (0.35 + Math.random() * 0.4) })
    }
    for (let i = 0; i < 6 + size / 2; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 1 + Math.random() * 3
      fx.push({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 20 + Math.random() * 20 })
    }
    for (let i = 0; i < 3 + size / 6; i++) {
      fx.push({ type: 'smoke', x: x + (Math.random() - 0.5) * size, y: y + (Math.random() - 0.5) * size, t: -6 - Math.random() * 10, life: 60 + Math.random() * 30, r: size * 0.5 })
    }
  }

  function handleEvents(state) {
    if (state.tick === lastTick) return
    lastTick = state.tick
    for (const e of state.events) {
      const x = e.x / FP
      const y = e.y / FP
      if (e.type === 'kill') {
        const size = e.kind === 'boss' ? 60 : e.kind === 'helico' || e.kind === 'tourelle' ? 22 : e.kind === 'drone' ? 10 : 16
        explode(x, y, size)
        if (e.kind === 'boss') {
          for (let i = 0; i < 10; i++) setTimeout(() => explode(x + (Math.random() - 0.5) * 140, y + (Math.random() - 0.5) * 50, 26), i * 140)
        }
        if (e.crew) chutes.push({ x, y, t: 0, sway: Math.random() * 6 })
        popups.push({ x, y, text: `+${e.points}`, t: 0, big: e.multiplier > 1 || e.kind === 'boss' })
      } else if (e.type === 'bonus') {
        popups.push({ x, y, text: e.kind === 'ngori' ? `+${e.points}` : { power: 'PUISSANCE +', bomb: 'BOMBE +', repair: 'RÉPARÉ +' }[e.kind], t: 0, big: false })
        fx.push({ type: 'ring', x, y, t: 0, life: 14, r: 18, color: '#ffe680' })
      } else if (e.type === 'hurt') {
        hurt = 1
        shake = Math.max(shake, 7)
        fx.push({ type: 'fire', x, y, t: 0, life: 16, r: 8 })
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2
          fx.push({ type: 'spark', x, y, vx: Math.cos(a) * 2.5, vy: Math.sin(a) * 2.5, t: 0, life: 18 })
        }
      } else if (e.type === 'down') {
        explode(x, y, 30)
        chutes.push({ x, y, t: 0, sway: 0, mine: true })
      } else if (e.type === 'bomb') {
        flash = 1
        shake = 12
        bombRing = { x, y, t: 0 }
      }
    }
  }

  // ── Drawing ──────────────────────────────────────────────────────────────
  function drawRotor(g, x, y, r, time, blades = 2) {
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fillStyle = 'rgba(30,30,30,0.18)'
    g.fill()
    g.strokeStyle = 'rgba(20,20,20,0.55)'
    g.lineWidth = r * 0.12
    const a0 = time * 40
    for (let i = 0; i < blades; i++) {
      const a = a0 + (i * Math.PI * 2) / blades
      g.beginPath()
      g.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r)
      g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
      g.stroke()
    }
  }

  function flameAt(g, x, y, len, w) {
    const fl = g.createLinearGradient(x, y, x, y + len)
    fl.addColorStop(0, 'rgba(255,255,255,0.95)')
    fl.addColorStop(0.25, 'rgba(255,214,90,0.9)')
    fl.addColorStop(0.7, 'rgba(255,110,30,0.5)')
    fl.addColorStop(1, 'rgba(255,60,20,0)')
    g.fillStyle = fl
    g.beginPath()
    g.moveTo(x - w, y)
    g.quadraticCurveTo(x, y + len * 1.2, x + w, y)
    g.fill()
  }

  function drawEnemy(g, e, state, time, shadow) {
    const x = e.x / FP
    const y = e.y / FP
    const lit = e.flash > 0
    if (e.kind === 'drone') {
      if (shadow) return blit(g, S.drone.shadow, x + 10, y + 16)
      blit(g, lit ? S.drone.flash : S.drone, x, y)
      for (const [dx, dy] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) drawRotor(g, x + dx, y + dy, 5, time + dx, 2)
      if (Math.floor(time * 4) % 2) {
        g.fillStyle = '#ff3b30'
        g.fillRect(x - 0.8, y - 3.5, 1.6, 1.6)
      }
    } else if (e.kind === 'avion') {
      const angle = Math.atan2(e.vy, e.vx) - Math.PI / 2
      if (shadow) return blit(g, S.avion.shadow, x + 14, y + 22, angle)
      blit(g, lit ? S.avion.flash : S.avion, x, y, angle)
      // propeller at the nose
      const nx = x - Math.sin(angle) * 16
      const ny = y + Math.cos(angle) * 16
      g.beginPath()
      g.ellipse(nx, ny, 5, 1.2, angle, 0, Math.PI * 2)
      g.fillStyle = 'rgba(40,40,40,0.35)'
      g.fill()
    } else if (e.kind === 'helico') {
      if (shadow) return blit(g, S.helico.shadow, x + 16, y + 26)
      blit(g, lit ? S.helico.flash : S.helico, x, y)
      drawRotor(g, x, y + 2, 22, time, 4)
      drawRotor(g, x + 5, y - 20, 4, time * 1.5, 2)
    } else if (e.kind === 'vedette') {
      const dir = e.vx >= 0 ? 1 : -1
      // wake
      g.save()
      g.strokeStyle = 'rgba(255,255,255,0.6)'
      g.lineWidth = 1.4
      for (const side of [-1, 1]) {
        g.beginPath()
        g.moveTo(x - dir * 14, y + side * 4)
        g.quadraticCurveTo(x - dir * 30, y + side * 9, x - dir * 46, y + side * 16)
        g.stroke()
      }
      g.restore()
      g.save()
      g.translate(x, y)
      g.scale(dir, 1)
      blit(g, lit ? S.vedette.flash : S.vedette, 0, 0)
      g.restore()
    } else if (e.kind === 'tourelle') {
      blit(g, lit ? S.tourellePad.flash : S.tourellePad, x, y)
      const a = Math.atan2(state.player.y - e.y, state.player.x - e.x)
      blit(g, lit ? S.tourelleGun.flash : S.tourelleGun, x, y, a)
    } else if (e.kind === 'boss') {
      if (shadow) return blit(g, S.boss.shadow, x + 26, y + 40)
      // engine glow (exhaust north) and smoke as it gets damaged
      for (const ex of [-46, -22, 22, 46]) {
        const gx = x + ex
        const gy = y - 19
        const rg = g.createRadialGradient(gx, gy, 0, gx, gy, 10)
        rg.addColorStop(0, 'rgba(255,200,120,0.9)')
        rg.addColorStop(1, 'rgba(255,80,20,0)')
        g.fillStyle = rg
        g.fillRect(gx - 10, gy - 10, 20, 20)
      }
      blit(g, lit ? S.boss.flash : S.boss, x, y)
      const hurtRatio = 1 - e.hp / KINDS.boss.hp
      if (Math.random() < hurtRatio * 0.6) {
        const ex = [-46, -22, 22, 46][Math.floor(Math.random() * 4)]
        fx.push({ type: 'smoke', x: x + ex, y: y - 10, t: 0, life: 50, r: 6 + hurtRatio * 8, dark: true })
      }
    }
    return undefined
  }

  function drawPlayer(g, state, time) {
    const p = state.player
    const x = p.x / FP
    const y = p.y / FP
    const sp = S.jets[state.jet]
    const bank = Math.max(-1, Math.min(1, (p.tx - p.x) / (FP * 30)))
    if (state.over && !state.won) return
    // shadow on the ground
    g.save()
    g.globalAlpha = 0.3
    blit(g, sp.shadow, x + 18, y + 30, 0, 0.82)
    g.restore()
    if (p.inv > 0 && Math.floor(p.inv / 5) % 2 === 0) return
    // afterburner
    const L = JET_LOOKS[state.jet]
    const len = 8 + Math.sin(time * 50) * 2 + (p.ty < p.y ? 6 : 0)
    for (const [ex, ey] of L.engines) flameAt(g, x + ex, y + ey, len, 2)
    g.save()
    g.translate(x, y)
    g.scale(1 - Math.abs(bank) * 0.18, 1) // banking narrows the wings
    g.drawImage(sp.canvas, -sp.w / 2, -sp.h / 2, sp.w, sp.h)
    g.restore()
    // the only point bullets can hit
    g.beginPath()
    g.arc(x, y, JETS[state.jet].hitbox * 0.7, 0, Math.PI * 2)
    g.fillStyle = '#fff'
    g.fill()
    g.lineWidth = 1
    g.strokeStyle = '#e74c3c'
    g.stroke()
    // shield ring during a bomb
    if (state.bombing > 0) {
      g.beginPath()
      g.arc(x, y, 26, 0, Math.PI * 2)
      g.strokeStyle = `rgba(160,220,255,${state.bombing / 60})`
      g.lineWidth = 2
      g.stroke()
    }
  }

  function drawChute(g, c) {
    const life = c.t / 60
    const x = c.x + Math.sin(c.t / 20 + c.sway) * 5
    const y = c.y
    const open = Math.min(1, c.t / 20)
    g.save()
    g.globalAlpha = Math.min(1, 5 - life)
    g.strokeStyle = 'rgba(40,40,40,0.8)'
    g.lineWidth = 0.4
    g.beginPath()
    g.moveTo(x - 7 * open, y - 8)
    g.lineTo(x, y + 2)
    g.lineTo(x + 7 * open, y - 8)
    g.stroke()
    g.beginPath()
    g.ellipse(x, y - 9, 8 * open, 5 * open, 0, Math.PI, 0)
    g.fillStyle = c.mine ? '#3a75c4' : '#f3f0e6'
    g.fill()
    g.fillStyle = c.mine ? '#fcd116' : '#e67e22'
    g.beginPath()
    g.ellipse(x, y - 9, 3 * open, 5 * open, 0, Math.PI, 0)
    g.fill()
    g.fillStyle = '#2b2b2b'
    g.beginPath()
    g.arc(x, y + 3, 1.6, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }

  function drawFx(g, layer) {
    for (const f of fx) {
      if (f.t < 0) continue
      const life = f.t / f.life
      if (layer === 'smoke' && f.type === 'smoke') {
        const r = f.r * (0.6 + life * 1.4)
        g.beginPath()
        g.arc(f.x, f.y, r, 0, Math.PI * 2)
        g.fillStyle = f.dark ? `rgba(30,30,30,${0.45 * (1 - life)})` : `rgba(90,90,90,${0.4 * (1 - life)})`
        g.fill()
      } else if (layer === 'fire') {
        if (f.type === 'fire') {
          const r = f.r * (0.5 + life * 0.8)
          const rg = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, r)
          rg.addColorStop(0, `rgba(255,250,220,${1 - life})`)
          rg.addColorStop(0.35, `rgba(255,190,60,${0.95 * (1 - life)})`)
          rg.addColorStop(0.7, `rgba(230,70,20,${0.7 * (1 - life)})`)
          rg.addColorStop(1, 'rgba(120,20,10,0)')
          g.fillStyle = rg
          g.fillRect(f.x - r, f.y - r, r * 2, r * 2)
        } else if (f.type === 'spark') {
          g.fillStyle = `rgba(255,220,120,${1 - life})`
          g.fillRect(f.x - 0.8, f.y - 0.8, 1.6, 1.6)
        } else if (f.type === 'ring') {
          g.beginPath()
          g.arc(f.x, f.y, f.r * (0.3 + life), 0, Math.PI * 2)
          g.strokeStyle = f.color ? `rgba(255,230,128,${1 - life})` : `rgba(255,240,200,${0.7 * (1 - life)})`
          g.lineWidth = 2 * (1 - life) + 0.3
          g.stroke()
        }
      }
    }
  }

  function updateFx() {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]
      f.t += 1
      if (f.type === 'spark') {
        f.x += f.vx
        f.y += f.vy
        f.vx *= 0.95
        f.vy *= 0.95
      } else if (f.type === 'smoke') {
        f.y += UNITS_PER_TICK * 0.6 // drifts back with the ground
      }
      if (f.t >= f.life) fx.splice(i, 1)
    }
    for (let i = chutes.length - 1; i >= 0; i--) {
      const c = chutes[i]
      c.t += 1
      c.y += 0.5
      if (c.t > 300 || c.y > H + 20) chutes.splice(i, 1)
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].t += 1
      if (popups[i].t > 50) popups.splice(i, 1)
    }
    shake *= 0.88
    flash = Math.max(0, flash - 0.035)
    hurt = Math.max(0, hurt - 0.04)
    if (bombRing) {
      bombRing.t += 1
      if (bombRing.t > 40) bombRing = null
    }
  }

  let lastFrame = 0
  function render(state, time) {
    // effects advance at 60 per second whatever the screen's refresh rate
    const now = time * 1000
    if (!lastFrame) lastFrame = now
    let steps = Math.min(4, Math.floor((now - lastFrame) / (1000 / 60)))
    lastFrame += steps * (1000 / 60)
    while (steps-- > 0) updateFx()

    const g = ctx
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.fillStyle = '#05080b'
    g.fillRect(0, 0, cssW, cssH)
    const sx = (Math.random() - 0.5) * shake
    const sy = (Math.random() - 0.5) * shake
    g.setTransform(dpr * s, 0, 0, dpr * s, dpr * (offX + sx * s), dpr * (offY + sy * s))
    const flown = state.scroll / FP

    // Wide screens: the ground goes on each side, mirrored and dimmed.
    if (offX > 1) {
      for (const at of [0, 2 * W]) {
        g.save()
        g.translate(at, 0)
        g.scale(-1, 1)
        drawGround(g, flown)
        g.restore()
      }
      const side = offX / s + 20
      g.fillStyle = 'rgba(4,8,12,0.62)'
      g.fillRect(-side, -20, side, H + 40)
      g.fillRect(W, -20, side, H + 40)
    }

    g.save()
    g.beginPath()
    g.rect(0, 0, W, H)
    g.clip()
    drawGround(g, flown)

    // ground craft, then the fliers' shadows
    for (const e of state.enemies) if (KINDS[e.kind].ground) drawEnemy(g, e, state, time, false)
    g.save()
    g.globalAlpha = 0.28
    for (const e of state.enemies) if (!KINDS[e.kind].ground) drawEnemy(g, e, state, time, true)
    g.restore()

    drawFx(g, 'smoke')

    // bonuses
    for (const b of state.bonuses) {
      const bx = b.x / FP
      const by = b.y / FP
      const pulse = 1 + Math.sin(time * 8 + b.id) * 0.08
      const glow = g.createRadialGradient(bx, by, 0, bx, by, 16)
      glow.addColorStop(0, 'rgba(255,255,200,0.45)')
      glow.addColorStop(1, 'rgba(255,255,200,0)')
      g.fillStyle = glow
      g.fillRect(bx - 16, by - 16, 32, 32)
      blit(g, S.bonus[b.kind], bx, by, 0, pulse)
    }

    // fliers
    for (const e of state.enemies) if (!KINDS[e.kind].ground) drawEnemy(g, e, state, time, false)

    // the jet's tracers
    for (const sh of state.shots) {
      const a = Math.atan2(sh.vy, sh.vx) + Math.PI / 2
      blit(g, S.tracer, sh.x / FP, sh.y / FP, a)
    }

    drawPlayer(g, state, time)
    for (const c of chutes) drawChute(g, c)
    drawFx(g, 'fire')

    // enemy bullets above everything, so they're always seen
    for (const b of state.bullets) blit(g, S.orb, b.x / FP, b.y / FP)

    // clouds, scrolling faster than the ground
    g.save()
    g.globalAlpha = 0.55
    for (let i = 0; i < 6; i++) {
      const span = H + 260
      const y = ((flown * 1.7 + i * 173) % span) - 130
      const x = ((i * 137 + Math.floor((flown * 1.7 + i * 173) / span) * 89) % (W + 80)) - 40
      blit(g, S.clouds[i % 3], x, y, 0, 1 + (i % 2) * 0.4)
    }
    g.restore()

    // haze over the mountains
    const w = legs(flown + H / 2)
    if (w[2] > 0) {
      const hz = g.createLinearGradient(0, 0, 0, H)
      hz.addColorStop(0, `rgba(220,228,235,${0.35 * w[2]})`)
      hz.addColorStop(0.5, `rgba(220,228,235,${0.08 * w[2]})`)
      hz.addColorStop(1, 'rgba(220,228,235,0)')
      g.fillStyle = hz
      g.fillRect(0, 0, W, H)
    }

    // the bomb's blast wave
    if (bombRing) {
      const r = bombRing.t * 14
      g.beginPath()
      g.arc(bombRing.x, bombRing.y, r, 0, Math.PI * 2)
      g.strokeStyle = `rgba(200,235,255,${1 - bombRing.t / 40})`
      g.lineWidth = 10 * (1 - bombRing.t / 40) + 1
      g.stroke()
    }

    // score popups
    g.textAlign = 'center'
    for (const p of popups) {
      g.globalAlpha = 1 - p.t / 50
      g.font = `bold ${p.big ? 13 : 9}px system-ui, sans-serif`
      g.lineWidth = 2.5
      g.strokeStyle = 'rgba(0,0,0,0.7)'
      g.strokeText(p.text, p.x, p.y - p.t * 0.6)
      g.fillStyle = p.big ? '#ffd84a' : '#fff'
      g.fillText(p.text, p.x, p.y - p.t * 0.6)
    }
    g.globalAlpha = 1

    // screen flashes
    if (flash > 0) {
      g.fillStyle = `rgba(255,255,255,${flash * 0.8})`
      g.fillRect(0, 0, W, H)
    }
    if (hurt > 0) {
      const v = g.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.7)
      v.addColorStop(0, 'rgba(220,30,30,0)')
      v.addColorStop(1, `rgba(220,30,30,${hurt * 0.55})`)
      g.fillStyle = v
      g.fillRect(0, 0, W, H)
    }
    // vignette
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, 'rgba(0,0,0,0.35)')
    g.fillStyle = vg
    g.fillRect(0, 0, W, H)
    g.restore()

    // the frame around the playfield on wide screens
    g.strokeStyle = 'rgba(255,255,255,0.08)'
    g.lineWidth = 1 / s
    g.strokeRect(0, 0, W, H)
  }

  return { resize, render, handleEvents, toWorld, scale }
}
