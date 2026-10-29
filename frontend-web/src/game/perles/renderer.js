import { BALL, COLORS, FP, H, LEVELS, SHOOTER, W, pathOf, pointAt, progressOf } from '../../../../shared/perles-punu/engine.mjs'

// PERLES PUNU on a canvas: each stage's backdrop with its river bed (drawn
// once per size), the beads rolling along it, the Punu mask that throws
// them, the aiming guide, and the bursts. Everything is drawn here, no
// pictures to load.

const R = BALL / 2

// Bead colours: light, body, shade — and a mark for each, so the colours
// can be told apart without seeing them.
export const BEAD_COLORS = {
  rouge: ['#ff8a7a', '#d63a2c', '#7b1d14'],
  jaune: ['#fff0a0', '#f2b90f', '#8a6300'],
  vert: ['#9af5b8', '#24a858', '#0e5229'],
  bleu: ['#a6dcff', '#2a7fd4', '#113a6d'],
  violet: ['#e2bcff', '#9146b8', '#47195f'],
  blanc: ['#ffffff', '#ddd5c4', '#867b65'],
}

// Each stage's look: backdrop gradient, foliage, river bed and water.
const THEMES = {
  lope: { top: '#3f5a22', bottom: '#1f3612', leaf: ['#4f7a2a', '#6b8f32', '#2e5219'], bed: '#4a3420', water: '#8a6a3c', glow: '#e7c26a' },
  pongara: { top: '#1d5a63', bottom: '#0f3238', leaf: ['#2f7a5a', '#3e9476', '#1e5246'], bed: '#c9b07a', water: '#e6d3a1', glow: '#fff1c4' },
  cristal: { top: '#3a4c66', bottom: '#16233a', leaf: ['#3b6b55', '#527f6a', '#24483a'], bed: '#2f3e52', water: '#7c93ad', glow: '#c9e6ff' },
  loango: { top: '#5b4a2a', bottom: '#2c2212', leaf: ['#6d7a2e', '#8b8e3a', '#46521d'], bed: '#3d2b19', water: '#9b7a46', glow: '#ffd27a' },
  kongou: { top: '#164035', bottom: '#081d18', leaf: ['#1f6a4a', '#2b8a5e', '#114630'], bed: '#203a40', water: '#5a95a3', glow: '#bff6ff' },
}

