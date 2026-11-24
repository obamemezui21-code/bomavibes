import { appFont } from '../../lib/fonts.js'
import { CLEAR_TICKS, COLS, GOLD, LEVELS, ROWS, isBrick, landing, planAt } from '../../../../shared/chantier-boma/engine.mjs'
import { MATERIAL_COLORS, paintBrick } from './bricks.js'

// CHANTIER BOMA's drawing: the landscape, the plan (blueprint), the bricks, and
// the crane with its load. World units: CELL per brick, WORLD_W × WORLD_H in
// all; the landscape goes on past it to fill the screen.
const CELL = 36
const WORLD_W = 360
const WORLD_H = 628
const GX = (WORLD_W - COLS * CELL) / 2
const GY = 34
const GROUND_Y = GY + ROWS * CELL
const BEAM_Y = 20

const SCENES = {
  case: { sky: ['#f7a04b', '#fcd9a0', '#fdf0d0'], sun: ['#fff3c4', 285, 130, 30], far: '#a9b27a', near: '#5d7a3a', ground: ['#b5552b', '#7a3418'], trees: 'forest' },
  mbandja: { sky: ['#4aa3c7', '#a9dbe0', '#eaf6dd'], sun: ['#fffbe0', 75, 120, 26], far: '#7fae8f', near: '#3c7050', ground: ['#a0622f', '#63381a'], trees: 'forest' },
  pilotis: { sky: ['#274b73', '#6f9cb8', '#f2c99a'], sun: ['#ffe0a8', 270, 330, 34], far: '#4f7a72', near: '#2c5548', ground: ['#3f88a0', '#1c4c63'], trees: 'palm', water: true },
  phare: { sky: ['#2b86c5', '#8fd0ee', '#e8f7fb'], sun: ['#fffdf0', 300, 110, 28], far: '#5fa9c9', near: '#e2cd94', ground: ['#d9bd7c', '#a58345'], trees: 'palm', sea: true },
  nkembo: { sky: ['#3a1d5c', '#a8456f', '#f6a85f'], sun: ['#ffd9a0', 70, 360, 36], far: '#5b2f5c', near: '#35204a', ground: ['#8a4a32', '#4d2519'], trees: 'city' },
}

