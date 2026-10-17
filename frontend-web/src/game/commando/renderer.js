// COMMANDO OKOUMÉ renderer. Two layers:
//  1. the scenery: a painted backdrop per mission (public/commando/bg-<theme>.webp,
//     drawn at full screen resolution with parallax, mirrored to loop) — or,
//     until those images exist, scenery drawn in code;
//  2. the action, on a 640×360 buffer (twice the 320×180 world) so sprites,
//     ground and effects get half-pixel detail and thin outlines, scaled up
//     with no smoothing.
// Purely visual — the game itself lives in shared/commando-okoume/engine.mjs.
import { FP, GROUND_Y, MISSIONS, SCREEN_H, SCREEN_W, WEAPONS } from '../../../../shared/commando-okoume/engine.mjs'
import { LOOKS, drawFigure, drawLying, drawPuff } from './sprites.js'

const RES = 2 // buffer pixels per world pixel
const PARALLAX = 0.3 // how fast the painted backdrop scrolls

const THEMES = {
  port: {
    sky: ['#2b1b4a', '#4a2462', '#7d2f6b', '#b8456a', '#e2725b', '#f6a96b'],
    sun: '#ffd36b',
    ground: ['#7d898a', '#5a6566'],
    groundTop: '#c3c9ca',
    gap: ['#1d3d5e', '#0d1f33'],
    light: 'rgba(255,170,90,0.10)',
  },
  lope: {
    sky: ['#5fb4dd', '#78c3e6', '#93d0ec', '#aedcf1', '#c9e8f6', '#e2f3fa'],
    sun: '#fff3b0',
    ground: ['#a8521f', '#6e3110'],
    groundTop: '#6aa121',
    gap: ['#2a1608', '#120802'],
    light: 'rgba(255,230,160,0.07)',
  },
  ivindo: {
    sky: ['#16302a', '#1d3d33', '#25493c', '#2e5a47', '#3b6b52', '#4c7a5d'],
    sun: null,
    ground: ['#4a3420', '#24180d'],
    groundTop: '#4f7a28',
    gap: ['#1f6464', '#0b2e2e'],
    light: 'rgba(170,220,190,0.06)',
  },
}

const CONTAINER_COLORS = ['#b03a2e', '#2471a3', '#1e8449', '#c87f0a', '#6c3483']