function rand(seed) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let x = Math.imul(t ^ (t >>> 15), t | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function tracePath(g, path, from = 0, to = path.length) {
  g.beginPath()
  g.moveTo(path.xs[from] / FP, path.ys[from] / FP)
  for (let i = from + 3; i <= to; i += 3) g.lineTo(path.xs[i] / FP, path.ys[i] / FP)
  g.lineTo(path.xs[to] / FP, path.ys[to] / FP)
}

// The stage's backdrop, in world units (the caller scales the context).
function drawBackdrop(g, level) {
  const lv = LEVELS[level]
  const t = THEMES[lv.id]
  const path = pathOf(level)
  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, t.top)
  grad.addColorStop(1, t.bottom)
  g.fillStyle = grad
  g.fillRect(-W, -H, W * 3, H * 3)

  // Foliage and stones, scattered.
  const r = rand(level * 977 + 13)
  for (let i = 0; i < 70; i++) {
    const x = r() * W
    const y = r() * H
    const size = 8 + r() * 26
    g.fillStyle = t.leaf[i % t.leaf.length]
    g.globalAlpha = 0.25 + r() * 0.35
    g.beginPath()
    g.ellipse(x, y, size, size * (0.5 + r() * 0.4), r() * Math.PI, 0, Math.PI * 2)
    g.fill()
  }
  // Leaves: thin almond shapes.
  for (let i = 0; i < 60; i++) {
    const x = r() * W
    const y = r() * H
    const len = 6 + r() * 12
    const a = r() * Math.PI * 2
    g.globalAlpha = 0.35 + r() * 0.3
    g.fillStyle = t.leaf[(i + 1) % t.leaf.length]
    g.save()
    g.translate(x, y)
    g.rotate(a)
    g.beginPath()
    g.moveTo(-len, 0)
    g.quadraticCurveTo(0, -len * 0.45, len, 0)
    g.quadraticCurveTo(0, len * 0.45, -len, 0)
    g.fill()
    g.restore()
  }
  g.globalAlpha = 1

  // The river bed the beads roll in.
  g.lineCap = 'round'
  g.lineJoin = 'round'
  tracePath(g, path)
  g.strokeStyle = 'rgba(0,0,0,0.35)'
  g.lineWidth = BALL + 12
  g.stroke()
  g.strokeStyle = t.bed
  g.lineWidth = BALL + 8
  g.stroke()
  g.strokeStyle = t.water
  g.globalAlpha = 0.55
  g.lineWidth = BALL + 2
  g.stroke()
  g.globalAlpha = 0.35
  g.setLineDash([2, 9])
  g.strokeStyle = t.glow
  g.lineWidth = 1.5
  g.stroke()
  g.setLineDash([])
  g.globalAlpha = 1

  // The falls at the end: a dark pool.
  const end = { x: path.xs[path.length] / FP, y: path.ys[path.length] / FP }
  const pool = g.createRadialGradient(end.x, end.y, 2, end.x, end.y, 24)
  pool.addColorStop(0, '#000')
  pool.addColorStop(0.6, '#0b1620')
  pool.addColorStop(1, 'rgba(11,22,32,0)')
  g.fillStyle = pool
  g.beginPath()
  g.arc(end.x, end.y, 24, 0, Math.PI * 2)
  g.fill()
  // A soft light around the mask.
  const halo = g.createRadialGradient(SHOOTER.x, SHOOTER.y, 10, SHOOTER.x, SHOOTER.y, 80)
  halo.addColorStop(0, 'rgba(255,240,210,0.22)')
  halo.addColorStop(1, 'rgba(255,240,210,0)')
  g.fillStyle = halo
  g.beginPath()
  g.arc(SHOOTER.x, SHOOTER.y, 80, 0, Math.PI * 2)
  g.fill()
}

// One bead's picture (body + mark), drawn at size px; the shine is drawn
// separately so it doesn't roll with the bead.
function beadSprite(color, px) {
  const c = document.createElement('canvas')
  c.width = c.height = Math.ceil(px)
  const g = c.getContext('2d')
  const r = px / 2
  const [light, body, shade] = BEAD_COLORS[color]
  const grad = g.createRadialGradient(r * 0.7, r * 0.6, r * 0.1, r, r, r)
  grad.addColorStop(0, light)
  grad.addColorStop(0.5, body)
  grad.addColorStop(1, shade)
  g.fillStyle = grad
  g.beginPath()
  g.arc(r, r, r * 0.96, 0, Math.PI * 2)
  g.fill()
  // The mark.
  g.translate(r, r)
  g.fillStyle = color === 'blanc' || color === 'jaune' ? 'rgba(60,40,10,0.45)' : 'rgba(255,255,255,0.55)'
  g.strokeStyle = g.fillStyle
  g.lineWidth = r * 0.16
  const m = r * 0.42
  g.beginPath()
  switch (color) {
    case 'rouge':
      g.arc(0, 0, m * 0.55, 0, Math.PI * 2)
      g.fill()
      break
    case 'jaune':
      g.moveTo(0, -m)
      g.lineTo(m * 0.8, 0)
      g.lineTo(0, m)
      g.lineTo(-m * 0.8, 0)
      g.closePath()
      g.fill()
      break
    case 'vert':
      g.moveTo(0, -m)
      g.lineTo(m * 0.9, m * 0.7)
      g.lineTo(-m * 0.9, m * 0.7)
      g.closePath()
      g.fill()
      break
    case 'bleu':
      g.rect(-m * 0.7, -m * 0.7, m * 1.4, m * 1.4)
      g.fill()
      break
    case 'violet':
      g.moveTo(-m, 0)
      g.lineTo(m, 0)
      g.moveTo(0, -m)
      g.lineTo(0, m)
      g.stroke()
      break
    default:
      g.arc(0, 0, m * 0.75, 0, Math.PI * 2)
      g.stroke()
  }
  return c
}