export function createChantierRenderer(canvas) {
  const ctx = canvas.getContext('2d')
  let dpr = 1
  let vw = 0
  let vh = 0
  let scale = 1
  let ox = 0
  let oy = 0
  let backdrop = null
  let backdropLevel = -1
  let tiles = {} // material → picture, at the screen's size
  let drops = new Map() // bricks slipping down their column: "x,y" → { from, t }
  let particles = []
  let popups = []
  let shake = 0
  let collapseAt = 0
  let loadX = null // the load's drawn place, catching up with the real one
  let loadId = 0
  let raised = new Map() // formwork just put in: "x,y" → age
  let lastFloor = null
  let fireworkIn = 0

  function resize(w, h) {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5)
    vw = Math.max(1, w)
    vh = Math.max(1, h)
    canvas.width = Math.round(vw * dpr)
    canvas.height = Math.round(vh * dpr)
    scale = Math.min(vw / WORLD_W, vh / WORLD_H)
    ox = (vw - WORLD_W * scale) / 2
    oy = vh - WORLD_H * scale
    backdrop = null
    tiles = {}
  }

  function tile(m) {
    if (!tiles[m]) {
      const size = Math.max(8, Math.round(CELL * scale * dpr))
      const c = document.createElement('canvas')
      c.width = size
      c.height = size
      const g = c.getContext('2d')
      g.scale(size / 100, size / 100)
      paintBrick(g, m)
      tiles[m] = c
    }
    return tiles[m]
  }

  // ---- Landscape ----------------------------------------------------------

  function makeBackdrop(level) {
    const c = document.createElement('canvas')
    c.width = canvas.width
    c.height = canvas.height
    const g = c.getContext('2d')
    g.setTransform(scale * dpr, 0, 0, scale * dpr, ox * dpr, oy * dpr)
    const x0 = -ox / scale
    const x1 = (vw - ox) / scale
    const y0 = -oy / scale
    const s = SCENES[LEVELS[level].id]
    const sky = g.createLinearGradient(0, y0, 0, GROUND_Y)
    s.sky.forEach((col, i) => sky.addColorStop(i / (s.sky.length - 1), col))
    g.fillStyle = sky
    g.fillRect(x0, y0, x1 - x0, WORLD_H - y0 + 4)

    const [sunCol, sx, sy, sr] = s.sun
    const glow = g.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 4)
    glow.addColorStop(0, sunCol)
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    g.globalAlpha = 0.55
    g.fillStyle = glow
    g.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8)
    g.globalAlpha = 1
    g.fillStyle = sunCol
    g.beginPath()
    g.arc(sx, sy, sr, 0, Math.PI * 2)
    g.fill()

    g.fillStyle = 'rgba(255,255,255,0.35)'
    for (const [cx, cy, r] of [[60, 190, 16], [80, 184, 22], [104, 190, 15], [250, 235, 14], [270, 229, 19], [292, 236, 13]]) {
      g.beginPath()
      g.ellipse(cx, cy, r * 1.7, r * 0.55, 0, 0, Math.PI * 2)
      g.fill()
    }

    const hills = (col, base, amp, freq, phase) => {
      g.fillStyle = col
      g.beginPath()
      g.moveTo(x0, GROUND_Y)
      for (let x = x0; x <= x1 + 8; x += 8) g.lineTo(x, base - Math.sin(x * freq + phase) * amp - Math.sin(x * freq * 2.3 + phase) * amp * 0.4)
      g.lineTo(x1 + 8, GROUND_Y)
      g.fill()
    }
    if (s.sea) {
      g.fillStyle = s.far
      g.fillRect(x0, GROUND_Y - 130, x1 - x0, 130)
      g.strokeStyle = 'rgba(255,255,255,0.45)'
      g.lineWidth = 1.5
      for (let i = 0; i < 26; i++) {
        const wx = x0 + (((i * 137) % 97) / 97) * (x1 - x0)
        const wy = GROUND_Y - 122 + ((i * 53) % 110)
        g.beginPath()
        g.moveTo(wx, wy)
        g.quadraticCurveTo(wx + 8, wy - 4, wx + 16, wy)
        g.stroke()
      }
      hills(s.near, GROUND_Y - 8, 6, 0.02, 1)
    } else {
      hills(s.far, GROUND_Y - 120, 22, 0.017, 1.2)
      hills(s.near, GROUND_Y - 50, 14, 0.024, 2.6)
    }

    const palm = (x, h) => {
      g.strokeStyle = 'rgba(38,28,18,0.75)'
      g.lineWidth = 5
      g.beginPath()
      g.moveTo(x, GROUND_Y)
      g.quadraticCurveTo(x + 10, GROUND_Y - h * 0.5, x + 4, GROUND_Y - h)
      g.stroke()
      g.strokeStyle = 'rgba(30,66,36,0.85)'
      g.lineWidth = 4
      for (let a = 0; a < 7; a++) {
        const ang = Math.PI + (a * Math.PI) / 6
        g.beginPath()
        g.moveTo(x + 4, GROUND_Y - h)
        g.quadraticCurveTo(x + 4 + Math.cos(ang) * 22, GROUND_Y - h + Math.sin(ang) * 24 - 6, x + 4 + Math.cos(ang) * 40, GROUND_Y - h + Math.sin(ang) * 22 + 14)
        g.stroke()
      }
    }
    const tree = (x, h, r) => {
      g.fillStyle = 'rgba(52,34,20,0.75)'
      g.fillRect(x - 3, GROUND_Y - h, 6, h)
      g.fillStyle = 'rgba(28,62,32,0.8)'
      for (const [dx, dy, k] of [[0, 0, 1], [-r * 0.7, r * 0.35, 0.7], [r * 0.7, r * 0.3, 0.75]]) {
        g.beginPath()
        g.arc(x + dx, GROUND_Y - h + dy, r * k, 0, Math.PI * 2)
        g.fill()
      }
    }
    const tower = (x, w, h) => {
      g.fillStyle = 'rgba(30,16,44,0.75)'
      g.fillRect(x, GROUND_Y - h, w, h)
      g.fillStyle = 'rgba(255,214,140,0.5)'
      for (let wy = GROUND_Y - h + 8; wy < GROUND_Y - 10; wy += 14) {
        for (let wx = x + 5; wx < x + w - 6; wx += 11) if ((wx * 7 + wy * 3) % 5 < 2.5) g.fillRect(wx, wy, 5, 6)
      }
    }
    for (let x = x0 - 10, i = 0; x < x1 + 10; x += 58, i++) {
      if (s.trees === 'palm') palm(x + 12, 120 + ((i * 41) % 60))
      else if (s.trees === 'city') tower(x, 34 + ((i * 17) % 18), 70 + ((i * 47) % 90))
      else tree(x + 14, 90 + ((i * 37) % 60), 26 + ((i * 13) % 12))
    }

    const ground = g.createLinearGradient(0, GROUND_Y, 0, WORLD_H)
    ground.addColorStop(0, s.ground[0])
    ground.addColorStop(1, s.ground[1])
    g.fillStyle = ground
    g.fillRect(x0, GROUND_Y, x1 - x0, WORLD_H - GROUND_Y + 4)
    if (s.water) {
      g.strokeStyle = 'rgba(255,255,255,0.35)'
      g.lineWidth = 1.5
      for (let i = 0; i < 20; i++) {
        const wx = x0 + (((i * 61) % 89) / 89) * (x1 - x0)
        const wy = GROUND_Y + 6 + ((i * 29) % (WORLD_H - GROUND_Y - 8))
        g.beginPath()
        g.moveTo(wx, wy)
        g.quadraticCurveTo(wx + 9, wy - 4, wx + 18, wy)
        g.stroke()
      }
    } else {
      g.fillStyle = 'rgba(255,255,255,0.12)'
      for (let i = 0; i < 40; i++) g.fillRect(x0 + (((i * 73) % 101) / 101) * (x1 - x0), GROUND_Y + 6 + ((i * 31) % 40), 3, 2)
    }
    return c
  }

  // ---- Pieces -------------------------------------------------------------

  const px = (x) => GX + x * CELL
  const py = (y) => GY + y * CELL

  function drawBrick(m, x, y, alpha = 1) {
    ctx.globalAlpha = alpha
    ctx.drawImage(tile(m), x, y, CELL, CELL)
    ctx.globalAlpha = 1
  }

  function drawCrack(x, y) {
    ctx.fillStyle = 'rgba(120,0,0,0.28)'
    ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2)
    const zig = [[0.5, 0.02], [0.4, 0.22], [0.6, 0.38], [0.42, 0.56], [0.62, 0.72], [0.48, 0.98]]
    const branch = [[0.6, 0.38], [0.85, 0.3], [0.97, 0.42]]
    for (const [col, width] of [['rgba(255,255,255,0.5)', 4], ['#1a0c06', 2.2]]) {
      ctx.strokeStyle = col
      ctx.lineWidth = width
      for (const line of [zig, branch]) {
        ctx.beginPath()
        line.forEach(([a, b], i) => (i ? ctx.lineTo(x + a * CELL, y + b * CELL) : ctx.moveTo(x + a * CELL, y + b * CELL)))
        ctx.stroke()
      }
    }
  }

  function drawFormwork(x, y, age) {
    const k = Math.min(1, age / 0.25)
    const s = CELL * k
    const X = px(x) + (CELL - s) / 2
    const Y = py(y) + (CELL - s)
    ctx.fillStyle = 'rgba(214,178,120,0.35)'
    ctx.fillRect(X + 1, Y + 1, s - 2, s - 2)
    ctx.strokeStyle = '#d8b27a'
    ctx.lineWidth = 3
    ctx.strokeRect(X + 3, Y + 3, s - 6, s - 6)
    ctx.beginPath()
    ctx.moveTo(X + 4, Y + 4)
    ctx.lineTo(X + s - 4, Y + s - 4)
    ctx.moveTo(X + s - 4, Y + 4)
    ctx.lineTo(X + 4, Y + s - 4)
    ctx.stroke()
  }

  // An opening of the finished building: a lit room, or the dark if it's a door.
  function drawOpening(x, y, alpha) {
    const X = px(x)
    const Y = py(y)
    const g = ctx.createLinearGradient(0, Y, 0, Y + CELL)
    g.addColorStop(0, '#ffcf70')
    g.addColorStop(1, '#8a4a1c')
    ctx.globalAlpha = alpha
    ctx.fillStyle = '#23140b'
    ctx.fillRect(X, Y, CELL, CELL)
    ctx.globalAlpha = alpha * 0.75
    ctx.fillStyle = g
    ctx.fillRect(X + 3, Y, CELL - 6, CELL)
    ctx.globalAlpha = 1
  }

  // The blueprint behind the site; folded away once the building is done.
  function drawSheet(alpha) {
    ctx.globalAlpha = alpha
    ctx.fillStyle = 'rgba(14,30,56,0.8)'
    ctx.fillRect(GX - 4, GY - 2, COLS * CELL + 8, ROWS * CELL + 2)
    ctx.strokeStyle = 'rgba(190,220,255,0.10)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 0; x <= COLS; x++) {
      ctx.moveTo(GX + x * CELL, GY)
      ctx.lineTo(GX + x * CELL, GROUND_Y)
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.moveTo(GX, GY + y * CELL)
      ctx.lineTo(GX + COLS * CELL, GY + y * CELL)
    }
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  function drawPlan(state) {
    const { level, floor } = state
    const nextUp = new Set()
    for (let x = 0; x < COLS; x++) nextUp.add(`${x},${floor[x] - 1}`)
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = planAt(level, x, y)
        if (c === '.' || y >= floor[x]) continue
        if (isBrick(c)) {
          const hot = nextUp.has(`${x},${y}`)
          drawBrick(c, px(x), py(y), hot ? 0.58 : 0.4)
          ctx.strokeStyle = hot ? MATERIAL_COLORS[c] : 'rgba(255,255,255,0.28)'
          ctx.lineWidth = hot ? 2 : 1
          ctx.setLineDash([4, 3])
          ctx.strokeRect(px(x) + 1.5, py(y) + 1.5, CELL - 3, CELL - 3)
          ctx.setLineDash([])
        } else if (c === 'o') {
          ctx.strokeStyle = 'rgba(255,255,255,0.22)'
          ctx.lineWidth = 1
          ctx.setLineDash([2, 4])
          ctx.strokeRect(px(x) + 3, py(y) + 3, CELL - 6, CELL - 6)
          ctx.setLineDash([])
        }
      }
    }
  }

  function drawSite(state, time) {
    const { level, floor } = state
    const clearing = state.phase === 'clear'
    const gone = clearing ? Math.min(1, state.phaseTick / 40) : 0

    if (clearing) {
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (planAt(level, x, y) === 'o') drawOpening(x, y, gone)
    }
    if (gone < 1) {
      ctx.globalAlpha = 1 - gone
      for (let x = 0; x < COLS; x++) {
        for (let y = floor[x]; y < ROWS; y++) {
          const c = planAt(level, x, y)
          if (c === 'o' || c === '#') drawFormwork(x, y, raised.get(`${x},${y}`) ?? 9)
        }
      }
      ctx.globalAlpha = 1
    }

    const collapsing = collapseAt ? time - collapseAt : 0
    for (const b of state.bricks) {
      let X = px(b.x)
      let Y = py(b.y)
      const drop = drops.get(`${b.x},${b.y}`)
      if (drop) Y = py(drop.y)
      if (collapsing > 0) {
        const side = b.x - 4 + ((b.y * 7 + b.x * 3) % 5) / 5 - 0.4
        const late = Math.max(0, collapsing - ((ROWS - b.y) % 4) * 0.06)
        X += side * 46 * late
        Y += 640 * late * late - 60 * late
        ctx.save()
        ctx.translate(X + CELL / 2, Y + CELL / 2)
        ctx.rotate(side * late * 1.4)
        ctx.translate(-X - CELL / 2, -Y - CELL / 2)
        drawBrick(b.m, X, Y)
        ctx.restore()
        continue
      }
      drawBrick(b.m, X, Y)
      if (b.gold) {
        ctx.strokeStyle = `rgba(255,222,110,${0.65 + 0.3 * Math.sin(time * 4 + b.x)})`
        ctx.lineWidth = 2.5
        ctx.strokeRect(X + 2, Y + 2, CELL - 4, CELL - 4)
      }
      if (!b.ok) drawCrack(X, Y)
    }
    if (clearing) {
      const k = Math.sin(Math.min(1, state.phaseTick / 50) * Math.PI)
      ctx.globalAlpha = k * 0.3
      ctx.fillStyle = '#fff2c0'
      for (const b of state.bricks) ctx.fillRect(px(b.x), py(b.y), CELL, CELL)
      ctx.globalAlpha = 1
    }
  }

  function drawGhost(state) {
    const { load } = state
    for (const s of landing(state.level, state.floor, load.cells, load.x)) {
      const m = load.mats[s.i]
      const inside = isBrick(s.want)
      const ok = inside && (m === GOLD || m === s.want)
      const X = px(s.x)
      const Y = py(s.y)
      if (inside) drawBrick(m, X, Y, 0.6)
      ctx.strokeStyle = ok ? '#4dff9a' : '#ff5a4d'
      ctx.lineWidth = 3
      ctx.strokeRect(X + 2, Y + 2, CELL - 4, CELL - 4)
      ctx.fillStyle = ok ? '#12a558' : '#d92d20'
      ctx.beginPath()
      ctx.arc(X + CELL - 8, Y + 8, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.beginPath()
      if (ok) {
        ctx.moveTo(X + CELL - 11.5, Y + 8)
        ctx.lineTo(X + CELL - 9, Y + 10.5)
        ctx.lineTo(X + CELL - 4.5, Y + 5.5)
      } else {
        ctx.moveTo(X + CELL - 10.5, Y + 5.5)
        ctx.lineTo(X + CELL - 5.5, Y + 10.5)
        ctx.moveTo(X + CELL - 5.5, Y + 5.5)
        ctx.lineTo(X + CELL - 10.5, Y + 10.5)
      }
      ctx.stroke()
    }
  }

  function drawCrane(x0, x1, hookX, hookY) {
    ctx.fillStyle = '#f2a516'
    ctx.fillRect(x0, BEAM_Y - 8, x1 - x0, 4)
    ctx.fillRect(x0, BEAM_Y + 4, x1 - x0, 4)
    ctx.strokeStyle = '#c77f06'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = Math.floor(x0 / 14) * 14; x < x1; x += 14) {
      ctx.moveTo(x, BEAM_Y + 4)
      ctx.lineTo(x + 7, BEAM_Y - 5)
      ctx.lineTo(x + 14, BEAM_Y + 4)
    }
    ctx.stroke()
    ctx.fillStyle = '#2a2f38'
    ctx.fillRect(hookX - 14, BEAM_Y + 2, 28, 10)
    ctx.fillStyle = '#f2a516'
    ctx.fillRect(hookX - 9, BEAM_Y + 5, 18, 4)
    if (hookY > BEAM_Y + 12) {
      ctx.strokeStyle = 'rgba(20,22,28,0.85)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(hookX, BEAM_Y + 12)
      ctx.lineTo(hookX, hookY)
      ctx.stroke()
      ctx.fillStyle = '#2a2f38'
      ctx.beginPath()
      ctx.arc(hookX, hookY - 2, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  function drawLoad(state, dt) {
    const { load } = state
    if (loadId !== load.id || loadX === null) {
      loadId = load.id
      loadX = load.x
    }
    loadX += (load.x - loadX) * Math.min(1, dt * 24)
    const y = load.y + Math.min(1, load.fall / load.every)
    const xs = load.cells.map((c) => c[0])
    const ys = load.cells.map((c) => c[1])
    const mid = (Math.min(...xs) + Math.max(...xs) + 1) / 2
    const topY = py(y + Math.min(...ys))
    load.cells.forEach(([dx, dy], i) => {
      const X = px(loadX + dx)
      const Y = py(y + dy)
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(X + 3, Y + 4, CELL, CELL)
      drawBrick(load.mats[i], X, Y)
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.strokeRect(X + 1, Y + 1, CELL - 2, CELL - 2)
    })
    return { x: px(loadX + mid), y: topY }
  }

  // ---- Effects ------------------------------------------------------------

  function dust(x, y, color, n, speed = 90) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const v = speed * (0.3 + Math.random() * 0.7)
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, size: 2 + Math.random() * 4, color, life: 0.5 + Math.random() * 0.4, age: 0, g: 320 })
    }
  }

  function firework() {
    const colors = ['#009e60', '#fcd116', '#3a75c4', '#ff6fae', '#ffffff']
    const x = 40 + Math.random() * 280
    const y = 60 + Math.random() * 170
    const color = colors[Math.floor(Math.random() * colors.length)]
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2
      const v = 70 + Math.random() * 50
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: 3, color, life: 0.9, age: 0, g: 90 })
    }
  }

  function popup(text, x, y, color, size = 16) {
    popups.push({ text, x, y, color, size, age: 0 })
  }

  function handleEvents(state) {
    for (const e of state.events) {
      if (e.type === 'landed') {
        let sx = 0
        for (const s of e.landed) {
          const X = px(s.x) + CELL / 2
          const Y = py(s.y) + CELL / 2
          sx += X
          if (s.result === 'broken') {
            dust(X, Y, MATERIAL_COLORS[s.m], 18, 150)
            shake = Math.max(shake, 5)
          } else {
            drops.set(`${s.x},${s.y}`, { y: Math.min(s.fromY, s.y), to: s.y, v: 12 })
            dust(X, Y + CELL / 2, s.result === 'good' ? 'rgba(255,240,210,0.8)' : '#7a1a10', 6, 60)
            if (s.result === 'cracked') shake = Math.max(shake, 3)
          }
        }
        const last = e.landed[e.landed.length - 1]
        const X = Math.max(60, Math.min(300, sx / e.landed.length))
        const Y = Math.max(90, py(last.y) - 6)
        if (e.perfect) popup(`Parfait ! +${e.points}`, X, Y, '#7dffb3', 17)
        else if (e.landed.some((s) => s.result === 'broken')) popup('Hors du plan !', X, Y, '#ff8a7a', 17)
        else popup('Fissure', X, Y, '#ffc27a', 15)
      } else if (e.type === 'barrow') {
        dust(WORLD_W / 2, 80, '#e0b64a', 14, 120)
      } else if (e.type === 'barrowBack') {
        popup('+1 brouette', WORLD_W / 2, 120, '#ffe08a', 18)
      } else if (e.type === 'level') {
        drops = new Map()
        raised = new Map()
        lastFloor = null
      } else if (e.type === 'clear') {
        fireworkIn = 0.2
      } else if (e.type === 'collapse') {
        collapseAt = performance.now() / 1000
        shake = 16
      }
    }
  }

  // ---- A picture ----------------------------------------------------------

  function render(state, time, dt, showLoad = true) {
    if (!backdrop || backdropLevel !== state.level) {
      backdrop = makeBackdrop(state.level)
      backdropLevel = state.level
    }
    for (const [key, d] of drops) {
      d.v += dt * 160
      d.y += d.v * dt
      if (d.y >= d.to) drops.delete(key)
    }
    for (const [key, age] of raised) {
      if (age > 1) raised.delete(key)
      else raised.set(key, age + dt)
    }
    if (lastFloor) {
      for (let x = 0; x < COLS; x++) {
        for (let y = state.floor[x]; y < lastFloor[x]; y++) if (!isBrick(planAt(state.level, x, y))) raised.set(`${x},${y}`, 0)
      }
    }
    lastFloor = state.floor
    if (state.phase === 'clear' && state.phaseTick < CLEAR_TICKS - 50) {
      fireworkIn -= dt
      if (fireworkIn <= 0) {
        firework()
        fireworkIn = 0.28
      }
    }
    shake = Math.max(0, shake - dt * 22)

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(backdrop, 0, 0)
    const jx = shake ? (Math.random() - 0.5) * shake : 0
    const jy = shake ? (Math.random() - 0.5) * shake : 0
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, (ox + jx) * dpr, (oy + jy) * dpr)

    drawSheet(state.phase === 'clear' ? Math.max(0, 1 - state.phaseTick / 45) : 1)
    if (state.phase !== 'clear') drawPlan(state)
    drawSite(state, time)
    const live = showLoad && state.load && state.phase === 'build' && !state.over
    if (live) drawGhost(state)
    const hook = live ? drawLoad(state, dt) : { x: loadX === null ? WORLD_W / 2 : px(loadX) + CELL / 2, y: BEAM_Y + 26 }
    drawCrane(-ox / scale, (vw - ox) / scale, hook.x, hook.y)

    particles = particles.filter((p) => (p.age += dt) < p.life)
    for (const p of particles) {
      p.vy += p.g * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      ctx.globalAlpha = 1 - p.age / p.life
      ctx.fillStyle = p.color
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
    }
    ctx.globalAlpha = 1
    popups = popups.filter((p) => (p.age += dt) < 1.1)
    ctx.textAlign = 'center'
    for (const p of popups) {
      ctx.globalAlpha = Math.min(1, (1.1 - p.age) * 2)
      ctx.font = `800 ${p.size}px ${appFont("'Outfit Variable', system-ui, sans-serif")}`
      ctx.lineWidth = 4
      ctx.strokeStyle = 'rgba(0,0,0,0.75)'
      ctx.strokeText(p.text, p.x, p.y - p.age * 34)
      ctx.fillStyle = p.color
      ctx.fillText(p.text, p.x, p.y - p.age * 34)
    }
    ctx.globalAlpha = 1
  }

  return { resize, render, handleEvents, cellSize: () => CELL * scale }
}
