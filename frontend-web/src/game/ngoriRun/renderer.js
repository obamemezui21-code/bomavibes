import { JUMP_TICKS, OBSTACLES, SLIDE_TICKS } from '../../../../shared/ngori-run/engine.mjs'

// NGORI RUN renderer — draws the simulation's state on a 2D canvas as a
// pseudo-3D road: Libreville-style seafront at sunset, sea and palms on the
// left, lounges and buildings on the right. Purely visual: nothing here may
// feed back into the simulation.
//
// World units are the engine's (cm). zr = distance ahead of the runner.

const LANE_W = 180
const ROAD_HALF = LANE_W * 1.5
const CAM_BACK = 420
const VIEW_DEPTH = 12500
const SEG = 500

const COLORS = {
  skyTop: '#1d0b36',
  skyMid: '#6b2a7a',
  skyLow: '#f0607a',
  horizon: '#ffb36b',
  sea: '#2b2f6b',
  seaFar: '#ff9f7a',
  plaza: '#3a2340',
  plazaAlt: '#43294a',
  promenade: '#c9a27c',
  promenadeAlt: '#bb926d',
  road: '#2a2233',
  roadAlt: '#2f2639',
  line: 'rgba(255,255,255,0.75)',
  curb: '#e9467d',
  curbAlt: '#f4efe9',
}
const BUILDING_COLORS = ['#c46a4a', '#d99a4e', '#2f8f83', '#8a4f9e', '#e2b98f', '#4b6fa8']
const SIGNS = ['LOUNGE', 'MAQUIS', 'BOMA', 'CAFÉ', 'GRILL', 'VIBES', 'SUNSET', 'BAR']
const CAR_COLORS = ['#f2bf4e', '#2dd4bf', '#e9467d', '#f5f5f4', '#7c3aed']
const SKIN = '#5a3825'
const POWERUP_STYLE = {
  shield: { color: '#38bdf8', icon: '🛡️' },
  magnet: { color: '#f43f5e', icon: '🧲' },
  multiplier: { color: '#a855f7', icon: '×2' },
  boost: { color: '#f59e0b', icon: '⚡' },
}