function shineSprite(px) {
  const c = document.createElement('canvas')
  c.width = c.height = Math.ceil(px)
  const g = c.getContext('2d')
  const r = px / 2
  const grad = g.createRadialGradient(r * 0.62, r * 0.5, 0, r * 0.62, r * 0.5, r * 0.5)
  grad.addColorStop(0, 'rgba(255,255,255,0.85)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, px, px)
  return c
}

// The Punu mask: a white kaolin face, arched brows, almond eyes half closed,
// small red lips, the lozenge scarifications on the forehead, and the high
// crested hairstyle.
function drawMask(g, x, y) {
  g.save()
  g.translate(x, y)
  // Hairstyle: a tall central crest with two side lobes.
  g.fillStyle = '#24170f'
  g.beginPath()
  g.ellipse(0, -30, 16, 20, 0, 0, Math.PI * 2)
  g.ellipse(-19, -19, 11, 13, -0.4, 0, Math.PI * 2)
  g.ellipse(19, -19, 11, 13, 0.4, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(255,255,255,0.12)'
  g.lineWidth = 1
  for (let i = -2; i <= 2; i++) {
    g.beginPath()
    g.moveTo(i * 5, -46)
    g.quadraticCurveTo(i * 6.5, -32, i * 5.5, -16)
    g.stroke()
  }
  // Face.
  const face = g.createRadialGradient(-6, -6, 4, 0, 2, 30)
  face.addColorStop(0, '#fffaf0')
  face.addColorStop(0.7, '#efe6d3')
  face.addColorStop(1, '#c9bc9f')
  g.fillStyle = face
  g.beginPath()
  g.ellipse(0, 3, 21, 27, 0, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = 'rgba(90,70,40,0.35)'
  g.lineWidth = 1
  g.stroke()
  // Forehead scarifications: nine small lozenges.
  g.fillStyle = '#a63a26'
  for (const [dx, dy] of [[0, -18], [-3.5, -15], [3.5, -15], [-7, -12], [0, -12], [7, -12], [-3.5, -9], [3.5, -9], [0, -6]]) {
    g.beginPath()
    g.moveTo(dx, dy - 1.6)
    g.lineTo(dx + 1.3, dy)
    g.lineTo(dx, dy + 1.6)
    g.lineTo(dx - 1.3, dy)
    g.closePath()
    g.fill()
  }
  // Brows, high and arched.
  g.strokeStyle = '#1d140c'
  g.lineWidth = 1.6
  g.lineCap = 'round'
  for (const side of [-1, 1]) {
    g.beginPath()
    g.moveTo(side * 3, -3)
    g.quadraticCurveTo(side * 9, -9, side * 16, -2)
    g.stroke()
  }
  // Eyes: almond slits under swollen lids.
  for (const side of [-1, 1]) {
    g.fillStyle = 'rgba(160,140,110,0.35)'
    g.beginPath()
    g.ellipse(side * 9, 3, 6, 3.4, 0, Math.PI, 0)
    g.fill()
    g.strokeStyle = '#1d140c'
    g.lineWidth = 1.4
    g.beginPath()
    g.moveTo(side * 4, 3.5)
    g.quadraticCurveTo(side * 9, 6, side * 14, 3)
    g.stroke()
  }
  // Nose.
  g.strokeStyle = 'rgba(110,90,60,0.55)'
  g.lineWidth = 1.2
  g.beginPath()
  g.moveTo(0, 2)
  g.quadraticCurveTo(-2.5, 11, 0, 13)
  g.stroke()
  // Lips.
  g.fillStyle = '#b3352a'
  g.beginPath()
  g.ellipse(0, 20, 5.2, 2.6, 0, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#6e1a12'
  g.lineWidth = 0.8
  g.beginPath()
  g.moveTo(-5, 20)
  g.lineTo(5, 20)
  g.stroke()
  g.restore()
}

export function createPerlesRenderer(canvas) {
  const ctx = canvas.getContext('2d')
  let cssW = 1
  let cssH = 1
  let dpr = 1
  let s = 1 // css px per world unit
  let offX = 0
  let offY = 0
  let backdrop = null // { level, canvas }
  let sprites = null
  const particles = []
  const popups = []
  const born = new Map() // bead id → time it joined the river (a little pop)
  let lastTime = 0

  function resize(w, h) {
    cssW = Math.max(1, w)
    cssH = Math.max(1, h)
    dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    s = Math.min(cssW / W, cssH / H)
    offX = (cssW - W * s) / 2
    offY = (cssH - H * s) / 2
    backdrop = null
    sprites = null
  }

  const toWorld = (px, py) => ({ x: (px - offX) / s, y: (py - offY) / s })
  const scale = () => s

  function ensureSprites() {
    if (sprites) return sprites
    const px = BALL * s * dpr
    sprites = { shine: shineSprite(px) }
    for (const c of COLORS) sprites[c] = beadSprite(c, px)
    return sprites
  }

  function ensureBackdrop(level) {
    if (backdrop?.level === level) return backdrop.canvas
    const c = document.createElement('canvas')
    c.width = canvas.width
    c.height = canvas.height
    const g = c.getContext('2d')
    g.setTransform(s * dpr, 0, 0, s * dpr, offX * dpr, offY * dpr)
    drawBackdrop(g, level)
    backdrop = { level, canvas: c }
    return c
  }

  function drawBead(g, x, y, color, rot = 0, size = 1) {
    const sp = ensureSprites()
    const r = R * size
    g.save()
    g.translate(x, y)
    g.rotate(rot)
    g.drawImage(sp[COLORS[color]], -r, -r, r * 2, r * 2)
    g.restore()
    g.drawImage(sp.shine, x - r, y - r, r * 2, r * 2)
  }

  const SPECIAL_MARKS = { ralenti: '🐢', recul: '⏪', bombe: '💥' }

  function handleEvents(state) {
    const now = performance.now()
    for (const e of state.events) {
      if (e.type === 'insert') born.set(e.id, now)
      else if (e.type === 'burst') {
        let sx = 0
        let sy = 0
        for (const b of e.beads) {
          const x = b.x / FP
          const y = b.y / FP
          sx += x
          sy += y
          const col = BEAD_COLORS[COLORS[b.c]][1]
          for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2 + Math.random()
            const v = 40 + Math.random() * 70
            particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.55, max: 0.55, col, r: 2 + Math.random() * 2.5 })
          }
        }
        const n = e.beads.length || 1
        popups.push({ x: sx / n, y: sy / n, text: `+${e.points}`, sub: e.combo > 1 ? `COMBO ×${e.combo}` : null, life: 1.1, max: 1.1 })
        for (const sp of e.specials) popups.push({ x: sx / n, y: sy / n - 22, text: `${SPECIAL_MARKS[sp]} ${sp === 'ralenti' ? 'Ralenti !' : sp === 'recul' ? 'Recul !' : 'Boum !'}`, life: 1.3, max: 1.3 })
      } else if (e.type === 'coin') {
        popups.push({ x: e.x / FP, y: e.y / FP, text: `+${e.points}`, sub: 'Pièce Ngori', life: 1.2, max: 1.2, gold: true })
      } else if (e.type === 'streak') {
        popups.push({ x: SHOOTER.x, y: SHOOTER.y - 70, text: `Série ×${e.streak}`, sub: `+${e.points}`, life: 1.1, max: 1.1, gold: true })
      }
    }
  }

  // aim: { x, y } in world units, hit: aimHit() result, or null.
  function render(state, time, aim, hit) {
    const dt = lastTime ? Math.min(0.05, time - lastTime) : 0
    lastTime = time
    const g = ctx
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.drawImage(ensureBackdrop(state.level), 0, 0)
    g.setTransform(s * dpr, 0, 0, s * dpr, offX * dpr, offY * dpr)

    const path = pathOf(state.level)
    const now = performance.now()

    // The falls: a whirl turning over the dark pool, redder when the beads come close.
    const end = { x: path.xs[path.length] / FP, y: path.ys[path.length] / FP }
    const danger = progressOf(state)
    g.save()
    g.translate(end.x, end.y)
    g.rotate(time * 2.4)
    g.strokeStyle = danger > 0.8 ? `rgba(255,90,70,${0.5 + 0.4 * Math.sin(time * 10)})` : 'rgba(170,220,255,0.55)'
    g.lineWidth = 1.6
    for (let i = 0; i < 3; i++) {
      g.beginPath()
      g.arc(0, 0, 6 + i * 5, i * 2, i * 2 + 3.6)
      g.stroke()
    }
    g.restore()

    // The river's beads.
    for (const b of state.chain) {
      if (b.pos < FP) continue
      const p = pointAt(path, b.pos)
      const x = p.x / FP
      const y = p.y / FP
      const t0 = born.get(b.id)
      const age = t0 ? (now - t0) / 1000 : 1
      const size = age < 0.18 ? 0.7 + (age / 0.18) * 0.3 : 1
      drawBead(g, x, y, b.c, b.pos / FP / R, size)
      if (b.sp) {
        g.strokeStyle = `rgba(255,215,90,${0.65 + 0.3 * Math.sin(time * 6 + b.id)})`
        g.lineWidth = 2
        g.beginPath()
        g.arc(x, y, R + 1.5, 0, Math.PI * 2)
        g.stroke()
        g.font = '10px system-ui, sans-serif'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(SPECIAL_MARKS[b.sp], x, y + 0.5)
      }
    }
    if (born.size > 200) for (const [id, t] of born) if (now - t > 1000) born.delete(id)

    // The Ngori coin to catch.
    if (state.coin) {
      const x = state.coin.x / FP
      const y = state.coin.y / FP
      const bob = Math.sin(time * 4) * 2
      g.fillStyle = 'rgba(255,215,90,0.25)'
      g.beginPath()
      g.arc(x, y + bob, 18 + Math.sin(time * 6) * 2, 0, Math.PI * 2)
      g.fill()
      const coin = g.createRadialGradient(x - 4, y + bob - 4, 1, x, y + bob, 13)
      coin.addColorStop(0, '#fff3b0')
      coin.addColorStop(0.6, '#f5b70d')
      coin.addColorStop(1, '#9a6400')
      g.fillStyle = coin
      g.beginPath()
      g.arc(x, y + bob, 12, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#7a4a00'
      g.font = 'bold 13px system-ui, sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('N', x, y + bob + 1)
      // Time left.
      g.strokeStyle = 'rgba(255,255,255,0.7)'
      g.lineWidth = 1.5
      g.beginPath()
      g.arc(x, y + bob, 16, -Math.PI / 2, -Math.PI / 2 + (state.coin.ttl / 420) * Math.PI * 2)
      g.stroke()
    }

    // Aiming guide: dotted line to where the bead would land.
    const angle = aim ? Math.atan2(aim.y - SHOOTER.y, aim.x - SHOOTER.x) : -Math.PI / 2
    const playing = state.phase === 'play' || state.phase === 'rush'
    if (aim && hit && playing) {
      const hx = hit.x / FP
      const hy = hit.y / FP
      g.strokeStyle = 'rgba(255,255,255,0.55)'
      g.lineWidth = 1.5
      g.setLineDash([3, 6])
      g.beginPath()
      g.moveTo(SHOOTER.x + Math.cos(angle) * 44, SHOOTER.y + Math.sin(angle) * 44)
      g.lineTo(hx, hy)
      g.stroke()
      g.setLineDash([])
      if (hit.index >= 0) {
        g.globalAlpha = 0.45
        drawBead(g, hx, hy, state.current)
        g.globalAlpha = 1
      }
    }

    // Beads in the air.
    for (const shot of state.shots) drawBead(g, shot.x / FP, shot.y / FP, shot.c, time * 12)

    // The mask, its ring of cowries, the bead in hand on the ring (pointing
    // where it will go) and the next one under the chin.
    g.strokeStyle = 'rgba(255,245,220,0.35)'
    g.lineWidth = 2
    g.beginPath()
    g.arc(SHOOTER.x, SHOOTER.y, 44, 0, Math.PI * 2)
    g.stroke()
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + time * 0.3
      g.fillStyle = 'rgba(250,240,215,0.85)'
      g.beginPath()
      g.ellipse(SHOOTER.x + Math.cos(a) * 44, SHOOTER.y + Math.sin(a) * 44, 3.2, 2.1, a, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = 'rgba(120,95,60,0.7)'
      g.lineWidth = 0.7
      g.beginPath()
      g.moveTo(SHOOTER.x + Math.cos(a) * 41.8, SHOOTER.y + Math.sin(a) * 41.8)
      g.lineTo(SHOOTER.x + Math.cos(a) * 46.2, SHOOTER.y + Math.sin(a) * 46.2)
      g.stroke()
    }
    drawMask(g, SHOOTER.x, SHOOTER.y)
    if (playing || state.phase === 'clear') {
      const ready = state.cooldown === 0
      drawBead(g, SHOOTER.x + Math.cos(angle) * 44, SHOOTER.y + Math.sin(angle) * 44, state.current, 0, ready ? 1.05 : 0.85)
      drawBead(g, SHOOTER.x, SHOOTER.y + 40, state.next, 0, 0.55)
    }

    // Slowed or pushed back: a hint on the river.
    if (state.slow > 0 || state.reverse > 0) {
      g.fillStyle = state.reverse > 0 ? 'rgba(120,200,255,0.10)' : 'rgba(160,255,190,0.08)'
      g.fillRect(0, 0, W, H)
    }

    // Particles and popups.
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.life -= dt
      if (p.life <= 0) {
        particles.splice(i, 1)
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 0.92
      p.vy *= 0.92
      g.globalAlpha = p.life / p.max
      g.fillStyle = p.col
      g.beginPath()
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      g.fill()
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
      const k = 1 - p.life / p.max
      g.globalAlpha = Math.min(1, p.life * 2.5)
      g.font = 'bold 15px system-ui, sans-serif'
      g.lineWidth = 3
      g.strokeStyle = 'rgba(0,0,0,0.6)'
      g.fillStyle = p.gold ? '#ffd65a' : '#ffffff'
      const y = p.y - k * 26
      g.strokeText(p.text, p.x, y)
      g.fillText(p.text, p.x, y)
      if (p.sub) {
        g.font = 'bold 11px system-ui, sans-serif'
        g.fillStyle = '#ffd65a'
        g.strokeText(p.sub, p.x, y + 15)
        g.fillText(p.sub, p.x, y + 15)
      }
    }
    g.globalAlpha = 1
  }

  return { resize, render, toWorld, scale, handleEvents }
}

// The mask alone, for the lobby.
export function drawMaskPreview(canvas) {
  const g = canvas.getContext('2d')
  const k = canvas.width / 120
  g.setTransform(k, 0, 0, k, 0, 0)
  g.clearRect(0, 0, 120, 120)
  drawMask(g, 60, 66)
}