// Small deterministic noise for scenery placement.
const hash = (n) => {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

// Painted backdrops, shared by every game on the page; null = not (yet) available.
const backdrops = {}
const loading = {}

// Starts loading a mission's backdrop; resolves once it is ready or known missing.
export function preloadBackdrop(theme) {
  loading[theme] ||= new Promise((resolve) => {
    backdrops[theme] = null
    const img = new Image()
    img.onload = () => {
      backdrops[theme] = img
      resolve(true)
    }
    img.onerror = () => resolve(false)
    img.src = `/commando/bg-${theme}.webp`
  })
  return loading[theme]
}

function backdrop(theme) {
  preloadBackdrop(theme)
  return backdrops[theme]
}

export function createCommandoRenderer(canvas) {
  const buf = document.createElement('canvas')
  buf.width = SCREEN_W * RES
  buf.height = SCREEN_H * RES
  const g = buf.getContext('2d')
  const out = canvas.getContext('2d')
  let particles = []
  let corpses = [] // poachers just put out of action: lying, then a puff of smoke
  let shake = 0
  let wasOnGround = true
  let view = { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H }

  const q = (v) => Math.round(v * RES) / RES
  const r = (x, y, w, h, c) => {
    g.fillStyle = c
    g.fillRect(q(x), q(y), q(w), q(h))
  }
  const vgrad = (y0, y1, c0, c1) => {
    const grad = g.createLinearGradient(0, y0, 0, y1)
    grad.addColorStop(0, c0)
    grad.addColorStop(1, c1)
    return grad
  }

  // ---- Scenery drawn in code (until the painted backdrops exist) -------------
  function drawSky(theme) {
    const t = THEMES[theme]
    const band = 16
    t.sky.forEach((c, i) => r(0, i * band, SCREEN_W, band, c))
    r(0, t.sky.length * band, SCREEN_W, SCREEN_H, t.sky[t.sky.length - 1])
    if (t.sun) {
      g.fillStyle = t.sun
      g.beginPath()
      g.arc(250, theme === 'port' ? 92 : 34, 14, 0, Math.PI * 2)
      g.fill()
    }
  }

  function drawFar(theme, cam, time) {
    const off = cam * 0.15
    if (theme === 'port') {
      for (let i = Math.floor(off / 22) - 1; i < Math.floor(off / 22) + 17; i++) {
        const x = i * 22 - off
        const h = 26 + Math.floor(hash(i) * 40)
        r(x, 118 - h, 20, h, '#3a2350')
        for (let wy = 118 - h + 4; wy < 114; wy += 6) {
          for (let wx = 3; wx < 18; wx += 5) if (hash(i * 31 + wy + wx) > 0.55) r(x + wx, wy, 2, 2, '#f7c86b')
        }
      }
      r(0, 118, SCREEN_W, 40, '#1f3f66')
      for (let i = 0; i < 12; i++) r(((i * 37 + time * 8) % 340) - 10, 124 + (i % 4) * 7, 10, 0.5, '#5d8fbf')
    } else if (theme === 'lope') {
      for (let x = 0; x < SCREEN_W; x += 1) {
        const wx = x + off
        const h = 26 + Math.sin(wx / 40) * 8 + Math.sin(wx / 17) * 3
        r(x, 130 - h, 1, h + 30, '#7a9a4a')
      }
      for (let i = Math.floor(off / 160) - 1; i < Math.floor(off / 160) + 3; i++) {
        if (hash(i + 3) < 0.5) continue
        const x = i * 160 + 60 - off
        r(x, 98, 18, 9, '#6e6e6e')
        r(x + 16, 96, 6, 8, '#6e6e6e')
        r(x + 21, 101, 2, 7, '#6e6e6e')
        r(x + 2, 107, 3, 5, '#6e6e6e')
        r(x + 12, 107, 3, 5, '#6e6e6e')
      }
    } else {
      for (let i = Math.floor(off / 18) - 2; i < Math.floor(off / 18) + 20; i++) {
        const x = i * 18 - off
        const y = 50 + hash(i) * 30
        g.fillStyle = hash(i + 9) > 0.5 ? '#1b3a26' : '#234a30'
        g.beginPath()
        g.arc(x, y, 16 + hash(i + 4) * 8, 0, Math.PI * 2)
        g.fill()
      }
      r(0, 70, SCREEN_W, 90, '#1b3a26')
    }
  }

  function drawMid(theme, cam, time) {
    const off = cam * 0.45
    if (theme === 'port') {
      for (let i = Math.floor(off / 210) - 1; i < Math.floor(off / 210) + 3; i++) {
        const x = i * 210 + 40 - off
        r(x, 40, 4, 116, '#a93226')
        r(x + 40, 40, 4, 116, '#a93226')
        r(x - 30, 40, 110, 5, '#c0490f')
        r(x + 10, 45, 0.5, 30, '#2c2c2c')
        r(x + 6, 75, 9, 6, '#f1c40f')
        for (let s = 0; s < 3; s++) {
          for (let c = 0; c < 2; c++) {
            const col = CONTAINER_COLORS[Math.floor(hash(i * 7 + s * 3 + c) * CONTAINER_COLORS.length)]
            r(x + 60 + c * 26, 146 - (s + 1) * 10, 24, 9, col)
            r(x + 60 + c * 26, 146 - (s + 1) * 10, 24, 1, '#00000033')
          }
        }
      }
    } else if (theme === 'lope') {
      for (let i = Math.floor(off / 120) - 1; i < Math.floor(off / 120) + 4; i++) {
        const x = i * 120 + hash(i) * 50 - off
        r(x + 10, 96, 4, 60, '#5b3a1e')
        r(x - 8, 88, 42, 8, '#3d5a1e')
        r(x - 2, 82, 30, 6, '#4a6b22')
      }
    } else {
      const fx = 140 - (off % 600)
      for (const base of [fx, fx + 600]) {
        r(base - 6, 40, 60, 116, '#35624a')
        for (let s = 0; s < 8; s++) {
          const y = (time * 60 + s * 17) % 120
          r(base + s * 6, 40, 4, 116, '#a9d6e5')
          r(base + s * 6, 40 + y, 4, 10, '#ffffff')
        }
      }
      for (let i = Math.floor(off / 90) - 1; i < Math.floor(off / 90) + 5; i++) {
        const x = i * 90 + hash(i) * 30 - off
        r(x, 60, 5, 96, '#2d1f12')
        r(x - 10, 56, 26, 10, '#2f6b2f')
      }
    }
  }

  // ---- Ground and platforms ---------------------------------------------------
  function drawGround(theme, sx, y, w, x0) {
    const t = THEMES[theme]
    g.fillStyle = vgrad(y, SCREEN_H, t.ground[0], t.ground[1])
    g.fillRect(q(sx), y, q(w), SCREEN_H - y)
    const from = Math.max(0, Math.floor(-sx) - 2)
    const to = Math.min(w, SCREEN_W - sx + 2)
    if (theme === 'port') {
      // Concrete quay: slabs, cracks, rusty bolts, a hazard stripe on the edges.
      r(sx, y, w, 2, t.groundTop)
      r(sx, y + 2, w, 0.5, '#9aa3a4')
      for (let bx = Math.ceil(from / 24) * 24; bx < to; bx += 24) {
        r(sx + bx, y + 2, 0.5, SCREEN_H - y, '#4f595a')
        if (hash(x0 + bx) > 0.5) r(sx + bx + 6 + hash(bx) * 8, y + 7, 3, 0.5, '#4f595a')
        r(sx + bx + 3, y + 4, 1, 1, '#8a5a3a')
      }
      for (let s = 0; s < 6; s += 2) {
        r(sx + s, y, 1, 2, '#f1c40f')
        r(sx + w - 1 - s, y, 1, 2, '#f1c40f')
      }
    } else {
      // Earth with stones and roots, grass blades along the top.
      for (let bx = Math.floor(from / 3) * 3; bx < to; bx += 3) {
        const h = hash(x0 + bx)
        if (h > 0.7) r(sx + bx, y + 5 + h * 14, 1.5, 1, '#00000040')
        if (h < 0.08) r(sx + bx, y + 4, 4, 0.5, theme === 'ivindo' ? '#6b4a2a' : '#c06a33')
      }
      r(sx, y, w, 2.5, t.groundTop)
      r(sx, y + 2.5, w, 0.5, '#00000055')
      for (let bx = Math.floor(from); bx < to; bx += 1) {
        const h = hash(x0 + bx * 1.7)
        if (h > 0.45) r(sx + bx, y - h * 2.5, 0.5, h * 2.5, h > 0.8 ? '#8fbf3a' : t.groundTop)
      }
    }
  }

  function drawPlatform(theme, sx, y, w, i) {
    if (theme === 'port') {
      // A shipping container, ribbed, with corner castings.
      const col = CONTAINER_COLORS[i % CONTAINER_COLORS.length]
      r(sx, y, w, 12, col)
      g.fillStyle = vgrad(y, y + 12, 'rgba(255,255,255,0.08)', 'rgba(0,0,0,0.35)')
      g.fillRect(q(sx), y, q(w), 12)
      for (let bx = 2; bx < w - 1; bx += 3) {
        r(sx + bx, y + 1, 0.5, 10, '#00000040')
        r(sx + bx + 0.5, y + 1, 0.5, 10, '#ffffff1a')
      }
      r(sx, y, w, 0.5, '#ffffff55')
      r(sx, y + 11.5, w, 0.5, '#00000088')
      for (const cx of [sx, sx + w - 2]) {
        r(cx, y, 2, 2, '#2b2b2b')
        r(cx, y + 10, 2, 2, '#2b2b2b')
      }
    } else if (theme === 'lope') {
      // A rock ledge with light on top and cracks.
      g.fillStyle = vgrad(y, y + 11, '#a8957f', '#5f5040')
      g.beginPath()
      g.moveTo(sx, y)
      g.lineTo(sx + w, y)
      g.lineTo(sx + w - 3, y + 8)
      g.lineTo(sx + w - 8, y + 11)
      g.lineTo(sx + 6, y + 11)
      g.lineTo(sx + 2, y + 7)
      g.closePath()
      g.fill()
      r(sx, y, w, 1, '#c4b29b')
      for (let c = 6; c < w - 6; c += 13) r(sx + c, y + 3 + (c % 3), 0.5, 4, '#4a3e32')
      for (let c = 2; c < w - 2; c += 4) if (hash(c + i) > 0.5) r(sx + c, y - 1.5, 0.5, 1.5, '#6aa121')
    } else {
      // An okoumé log: bark lines, moss, cut ends with rings.
      g.fillStyle = vgrad(y, y + 9, '#a06a36', '#5a3818')
      g.fillRect(q(sx), y, q(w), 9)
      for (let c = 3; c < w - 3; c += 5) r(sx + c, y + 2 + (c % 4), 3, 0.5, '#4a2e14')
      r(sx, y, w, 1.5, '#5d8a2e')
      for (let c = 1; c < w; c += 2) if (hash(c + i * 3) > 0.6) r(sx + c, y + 1.5, 1, 1, '#5d8a2e')
      for (const ex of [sx, sx + w - 4]) {
        r(ex, y + 0.5, 4, 8, '#d9a066')
        r(ex + 1, y + 2.5, 2, 4, '#b07a42')
        r(ex + 1.5, y + 4, 1, 1, '#d9a066')
      }
    }
  }

  function drawFloors(state, cam, time) {
    const mission = MISSIONS[state.mission]
    const theme = THEMES[mission.theme]
    // Water / pit under the gaps first.
    g.fillStyle = vgrad(GROUND_Y, SCREEN_H, theme.gap[0], theme.gap[1])
    g.fillRect(0, GROUND_Y + 2, SCREEN_W, SCREEN_H - GROUND_Y)
    if (mission.theme !== 'lope') {
      for (let i = 0; i < 24; i++) r(((i * 29 + time * 20) % 340) - 10, GROUND_Y + 5 + (i % 4) * 5, 6 + (i % 3) * 2, 0.5, '#ffffff40')
    }
    mission.floors.forEach(([x0, x1, y], i) => {
      const sx = x0 - cam
      const w = x1 - x0
      if (sx > SCREEN_W || sx + w < 0) return
      if (y === GROUND_Y) drawGround(mission.theme, sx, y, w, x0)
      else drawPlatform(mission.theme, sx, y, w, i)
    })
  }

  // ---- Characters, items, bosses ------------------------------------------------
  function drawEnemy(e, cam, time) {
    const x = e.x / FP - cam
    const y = e.y / FP
    const flash = e.flash > 0
    if (e.type === 'jeep') {
      g.fillStyle = flash ? '#ffffff' : vgrad(y - 14, y - 4, '#5d6828', '#323a14')
      g.fillRect(q(x - 17), y - 14, 34, 9.5)
      r(x - 17, y - 14, 34, 0.5, '#7d8a3a')
      r(x - 10, y - 20, 12, 6, flash ? '#ffffff' : '#3b421a')
      r(x - 8.5, y - 19.5, 8, 4, '#9fc5e8')
      r(x - 8.5, y - 19.5, 3, 4, '#d6eaf8')
      r(x - 23, y - 12.5, 9, 1.5, '#2b2b2b') // gun
      r(x - 24, y - 13, 1.5, 2.5, '#4a4a4a')
      r(x + 4, y - 26, 5, 6, '#4a2f1d') // gunner
      r(x + 3, y - 27, 7, 2, '#56672c')
      for (const wx of [-11, 9]) {
        g.fillStyle = '#121212'
        g.beginPath()
        g.arc(x + wx, y - 4, 4.5, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = '#5a5a5a'
        g.beginPath()
        g.arc(x + wx, y - 4, 1.8, 0, Math.PI * 2)
        g.fill()
      }
      return
    }
    if (e.type === 'drone') {
      const c = flash ? '#ffffff' : '#4d5359'
      r(x - 6, y - 3, 12, 5, c)
      r(x - 6, y - 3, 12, 1, '#7a8086')
      r(x - 2, y + 2, 4, 1.5, '#2b2b2b')
      const blade = Math.floor(time * 30) % 2 ? 7 : 3
      r(x - 9 - blade / 2, y - 5, blade, 0.5, '#e0e0e0')
      r(x + 9 - blade / 2, y - 5, blade, 0.5, '#e0e0e0')
      r(x - 9.5, y - 4.5, 1, 1.5, '#333')
      r(x + 8.5, y - 4.5, 1, 1.5, '#333')
      r(x - 0.5, y + 3.5, 1, 1, Math.floor(time * 4) % 2 ? '#ff3b30' : '#7a1c17')
      return
    }
    drawFigure(g, x, y, e.facing, LOOKS[e.type], {
      kind: e.type === 'sniper' ? 'kneel' : e.type === 'runner' ? 'run' : 'stand',
      frame: Math.floor(time * 10),
      gun: e.type === 'runner' ? 'none' : e.type === 'sniper' ? 'long' : 'rifle',
      flash,
    })
  }

  function drawItem(it, cam, time) {
    if (it.taken) return
    const x = it.x / FP - cam
    const y = it.y / FP + Math.sin(time * 4 + it.id) * 1.5
    if (it.kind === 'T' || it.kind === 'G') {
      // An ammo crate with yellow stencil.
      r(x - 7.5, y - 6.5, 15, 12, '#15140f')
      g.fillStyle = vgrad(y - 6, y + 5, '#7d8f3a', '#4a5520')
      g.fillRect(q(x - 7), y - 6, 14, 11)
      r(x - 7, y - 2, 14, 0.5, '#2f3614')
      r(x - 5, y - 4.5, 10, 1, '#e6c229')
      g.fillStyle = '#e6c229'
      g.font = 'bold 6px monospace'
      g.textAlign = 'center'
      g.fillText(it.kind === 'T' ? 'TRI' : 'GRN', x, y + 3.5)
    } else if (it.kind === 'M') {
      r(x - 6.5, y - 5.5, 13, 11, '#15140f')
      g.fillStyle = vgrad(y - 5, y + 5, '#fafafa', '#c8c8c8')
      g.fillRect(q(x - 6), y - 5, 12, 10)
      r(x - 1, y - 3, 2, 6, '#d63a2f')
      r(x - 3, y - 1, 6, 2, '#d63a2f')
    } else if (it.kind === 'H') {
      // A hostage tied up, waving for help.
      r(x - 4.5, y - 8.5, 9, 15, '#15140f')
      r(x - 4, y - 2, 8, 8, '#ecf0f1')
      r(x - 3, y - 8, 6, 6, '#5a3825')
      r(x - 5, y + 1, 10, 1, '#c8a165')
      r(x - 5, y + 3, 10, 0.5, '#c8a165')
      const wave = Math.floor(time * 4) % 2
      r(x + 4, y - 6 - wave * 2, 1.5, 5, '#5a3825')
      r(x - 2, y - 16, 4, 5, '#ffffff')
      r(x - 0.5, y - 15, 1, 2, '#d63a2f')
      r(x - 0.5, y - 12.5, 1, 1, '#d63a2f')
    } else if (it.kind === 'I') {
      g.strokeStyle = '#15140f'
      g.lineWidth = 4
      g.beginPath()
      g.arc(x, y + 4, 8, Math.PI * 1.1, Math.PI * 1.9)
      g.stroke()
      g.strokeStyle = '#fdfaf0'
      g.lineWidth = 2.5
      g.stroke()
    }
  }

  function drawBoss(state, cam, time) {
    const b = state.boss
    if (!b) return
    const x = b.x / FP - cam
    const y = b.y / FP
    const flash = b.flash > 0
    const c = (col) => (flash ? '#ffffff' : col)
    if (b.type === 'grutier') {
      r(0, y - 12, SCREEN_W, 4, '#6b7778')
      r(0, y - 12, SCREEN_W, 0.5, '#aab3b4')
      r(x + 20, y - 8, 16, 8, '#2c3e50')
      r(x - 0.5, y - 0.5, b.w + 1, b.h + 1, '#15140f')
      g.fillStyle = flash ? '#ffffff' : vgrad(y, y + b.h, '#f7d046', '#b8900c')
      g.fillRect(q(x), y, b.w, b.h)
      r(x + 4, y + 6, b.w - 8, 18, '#22313f')
      r(x + 6, y + 8, 14, 12, '#85c1e9')
      r(x + 30, y + 8, 18, 12, '#85c1e9')
      r(x + 6, y + 8, 4, 12, '#d6eaf8')
      r(x + 30, y + 8, 4, 12, '#d6eaf8')
      for (let s = 0; s < 6; s++) r(x + 4 + s * 8, y + 52, 4, 6, s % 2 ? '#15140f' : '#f1c40f')
      r(x + 8, y + 30, 40, 4, c('#d4ac0d'))
      r(x - 12, y + 43.5, 16, 3, '#2b2b2b')
      r(x + 24, y + b.h, 1, 14, '#2b2b2b')
      r(x + 20, y + b.h + 14, 10, 4, '#7f8c8d')
    } else if (b.type === 'gorille') {
      g.fillStyle = flash ? '#ffffff' : vgrad(y, y + 40, '#46596b', '#1f2b36')
      g.fillRect(q(x + 6), y + 6, 32, 30)
      r(x + 12, y, 20, 14, c('#2c3e50'))
      r(x + 12, y, 20, 1, '#5d7186')
      r(x + 15, y + 5, 4, 2.5, '#ff3b30')
      r(x + 25, y + 5, 4, 2.5, '#ff3b30')
      r(x + 15, y + 5, 1.5, 1, '#ffb3ad')
      r(x, y + 10, 8, 30, c('#2c3e50'))
      r(x + 36, y + 10, 8, 30, c('#2c3e50'))
      r(x, y + 10, 1, 30, '#5d7186')
      r(x + 10, y + 36, 9, 16, c('#22313f'))
      r(x + 25, y + 36, 9, 16, c('#22313f'))
      r(x + 14, y + 18, 16, 6, '#95a5a6')
      r(x + 14, y + 18, 16, 1, '#cfd8d9')
      for (let s = 0; s < 4; s++) r(x + 15 + s * 4, y + 20, 1, 1, '#5a6566')
    } else {
      g.fillStyle = flash ? '#ffffff' : vgrad(y + 24, y + 48, '#8a3a0a', '#3d1700')
      g.fillRect(q(x), y + 24, b.w, 24)
      r(x, y + 24, b.w, 1.5, c('#b85a1a'))
      for (let s = 4; s < b.w; s += 9) r(x + s, y + 30, 2, 2, '#c7781f')
      r(x + 40, y + 4, 26, 20, c('#7f8c8d'))
      r(x + 40, y + 4, 26, 1, '#b0babb')
      r(x + 44, y + 8, 8, 6, '#85c1e9')
      r(x + 56, y - 8, 5, 12, '#2c2c2c')
      for (let s = 0; s < 3; s++) {
        const sy = (time * 20 + s * 8) % 24
        g.globalAlpha = 0.6 - sy / 48
        r(x + 55 + s, y - 10 - sy, 4 + sy / 6, 3, '#9aa3a4')
        g.globalAlpha = 1
      }
      r(x + 4, y + 2, 30, 4, c('#d68910'))
      r(x - 4, y + 2, 10, 10, c('#b9770e'))
      r(x - 10, y + 30, 12, 2.5, '#2b2b2b')
    }
    const a = b.action
    if (a?.kind === 'drop' && a.t < 40 && Math.floor(time * 10) % 2) {
      const sx = a.x / FP - cam
      r(sx - 8, GROUND_Y - 2, 16, 1.5, '#ff3b30')
      r(sx - 1, GROUND_Y - 8, 2, 5, '#ff3b30')
    }
  }

  function drawShots(state, cam) {
    for (const s of state.bullets) {
      const x = s.x / FP - cam
      const y = s.y / FP
      if (s.grenade) {
        r(x - 2, y - 2, 4, 4, '#15140f')
        r(x - 1.5, y - 1.5, 3, 3, '#3f5a22')
      } else {
        const col = s.pierce ? '#7df9ff' : '#ffe066'
        // A tracer: bright head, fading tail.
        const tx = -Math.sign(s.vx) * 4
        const ty = -Math.sign(s.vy) * 4
        g.globalAlpha = 0.45
        r(x + Math.min(0, tx), y + Math.min(0, ty) - 0.5, Math.abs(tx) || 1, Math.abs(ty) || 1, col)
        g.globalAlpha = 1
        r(x - 1, y - 1, 2, 1.5, '#ffffff')
      }
    }
    for (const s of state.enemyShots) {
      const x = s.x / FP - cam
      const y = s.y / FP
      if (s.kind === 'crate') {
        r(x - 8.5, y - 8.5, 17, 17, '#15140f')
        g.fillStyle = vgrad(y - 8, y + 8, '#a46a32', '#5d3a1a')
        g.fillRect(q(x - 8), y - 8, 16, 16)
        r(x - 8, y - 0.5, 16, 1, '#3e260f')
        r(x - 0.5, y - 8, 1, 16, '#3e260f')
      } else if (s.kind === 'bomb') {
        r(x - 2, y - 2, 4, 5, '#121212')
        r(x - 1, y - 1.5, 1, 1, '#555')
      } else if (s.kind === 'wave') {
        r(x - 8, y - 2, 16, 6, '#e8d8b055')
        r(x - 5, y - 5, 10, 3, '#e8d8b0aa')
      } else {
        g.fillStyle = 'rgba(255,94,58,0.35)'
        g.beginPath()
        g.arc(x, y, 3.5, 0, Math.PI * 2)
        g.fill()
        r(x - 1.5, y - 1.5, 3, 3, '#ff5e3a')
        r(x - 0.5, y - 0.5, 1, 1, '#fff0d0')
      }
    }
  }

  function drawPlayer(state, cam, time) {
    const p = state.player
    const rolling = state.character === 'mboumba' && p.special > 0
    const hurt = p.invuln > 70 && !rolling
    if (p.invuln > 0 && !hurt && !rolling && Math.floor(time * 20) % 2) return // blinking after a hit
    const x = p.x / FP - cam
    const y = p.y / FP
    // Soft shadow on the ground.
    if (p.onGround) {
      g.fillStyle = 'rgba(0,0,0,0.3)'
      g.beginPath()
      g.ellipse(x, y, 7, 1.5, 0, 0, Math.PI * 2)
      g.fill()
    }
    if (rolling) {
      g.fillStyle = '#15140f'
      g.beginPath()
      g.arc(x, y - 8, 8.5, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = LOOKS.mboumba.top
      g.beginPath()
      g.arc(x, y - 8, 8, 0, Math.PI * 2)
      g.fill()
      r(x - 3, y - 14, 6, 3, LOOKS.mboumba.hat)
      return
    }
    const rate = WEAPONS[p.weapon].rate
    const throwing = p.weapon === 'grenade' && p.fireCooldown > rate - 8
    const firing = p.weapon !== 'grenade' && p.fireCooldown >= rate - 2
    const kind = hurt
      ? 'hurt'
      : !p.onGround
        ? 'jump'
        : throwing
          ? 'throw'
          : state.input.up
            ? 'up'
            : state.input.move !== 0
              ? 'run'
              : 'stand'
    drawFigure(g, x, y, p.facing, LOOKS[state.character], {
      kind: kind === 'jump' && state.input.up ? 'up' : kind,
      frame: Math.floor(p.walkTick / 5),
      muzzle: firing,
    })
    if (firing) {
      // Muzzle light on the surroundings.
      const mx = state.input.up ? x + p.facing * 4 : x + p.facing * 16
      const my = state.input.up ? y - 34 : y - 13
      const glow = g.createRadialGradient(mx, my, 0, mx, my, 16)
      glow.addColorStop(0, 'rgba(255,210,90,0.35)')
      glow.addColorStop(1, 'rgba(255,210,90,0)')
      g.fillStyle = glow
      g.fillRect(mx - 16, my - 16, 32, 32)
    }
    if (state.character === 'moussavou' && p.special > 0) {
      g.strokeStyle = '#7df9ff'
      g.lineWidth = 0.5
      g.strokeRect(q(x - 10), q(y - 30), 20, 30)
    }
  }

  function drawCorpses(cam, dt) {
    corpses = corpses.filter((c) => (c.t += dt) < 0.95)
    for (const c of corpses) {
      const x = c.x - cam
      if (c.t < 0.45) drawLying(g, x, c.y, c.look)
      else drawPuff(g, x, c.y, (c.t - 0.45) / 0.5)
    }
  }

  function drawParticles(cam, dt) {
    particles = particles.filter((pt) => (pt.life -= dt) > 0)
    for (const pt of particles) {
      pt.x += pt.vx * dt
      pt.y += pt.vy * dt
      pt.vy += (pt.gravity ?? 120) * dt
      if (pt.floor && pt.y > GROUND_Y) {
        pt.y = GROUND_Y
        pt.vy *= -0.35
        pt.vx *= 0.6
      }
      g.globalAlpha = Math.max(0, pt.life / pt.max) * (pt.alpha ?? 1)
      if (pt.round) {
        g.fillStyle = pt.color
        g.beginPath()
        g.arc(pt.x - cam, pt.y, pt.size * (pt.grow ? 1 + (1 - pt.life / pt.max) * 1.5 : 1), 0, Math.PI * 2)
        g.fill()
      } else {
        r(pt.x - cam, pt.y, pt.size, pt.size, pt.color)
      }
      g.globalAlpha = 1
    }
  }

  function burst(x, y, color, count, speed, size = 2) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const v = speed * (0.4 + Math.random() * 0.6)
      particles.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - 30, life: 0.5, max: 0.5, color, size })
    }
  }

  function smoke(x, y, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 12,
        vy: -8 - Math.random() * 10,
        gravity: -4,
        life: 1.4,
        max: 1.4,
        color: '#6b6b6b',
        size: 3 + Math.random() * 3,
        round: true,
        grow: true,
        alpha: 0.55,
      })
    }
  }

  // ---- Atmosphere ------------------------------------------------------------------
  function drawWeather(theme, cam, time) {
    if (theme === 'ivindo') {
      // Light shafts through the canopy, then rain, then mist at ground level.
      g.fillStyle = 'rgba(220,255,220,0.05)'
      for (let i = 0; i < 3; i++) {
        const bx = ((i * 130 - cam * 0.2) % 420 + 420) % 420 - 60
        g.beginPath()
        g.moveTo(bx, 0)
        g.lineTo(bx + 26, 0)
        g.lineTo(bx + 80, SCREEN_H)
        g.lineTo(bx + 40, SCREEN_H)
        g.closePath()
        g.fill()
      }
      g.fillStyle = 'rgba(190,215,230,0.35)'
      for (let i = 0; i < 70; i++) {
        const rx = ((hash(i) * 400 + time * 40 - cam * 0.6) % 360 + 360) % 360 - 20
        const ry = (hash(i + 50) * 200 + time * 260) % 200 - 10
        g.fillRect(q(rx), q(ry), 0.5, 4)
      }
      g.fillStyle = vgrad(GROUND_Y - 30, GROUND_Y + 6, 'rgba(200,230,215,0)', 'rgba(200,230,215,0.22)')
      g.fillRect(0, GROUND_Y - 30, SCREEN_W, 36)
    } else if (theme === 'lope') {
      g.fillStyle = vgrad(GROUND_Y - 24, GROUND_Y + 2, 'rgba(255,240,200,0)', 'rgba(255,240,200,0.15)')
      g.fillRect(0, GROUND_Y - 24, SCREEN_W, 26)
    }
    // Overall colour of the light.
    g.fillStyle = THEMES[theme].light
    g.fillRect(0, 0, SCREEN_W, SCREEN_H)
  }

  function drawBackdrop(img, cam) {
    // Fit the image height to the screen, scroll slower than the action and
    // alternate it with its mirror image so the loop has no visible seam.
    const scale = view.h / img.height
    const iw = img.width * scale
    const offset = (cam * PARALLAX * (view.h / SCREEN_H)) % (2 * iw)
    out.save()
    out.beginPath()
    out.rect(view.x, view.y, view.w, view.h)
    out.clip()
    out.imageSmoothingEnabled = true
    for (let k = Math.floor(offset / iw); view.x + k * iw - offset < view.x + view.w; k++) {
      const dx = view.x + k * iw - offset
      if (k % 2 === 0) out.drawImage(img, dx, view.y, iw, view.h)
      else {
        out.save()
        out.translate(dx + iw, view.y)
        out.scale(-1, 1)
        out.drawImage(img, 0, 0, iw, view.h)
        out.restore()
      }
    }
    out.restore()
  }

  return {
    resize(width, height) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      const scale = Math.min(canvas.width / SCREEN_W, canvas.height / SCREEN_H)
      const w = SCREEN_W * scale
      const h = SCREEN_H * scale
      view = { x: (canvas.width - w) / 2, y: (canvas.height - h) / 2, w, h }
    },
    // World events → particles and screen shake.
    handleEvents(state) {
      const p = state.player
      for (const e of state.events) {
        if (e.type === 'kill') {
          if (LOOKS[e.enemy]) corpses.push({ look: LOOKS[e.enemy], x: e.x / FP, y: e.y / FP, t: 0 })
          else {
            burst(e.x / FP, e.y / FP - 10, '#f39c12', 14, 90)
            smoke(e.x / FP, e.y / FP - 10, 6)
          }
        } else if (e.type === 'explosion') {
          burst(e.x / FP, e.y / FP, '#e67e22', 18, 110, 3)
          burst(e.x / FP, e.y / FP, '#f1c40f', 10, 70)
          smoke(e.x / FP, e.y / FP - 6, 8)
          shake = Math.max(shake, 0.2)
        } else if (e.type === 'shot' && e.weapon !== 'grenade') {
          // A spent casing jumps out of the rifle and bounces on the ground.
          particles.push({
            x: p.x / FP + p.facing * 3,
            y: p.y / FP - 15,
            vx: -p.facing * (25 + Math.random() * 25),
            vy: -45 - Math.random() * 20,
            gravity: 260,
            life: 0.7,
            max: 0.7,
            color: '#d9a62a',
            size: 1,
            floor: true,
          })
        } else if (e.type === 'hurt') shake = Math.max(shake, 0.3)
        else if (e.type === 'item') burst(p.x / FP, p.y / FP - 14, '#2ecc71', 12, 60)
        else if (e.type === 'bossDown' && state.boss) {
          const b = state.boss
          for (let i = 0; i < 4; i++) burst(b.x / FP + Math.random() * b.w, b.y / FP + Math.random() * b.h, '#e74c3c', 20, 140, 3)
          smoke(b.x / FP + b.w / 2, b.y / FP + b.h / 2, 20)
          shake = 0.8
        }
      }
      // Dust where the player lands.
      if (p.onGround && !wasOnGround) {
        for (let i = 0; i < 6; i++) {
          particles.push({
            x: p.x / FP + (i - 2.5) * 2,
            y: p.y / FP - 1,
            vx: (i - 2.5) * 12,
            vy: -10 - Math.random() * 8,
            gravity: 40,
            life: 0.45,
            max: 0.45,
            color: '#b7a58a',
            size: 1.5,
            round: true,
            alpha: 0.7,
          })
        }
      }
      wasOnGround = p.onGround
    },
    render(state, time, dt) {
      const mission = MISSIONS[state.mission]
      let cam = state.camX / FP
      if (shake > 0) {
        shake = Math.max(0, shake - dt)
        cam += (Math.random() - 0.5) * 6 * shake * 4
      }
      const painted = backdrop(mission.theme)

      g.setTransform(RES, 0, 0, RES, 0, 0)
      g.clearRect(0, 0, SCREEN_W, SCREEN_H)
      if (!painted) {
        drawSky(mission.theme)
        drawFar(mission.theme, cam, time)
        drawMid(mission.theme, cam, time)
      }
      drawFloors(state, cam, time)
      for (const it of state.items) drawItem(it, cam, time)
      drawBoss(state, cam, time)
      for (const e of state.enemies) drawEnemy(e, cam, time)
      drawCorpses(cam, dt)
      drawPlayer(state, cam, time)
      drawShots(state, cam)
      drawParticles(cam, dt)
      drawWeather(mission.theme, cam, time)

      out.fillStyle = '#000000'
      out.fillRect(0, 0, canvas.width, canvas.height)
      if (painted) {
        drawBackdrop(painted, cam)
        // Push the painting back a little so the action reads in front of it.
        out.fillStyle = 'rgba(0,0,0,0.18)'
        out.fillRect(view.x, view.y, view.w, view.h)
      }
      out.imageSmoothingEnabled = false
      out.drawImage(buf, view.x, view.y, view.w, view.h)

      // Cinematic vignette.
      const vig = out.createRadialGradient(
        view.x + view.w / 2, view.y + view.h / 2, view.h * 0.45,
        view.x + view.w / 2, view.y + view.h / 2, view.w * 0.65,
      )
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, 'rgba(0,0,0,0.38)')
      out.fillStyle = vig
      out.fillRect(view.x, view.y, view.w, view.h)
    },
  }
}