// Stable pseudo-random from an integer — scenery only, never the game.
function hash(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false })
  let W = 0
  let H = 0
  let F = 1
  let horizonY = 0
  let camH = 500
  let camX = 0
  let skyGradient = null
  let seaGradient = null
  let hazeGradient = null
  const popups = []
  let shakeUntil = 0
  let flashUntil = 0

  function resize(width, height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    W = width
    H = height
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    F = 0.72 * Math.min(W, H * 0.7)
    horizonY = H * 0.34
    camH = (H * 0.86 - horizonY) / (F / CAM_BACK)

    skyGradient = ctx.createLinearGradient(0, 0, 0, horizonY)
    skyGradient.addColorStop(0, COLORS.skyTop)
    skyGradient.addColorStop(0.45, COLORS.skyMid)
    skyGradient.addColorStop(0.85, COLORS.skyLow)
    skyGradient.addColorStop(1, COLORS.horizon)
    seaGradient = ctx.createLinearGradient(0, horizonY, 0, H)
    seaGradient.addColorStop(0, COLORS.seaFar)
    seaGradient.addColorStop(0.08, '#7a4a8c')
    seaGradient.addColorStop(0.35, COLORS.sea)
    seaGradient.addColorStop(1, '#151838')
    hazeGradient = ctx.createLinearGradient(0, horizonY - 10, 0, horizonY + H * 0.12)
    hazeGradient.addColorStop(0, 'rgba(255,179,107,0.55)')
    hazeGradient.addColorStop(1, 'rgba(255,179,107,0)')
  }

  function project(x, y, zr) {
    const depth = Math.max(zr + CAM_BACK, 40)
    const s = F / depth
    return { x: W / 2 + (x - camX) * s, y: horizonY + (camH - y) * s, s }
  }

  function groundQuad(xl0, xr0, zr0, xl1, xr1, zr1, color) {
    const a = project(xl0, 0, zr0)
    const b = project(xr0, 0, zr0)
    const c = project(xr1, 0, zr1)
    const d = project(xl1, 0, zr1)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.lineTo(c.x, c.y)
    ctx.lineTo(d.x, d.y)
    ctx.closePath()
    ctx.fill()
  }

  // A vertical rectangle facing the camera, centred on x.
  function face(xc, width, y0, y1, zr, color) {
    const p = project(xc - width / 2, y1, zr)
    const q = project(xc + width / 2, y0, zr)
    ctx.fillStyle = color
    ctx.fillRect(p.x, p.y, q.x - p.x, q.y - p.y)
    return { left: p.x, top: p.y, right: q.x, bottom: q.y, s: p.s }
  }

  // A horizontal quad at height y between two depths (car roofs…).
  function top(xc, width, y, zr0, zr1, color) {
    const a = project(xc - width / 2, y, zr0)
    const b = project(xc + width / 2, y, zr0)
    const c = project(xc + width / 2, y, zr1)
    const d = project(xc - width / 2, y, zr1)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.lineTo(c.x, c.y)
    ctx.lineTo(d.x, d.y)
    ctx.closePath()
    ctx.fill()
  }

  function fogAlpha(zr) {
    return Math.max(0, Math.min(1, (VIEW_DEPTH - zr) / 3000))
  }

  function drawSky(time) {
    ctx.fillStyle = skyGradient
    ctx.fillRect(0, 0, W, horizonY + 1)
    // Sun setting over the estuary, on the sea side.
    const sx = W * 0.22
    const sy = horizonY - H * 0.035
    const r = Math.min(W, H) * 0.075
    const glow = ctx.createRadialGradient(sx, sy, r * 0.4, sx, sy, r * 3.2)
    glow.addColorStop(0, 'rgba(255,214,140,0.85)')
    glow.addColorStop(1, 'rgba(255,214,140,0)')
    ctx.fillStyle = glow
    ctx.fillRect(sx - r * 3.2, sy - r * 3.2, r * 6.4, r * 6.4)
    ctx.fillStyle = '#ffe2a8'
    ctx.beginPath()
    ctx.arc(sx, sy, r, 0, Math.PI * 2)
    ctx.fill()
    // Slow drifting clouds.
    ctx.fillStyle = 'rgba(255,170,190,0.18)'
    for (let i = 0; i < 4; i++) {
      const cx = ((hash(i + 11) * W * 1.6 + time * 6 * (i + 1)) % (W * 1.6)) - W * 0.3
      const cy = horizonY * (0.25 + hash(i + 3) * 0.45)
      ctx.beginPath()
      ctx.ellipse(cx, cy, W * 0.16, H * 0.012, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    // City skyline on the right, far away.
    ctx.fillStyle = 'rgba(60,20,70,0.85)'
    let x = W * 0.5
    let i = 0
    while (x < W + 40) {
      const w = 18 + hash(i) * 40
      const h = H * (0.03 + hash(i + 50) * 0.09)
      ctx.fillRect(x, horizonY - h, w, h + 1)
      x += w + 2
      i++
    }
  }

  function drawGround(dist) {
    // Sea fills everything below the horizon; land and road are laid over it.
    ctx.fillStyle = seaGradient
    ctx.fillRect(0, horizonY, W, H - horizonY)

    const start = Math.floor(dist / SEG) * SEG
    for (let z = start + VIEW_DEPTH; z >= start - SEG; z -= SEG) {
      const zr0 = Math.max(z - dist, -CAM_BACK + 50)
      const zr1 = z + SEG - dist
      if (zr1 <= zr0) continue
      const alt = Math.floor(z / SEG) % 2 === 0
      // Right: plaza in front of the buildings.
      groundQuad(ROAD_HALF, 6000, zr0, ROAD_HALF, 6000, zr1, alt ? COLORS.plaza : COLORS.plazaAlt)
      // Left: the seafront promenade.
      groundQuad(-ROAD_HALF - 380, -ROAD_HALF, zr0, -ROAD_HALF - 380, -ROAD_HALF, zr1, alt ? COLORS.promenade : COLORS.promenadeAlt)
      groundQuad(-ROAD_HALF, ROAD_HALF, zr0, -ROAD_HALF, ROAD_HALF, zr1, alt ? COLORS.road : COLORS.roadAlt)
      // Curbs.
      groundQuad(-ROAD_HALF - 22, -ROAD_HALF, zr0, -ROAD_HALF - 22, -ROAD_HALF, zr1, alt ? COLORS.curb : COLORS.curbAlt)
      groundQuad(ROAD_HALF, ROAD_HALF + 22, zr0, ROAD_HALF, ROAD_HALF + 22, zr1, alt ? COLORS.curb : COLORS.curbAlt)
      // Dashed lane lines.
      if (alt) {
        for (const lx of [-LANE_W / 2, LANE_W / 2]) {
          groundQuad(lx - 5, lx + 5, zr0 + 60, lx - 5, lx + 5, zr1 - 60, COLORS.line)
        }
      }
    }
    // Sunset haze where the road meets the sky.
    ctx.fillStyle = hazeGradient
    ctx.fillRect(0, horizonY - 10, W, H * 0.12 + 10)
  }

  function drawSeaSparkles(time) {
    ctx.strokeStyle = 'rgba(255,220,180,0.35)'
    ctx.lineWidth = 1
    for (let i = 0; i < 14; i++) {
      const y = horizonY + 4 + hash(i) * H * 0.2
      const phase = (time * 0.6 + hash(i + 7)) % 1
      const len = 8 + hash(i + 20) * 24
      const x = W * 0.02 + hash(i + 30) * W * 0.3
      ctx.globalAlpha = Math.sin(phase * Math.PI)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + len, y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  function drawBuilding(k, dist) {
    const z0 = k * 1500 + 100
    const z1 = z0 + 1200
    const zr0 = z0 - dist
    const zr1 = z1 - dist
    if (zr1 < -CAM_BACK + 60 || zr0 > VIEW_DEPTH) return
    const h = 700 + Math.floor(hash(k) * 1000)
    const x = ROAD_HALF + 420
    const color = BUILDING_COLORS[Math.floor(hash(k + 99) * BUILDING_COLORS.length)]
    ctx.globalAlpha = fogAlpha(zr0)
    // Facade along the road.
    const a = project(x, 0, Math.max(zr0, -CAM_BACK + 60))
    const b = project(x, h, Math.max(zr0, -CAM_BACK + 60))
    const c = project(x, h, zr1)
    const d = project(x, 0, zr1)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.lineTo(c.x, c.y)
    ctx.lineTo(d.x, d.y)
    ctx.closePath()
    ctx.fill()
    // Shade so the facade reads as a wall in perspective.
    ctx.fillStyle = 'rgba(20,5,30,0.28)'
    ctx.fill()
    // Lit windows.
    ctx.fillStyle = 'rgba(255,214,140,0.8)'
    for (let row = 1; row * 220 < h - 100; row++) {
      for (let col = 0; col < 4; col++) {
        if (hash(k * 31 + row * 7 + col) < 0.45) continue
        const wz0 = zr0 + 120 + col * 270
        const p = project(x, row * 220 + 120, wz0)
        const q = project(x, row * 220, wz0 + 140)
        if (wz0 < -CAM_BACK + 80) continue
        ctx.fillRect(Math.min(p.x, q.x), p.y, Math.max(1.5, Math.abs(q.x - p.x)), Math.max(1.5, q.y - p.y))
      }
    }
    // Neon sign over the ground floor of every other building.
    if (hash(k + 5) < 0.55 && zr0 > -CAM_BACK + 150) {
      const p = project(x, 260, zr0 + 300)
      const size = Math.max(6, 70 * p.s)
      ctx.font = `800 ${size}px system-ui, sans-serif`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = '#ff4fa3'
      ctx.shadowBlur = 12
      ctx.fillStyle = '#ffd1e8'
      ctx.fillText(SIGNS[k % SIGNS.length], p.x - 4, p.y)
      ctx.shadowBlur = 0
    }
    ctx.globalAlpha = 1
  }

  function drawPalm(zr, k, time) {
    const x = -ROAD_HALF - 220
    const base = project(x, 0, zr)
    const s = base.s
    const h = (650 + hash(k) * 200) * s
    const lean = (hash(k + 3) - 0.5) * 120 * s
    ctx.globalAlpha = fogAlpha(zr)
    ctx.strokeStyle = '#6b4a32'
    ctx.lineWidth = Math.max(1.5, 20 * s)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(base.x, base.y)
    ctx.quadraticCurveTo(base.x + lean * 0.2, base.y - h * 0.6, base.x + lean, base.y - h)
    ctx.stroke()
    const tx = base.x + lean
    const ty = base.y - h
    const sway = Math.sin(time * 1.4 + k) * 0.08
    ctx.strokeStyle = '#1f7a55'
    ctx.lineWidth = Math.max(1.5, 16 * s)
    for (let i = 0; i < 7; i++) {
      const angle = -Math.PI / 2 + (i - 3) * 0.5 + sway
      const len = 260 * s
      const ex = tx + Math.cos(angle) * len * 1.3
      const ey = ty + Math.sin(angle) * len * 0.6 + len * 0.55
      ctx.beginPath()
      ctx.moveTo(tx, ty)
      ctx.quadraticCurveTo(tx + Math.cos(angle) * len * 0.8, ty + Math.sin(angle) * len * 0.9, ex, ey)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  function drawLamp(zr) {
    const x = ROAD_HALF + 110
    const base = project(x, 0, zr)
    const s = base.s
    const head = project(x - 90, 560, zr)
    ctx.globalAlpha = fogAlpha(zr)
    ctx.strokeStyle = '#2b2236'
    ctx.lineWidth = Math.max(1, 9 * s)
    ctx.beginPath()
    ctx.moveTo(base.x, base.y)
    ctx.lineTo(base.x, head.y)
    ctx.lineTo(head.x, head.y)
    ctx.stroke()
    const glow = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 90 * s)
    glow.addColorStop(0, 'rgba(255,220,150,0.9)')
    glow.addColorStop(1, 'rgba(255,220,150,0)')
    ctx.fillStyle = glow
    ctx.fillRect(head.x - 90 * s, head.y - 90 * s, 180 * s, 180 * s)
    ctx.globalAlpha = 1
  }

  function drawScenery(dist, time) {
    const first = Math.floor((dist - CAM_BACK) / 1500)
    const last = Math.floor((dist + VIEW_DEPTH) / 1500)
    for (let k = last; k >= first; k--) drawBuilding(k, dist)
    const props = []
    for (let k = Math.floor((dist - CAM_BACK) / 1100); k * 1100 < dist + VIEW_DEPTH; k++) props.push({ zr: k * 1100 + 300 - dist, draw: (zr) => drawPalm(zr, k, time) })
    for (let k = Math.floor((dist - CAM_BACK) / 1400); k * 1400 < dist + VIEW_DEPTH; k++) props.push({ zr: k * 1400 + 700 - dist, draw: (zr) => drawLamp(zr) })
    props
      // Props already passed would fill the screen edge: drop them early.
      .filter((p) => p.zr > -120 && p.zr < VIEW_DEPTH)
      .sort((a, b) => b.zr - a.zr)
      .forEach((p) => p.draw(p.zr))
  }

  const laneX = (lane) => (lane - 1) * LANE_W

  function drawObstacle(o, zr) {
    const def = OBSTACLES[o.type]
    const xc = laneX(o.lane)
    ctx.globalAlpha = fogAlpha(zr) * (o.hit ? 0.35 : 1)
    if (o.type === 'hole') {
      groundQuad(xc - 75, xc + 75, zr, xc - 75, xc + 75, zr + def.len, '#120a18')
      groundQuad(xc - 82, xc + 82, zr - 14, xc - 82, xc + 82, zr, '#f97316')
      groundQuad(xc - 82, xc + 82, zr + def.len, xc - 82, xc + 82, zr + def.len + 14, '#f97316')
    } else if (o.type === 'cone') {
      for (const dx of [-45, 45]) {
        const b = project(xc + dx, 0, zr)
        const t = project(xc + dx, 75, zr)
        const half = 22 * b.s
        ctx.fillStyle = '#f97316'
        ctx.beginPath()
        ctx.moveTo(b.x - half, b.y)
        ctx.lineTo(b.x + half, b.y)
        ctx.lineTo(t.x, t.y)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#fff7ed'
        ctx.fillRect(b.x - half * 0.55, b.y - (b.y - t.y) * 0.55, half * 1.1, (b.y - t.y) * 0.14)
      }
    } else if (o.type === 'barrier') {
      face(xc - 65, 10, 0, 95, zr, '#d4d4d8')
      face(xc + 65, 10, 0, 95, zr, '#d4d4d8')
      const bar = face(xc, 160, 55, 100, zr, '#f8fafc')
      const stripes = 5
      ctx.fillStyle = '#e11d48'
      for (let i = 0; i < stripes; i += 2) {
        const w = (bar.right - bar.left) / stripes
        ctx.fillRect(bar.left + i * w, bar.top, w, bar.bottom - bar.top)
      }
    } else if (o.type === 'sign') {
      face(xc - 82, 10, 0, 220, zr, '#3f3f46')
      face(xc + 82, 10, 0, 220, zr, '#3f3f46')
      const banner = face(xc, 170, 120, 210, zr, '#e9467d')
      ctx.fillStyle = '#fff'
      ctx.font = `800 ${Math.max(6, 36 * banner.s)}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('BOMA ↓', (banner.left + banner.right) / 2, (banner.top + banner.bottom) / 2)
    } else if (o.type === 'car') {
      const color = CAR_COLORS[o.id % CAR_COLORS.length]
      top(xc, 150, 145, zr, zr + def.len, shade(color, -0.1))
      top(xc, 130, 150, zr + 90, zr + 280, 'rgba(30,30,50,0.55)')
      const body = face(xc, 150, 0, 145, zr, color)
      ctx.fillStyle = 'rgba(25,25,45,0.85)'
      const bw = body.right - body.left
      const bh = body.bottom - body.top
      ctx.fillRect(body.left + bw * 0.12, body.top + bh * 0.1, bw * 0.76, bh * 0.3)
      ctx.fillStyle = '#ef4444'
      ctx.fillRect(body.left + bw * 0.04, body.top + bh * 0.52, bw * 0.16, bh * 0.1)
      ctx.fillRect(body.right - bw * 0.2, body.top + bh * 0.52, bw * 0.16, bh * 0.1)
      ctx.fillStyle = '#111'
      ctx.fillRect(body.left + bw * 0.06, body.bottom - bh * 0.1, bw * 0.2, bh * 0.1)
      ctx.fillRect(body.right - bw * 0.26, body.bottom - bh * 0.1, bw * 0.2, bh * 0.1)
      if (color === CAR_COLORS[0]) {
        const sign = face(xc, 50, 150, 175, zr + 120, '#111')
        ctx.fillStyle = '#f2bf4e'
        ctx.font = `800 ${Math.max(5, 16 * sign.s)}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('TAXI', (sign.left + sign.right) / 2, (sign.top + sign.bottom) / 2)
      }
    } else if (o.type === 'works') {
      top(xc, 160, 140, zr, zr + def.len, '#c2410c')
      const panel = face(xc, 160, 0, 140, zr, '#f97316')
      ctx.fillStyle = '#fff7ed'
      const pw = panel.right - panel.left
      for (let i = 0; i < 4; i++) ctx.fillRect(panel.left + (i * pw) / 4 + pw * 0.04, panel.top, pw * 0.1, panel.bottom - panel.top)
      const plate = face(xc, 120, 150, 200, zr + 10, '#facc15')
      ctx.fillStyle = '#111'
      ctx.font = `800 ${Math.max(5, 22 * plate.s)}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('TRAVAUX', (plate.left + plate.right) / 2, (plate.top + plate.bottom) / 2)
    }
    ctx.globalAlpha = 1
  }

  function drawCoin(c, zr, time) {
    const r = c.gold ? 36 : 27
    const p = project(laneX(c.lane), 60 + Math.sin(time * 4 + c.id) * 8, zr)
    const rx = Math.max(1, r * p.s * Math.abs(Math.cos(time * 3.5 + c.id)))
    const ry = r * p.s
    ctx.globalAlpha = fogAlpha(zr)
    if (c.gold) {
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, ry * 2.4)
      glow.addColorStop(0, 'rgba(255,215,90,0.6)')
      glow.addColorStop(1, 'rgba(255,215,90,0)')
      ctx.fillStyle = glow
      ctx.fillRect(p.x - ry * 2.4, p.y - ry * 2.4, ry * 4.8, ry * 4.8)
    }
    ctx.fillStyle = c.gold ? '#ffd23f' : '#f2bf4e'
    ctx.beginPath()
    ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#c98a12'
    ctx.lineWidth = Math.max(1, 4 * p.s)
    ctx.stroke()
    if (rx > ry * 0.45) {
      ctx.fillStyle = '#7a4b00'
      ctx.font = `900 ${ry * 1.1}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('N', p.x, p.y + ry * 0.05)
    }
    ctx.globalAlpha = 1
  }

  function drawPowerup(pu, zr, time) {
    const style = POWERUP_STYLE[pu.type]
    const p = project(laneX(pu.lane), 75 + Math.sin(time * 3 + pu.id) * 10, zr)
    const r = 42 * p.s
    ctx.globalAlpha = fogAlpha(zr)
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2)
    glow.addColorStop(0, style.color)
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.fillRect(p.x - r * 2, p.y - r * 2, r * 4, r * 4)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = style.color
    ctx.lineWidth = Math.max(1.5, 6 * p.s)
    ctx.stroke()
    ctx.fillStyle = style.color
    ctx.font = `900 ${r * 1.05}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(style.icon, p.x, p.y + r * 0.05)
    ctx.globalAlpha = 1
  }

  function roundRect(x, y, w, h, r, color) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2))
    ctx.fill()
  }

  // The runner, seen from behind: afro puff, pink headphones, BomaVibes jacket.
  function drawRunner(state, view) {
    const x = (view.laneVis - 1) * LANE_W
    const jumpT = state.jump ? Math.min(1, (state.jump + view.alpha) / JUMP_TICKS) : 0
    const y = state.jump ? 4 * 130 * jumpT * (1 - jumpT) : 0
    const sliding = state.slide > 0 && state.slide < SLIDE_TICKS
    const ground = project(x, 0, 30)
    const p = project(x, y, 30)
    const u = p.s
    const phase = view.time * 14

    // Shadow
    ctx.fillStyle = `rgba(0,0,0,${0.35 * (1 - y / 260)})`
    ctx.beginPath()
    ctx.ellipse(ground.x, ground.y, 42 * u * (1 - y / 400), 12 * u, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.save()
    ctx.translate(p.x, p.y)
    if (view.crashT > 0) ctx.rotate(Math.min(1, view.crashT * 2.5) * 1.2)

    // Aura of active power-ups.
    if (state.shield || state.grace) {
      ctx.strokeStyle = `rgba(56,189,248,${state.grace ? 0.4 + 0.4 * Math.sin(view.time * 30) : 0.75})`
      ctx.lineWidth = 4 * u
      ctx.beginPath()
      ctx.ellipse(0, -90 * u, 70 * u, 110 * u, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    if (state.boost) {
      const g = ctx.createRadialGradient(0, -80 * u, 0, 0, -80 * u, 140 * u)
      g.addColorStop(0, 'rgba(245,158,11,0.55)')
      g.addColorStop(1, 'rgba(245,158,11,0)')
      ctx.fillStyle = g
      ctx.fillRect(-140 * u, -220 * u, 280 * u, 280 * u)
    }
    if (state.magnet) {
      ctx.strokeStyle = `rgba(244,63,94,${0.35 + 0.25 * Math.sin(view.time * 8)})`
      ctx.lineWidth = 3 * u
      ctx.beginPath()
      ctx.arc(0, -90 * u, 120 * u, 0, Math.PI * 2)
      ctx.stroke()
    }

    const run = state.jump || view.crashT > 0 ? 0 : Math.sin(phase)
    if (sliding) {
      // Low slide: legs tucked forward, torso leaning back.
      roundRect(-30 * u, -38 * u, 60 * u, 30 * u, 10 * u, '#1e1b4b')
      roundRect(-26 * u, -8 * u, 20 * u, 10 * u, 4 * u, '#fff')
      roundRect(6 * u, -8 * u, 20 * u, 10 * u, 4 * u, '#fff')
      const jacket = ctx.createLinearGradient(0, -95 * u, 0, -35 * u)
      jacket.addColorStop(0, '#8b5cf6')
      jacket.addColorStop(1, '#ec4899')
      roundRect(-27 * u, -92 * u, 54 * u, 58 * u, 14 * u, jacket)
      drawHead(0, -112 * u, u)
    } else {
      // Legs
      roundRect(-22 * u, (-95 + run * 10) * u, 18 * u, (90 - run * 10) * u, 8 * u, '#1e1b4b')
      roundRect(4 * u, (-95 - run * 10) * u, 18 * u, (90 + run * 10) * u, 8 * u, '#1e1b4b')
      roundRect(-25 * u, (-12 + run * 10) * u, 24 * u, 12 * u, 5 * u, '#fff')
      roundRect(1 * u, (-12 - run * 10) * u, 24 * u, 12 * u, 5 * u, '#fff')
      // Arms swing opposite to legs.
      roundRect(-38 * u, (-148 - run * 12) * u, 13 * u, 52 * u, 6 * u, SKIN)
      roundRect(25 * u, (-148 + run * 12) * u, 13 * u, 52 * u, 6 * u, SKIN)
      const jacket = ctx.createLinearGradient(0, -155 * u, 0, -90 * u)
      jacket.addColorStop(0, '#8b5cf6')
      jacket.addColorStop(1, '#ec4899')
      roundRect(-28 * u, -155 * u, 56 * u, 66 * u, 14 * u, jacket)
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.font = `900 ${12 * u}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('BV', 0, -125 * u)
      drawHead(0, -172 * u, u)
    }
    if (state.multiplier) {
      ctx.fillStyle = '#c084fc'
      ctx.font = `900 ${26 * u}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('×2', 0, (sliding ? -150 : -215) * u)
    }
    ctx.restore()
  }

  function drawHead(hx, hy, u) {
    ctx.fillStyle = SKIN
    ctx.beginPath()
    ctx.arc(hx, hy, 14 * u, 0, Math.PI * 2)
    ctx.fill()
    // Afro puff
    ctx.fillStyle = '#17100c'
    ctx.beginPath()
    ctx.arc(hx, hy - 6 * u, 17 * u, Math.PI * 0.95, Math.PI * 2.05)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(hx, hy - 24 * u, 11 * u, 0, Math.PI * 2)
    ctx.fill()
    // Headphones
    ctx.strokeStyle = '#ec4899'
    ctx.lineWidth = 3.5 * u
    ctx.beginPath()
    ctx.arc(hx, hy - 2 * u, 17 * u, Math.PI * 1.05, Math.PI * 1.95)
    ctx.stroke()
    roundRect(hx - 20 * u, hy - 6 * u, 8 * u, 13 * u, 3 * u, '#ec4899')
    roundRect(hx + 12 * u, hy - 6 * u, 8 * u, 13 * u, 3 * u, '#ec4899')
  }

  function drawSpeedLines(state, time) {
    const intensity = state.boost ? 1 : Math.max(0, (state.speed - 24) / 10)
    if (intensity <= 0) return
    ctx.strokeStyle = `rgba(255,255,255,${0.25 * intensity})`
    ctx.lineWidth = 1.5
    for (let i = 0; i < 14; i++) {
      const seed = Math.floor(time * 20) + i * 13
      const angle = hash(seed) * Math.PI * 2
      const r0 = Math.min(W, H) * (0.35 + hash(seed + 1) * 0.3)
      const r1 = r0 + 40 + hash(seed + 2) * 80
      const cx = W / 2
      const cy = horizonY
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0)
      ctx.lineTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1)
      ctx.stroke()
    }
  }

  function drawPopups(now) {
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i]
      const age = (now - p.born) / 900
      if (age >= 1) {
        popups.splice(i, 1)
        continue
      }
      ctx.globalAlpha = 1 - age
      ctx.fillStyle = p.color
      ctx.font = `900 ${p.size}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 3
      const y = p.y - age * 60
      ctx.strokeText(p.text, p.x, y)
      ctx.fillText(p.text, p.x, y)
    }
    ctx.globalAlpha = 1
  }

  function render(state, view) {
    const now = performance.now()
    const playerX = (view.laneVis - 1) * LANE_W
    camX += (playerX * 0.55 - camX) * Math.min(1, view.dt * 8)

    ctx.save()
    if (now < shakeUntil) {
      const k = (shakeUntil - now) / 400
      ctx.translate((Math.random() - 0.5) * 18 * k, (Math.random() - 0.5) * 18 * k)
    }
    drawSky(view.time)
    drawGround(view.dist)
    drawSeaSparkles(view.time)
    drawScenery(view.dist, view.time)

    const items = []
    for (const o of state.obstacles) items.push({ zr: o.z - view.dist, draw: (zr) => drawObstacle(o, zr) })
    for (const c of state.coinsOnRoad) if (!c.taken) items.push({ zr: c.z - view.dist, draw: (zr) => drawCoin(c, zr, view.time) })
    for (const p of state.powerups) if (!p.taken) items.push({ zr: p.z - view.dist, draw: (zr) => drawPowerup(p, zr, view.time) })
    items.push({ zr: 30, draw: () => drawRunner(state, view) })
    items
      .filter((it) => it.zr > -CAM_BACK + 40 && it.zr < VIEW_DEPTH)
      .sort((a, b) => b.zr - a.zr)
      .forEach((it) => it.draw(it.zr))

    drawSpeedLines(state, view.time)
    drawPopups(now)
    ctx.restore()

    if (now < flashUntil) {
      ctx.fillStyle = `rgba(255,255,255,${((flashUntil - now) / 250) * 0.8})`
      ctx.fillRect(0, 0, W, H)
    }
    if (view.crashT > 0) {
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75)
      v.addColorStop(0, 'rgba(225,29,72,0)')
      v.addColorStop(1, `rgba(225,29,72,${Math.min(0.5, view.crashT)})`)
      ctx.fillStyle = v
      ctx.fillRect(0, 0, W, H)
    }
  }

  // Screen position just above the runner's head (for "+1" popups).
  function runnerAnchor(laneVis) {
    const p = project((laneVis - 1) * LANE_W, 200, 30)
    return { x: p.x, y: p.y }
  }

  return {
    resize,
    render,
    popup(text, color, laneVis, size = 26) {
      const a = runnerAnchor(laneVis)
      popups.push({ text, color, x: a.x, y: a.y, size, born: performance.now() })
    },
    crash() {
      shakeUntil = performance.now() + 400
      flashUntil = performance.now() + 250
    },
  }
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + 255 * amount)))
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`
}
