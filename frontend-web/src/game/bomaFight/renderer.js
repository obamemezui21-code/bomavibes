// BOMA FIGHT's 2D canvas renderer: the stage photo, the floor, and the two
// fighters — each one the very warrior of the roster picture, cut out
// (assets/game/fight/sprites/), animated like a puppet: breathing, lunging
// into a blow with a swoosh trail, recoiling, falling. Purely visual — the
// fight itself is shared/boma-fight/engine.mjs.
import { ARENA, MOVES, FIGHTERS } from '../../../../shared/boma-fight/engine.mjs'
import { SPRITES } from './portraits.js'

// Per fighter: where their body's centre sits in the cut-out (cx, share of
// its width), which side their weapon sticks out on in the picture (-1 left,
// 1 right, 0 none: the sprite is mirrored so it points at the opponent), the
// colour of their blows' trail and of their special's aura; face: how far
// down the cut-out their face is (share of its height), for the HUD.
export const LOOKS = {
  nzeang: { cx: 0.645, face: 0.12, weaponSide: -1, trail: '#c89b62', aura: '#ff7a3d' },
  bikoulou: { cx: 0.532, face: 0.1, weaponSide: 0, trail: '#ffffff', aura: '#3ddc84' },
  ondo: { cx: 0.532, face: 0.27, weaponSide: -1, trail: '#dfe6ea', aura: '#5aa0ff' },
  amissa: { cx: 0.575, face: 0.1, weaponSide: 0, trail: '#ffffff', aura: '#ffb03d' },
  mebale: { cx: 0.511, face: 0.08, weaponSide: 1, trail: '#e1d0aa', aura: '#d9a35b' },
  luku: { cx: 0.583, face: 0.12, weaponSide: -1, trail: '#e3e9ed', aura: '#ff4d4d' },
  kassa: { cx: 0.524, face: 0.08, weaponSide: 1, trail: '#e3e9ed', aura: '#2ee6a6' },
  nzame: { cx: 0.48, face: 0.08, weaponSide: 0, trail: '#ffe27a', aura: '#ffd34d' },
  obame: { cx: 0.465, face: 0.07, weaponSide: 0, trail: '#ffe7a3', aura: '#ffcf3d' },
  sally: { cx: 0.525, face: 0.07, weaponSide: 0, trail: '#ffffff', aura: '#ff5fa2' },
  biyogo: { cx: 0.577, face: 0.08, weaponSide: 0, trail: '#ffffff', aura: '#7c5cff' },
  essono: { cx: 0.437, face: 0.07, weaponSide: 0, trail: '#c9a46a', aura: '#c0c7cf' },
}
// The cut-outs' common scale: a fighter of this many pixels is "standard" height.
const STANDARD_H = 380

const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (t) => Math.max(0, Math.min(1, t))
const ease = (t) => 1 - (1 - t) * (1 - t)

// How far an attack is: < 0 winding up, 1 fully out, back to 0 on recovery.
function attackProgress(f) {
  const m = MOVES[f.move]
  const startup = Math.max(2, m.startup - FIGHTERS[f.id].quick)
  const t = f.t
  if (t < startup) return { out: -0.6 * ease(t / startup), active: false }
  if (t < startup + m.active) return { out: 1, active: true }
  return { out: 1 - ease(clamp01((t - startup - m.active) / m.recovery)), active: false }
}

// The puppet's pose: lean (rad, + toward the opponent), shift (share of the
// fighter's height, + toward the opponent), lift (share of height, up),
// sx / sy (squash), fall (0 standing → 1 lying), plus what to draw around.
export function poseOf(f, time) {
  const base = { lean: 0, shift: 0, lift: 0, sx: 1, sy: 1, fall: 0 }
  switch (f.state) {
    case 'walk': {
      const s = Math.sin(f.t * 0.28)
      return { ...base, lift: Math.abs(s) * 0.025, lean: 0.04 * Math.sign(f.walkDir * f.facing) }
    }
    case 'attack': {
      const { out, active } = attackProgress(f)
      const k = Math.max(0, out)
      const wind = Math.min(0, out)
      if (f.move === 'punch') return { ...base, lean: 0.13 * k - 0.1 * wind, shift: 0.12 * k + 0.04 * wind, sx: 1 + 0.04 * k, swoosh: active ? 'punch' : null }
      if (f.move === 'kick') return { ...base, lean: -0.1 * k - 0.06 * wind, shift: 0.16 * k, lift: 0.04 * k, sy: 1 - 0.03 * k, swoosh: active ? 'kick' : null }
      return { ...base, lean: 0.2 * k - 0.15 * wind, shift: 0.3 * k + 0.06 * wind, sx: 1 + 0.06 * k, aura: true, trail: k > 0.2, swoosh: active ? 'special' : null }
    }
    case 'block':
      return { ...base, lean: -0.07, shift: -0.02, sx: 0.96, sy: 0.98, guard: true }
    case 'hit': {
      const k = 1 - clamp01(f.t / Math.max(1, f.stun))
      return { ...base, lean: -0.22 * k, shift: -0.05 * k, sx: 1 - 0.04 * k }
    }
    case 'down': {
      // Knocked flat, then back up at the end.
      const fallT = clamp01(f.t / 10)
      const rise = clamp01((f.t - 43) / 12)
      return { ...base, fall: ease(fallT) * (1 - rise) }
    }
    case 'ko':
      return { ...base, fall: ease(clamp01(f.t / 14)) }
    case 'win':
      return { ...base, lift: Math.abs(Math.sin(f.t * 0.12)) * 0.05, sy: 1 + Math.abs(Math.sin(f.t * 0.12)) * 0.02 }
    default:
      return { ...base, sy: 1 + Math.sin(time * 3.2 + f.id.length) * 0.012, lean: Math.sin(time * 1.6 + f.id.length) * 0.012 }
  }
}

export function createFightRenderer(canvas, { stage }) {
  const ctx = canvas.getContext('2d')
  let W = 0
  let H = 0
  let dpr = 1
  let inset = 0 // room kept under the floor for the on-screen controls
  const bg = new Image()
  bg.src = stage
  const images = {}
  for (const [id, src] of Object.entries(SPRITES)) {
    images[id] = new Image()
    images[id].src = src
  }
  const sparks = [] // { x, y, vx, vy, life, color }
  const popups = [] // { text, x, y, life, color, size }
  const flashes = [0, 0]
  const ghosts = [[], []] // afterimages of a special: { x, life }
  let shake = 0

  // Arena units → screen x: the whole ring fits the width.
  const toX = (x) => (x / ARENA) * W
  const floorY = () => Math.min(H * 0.86, H - inset)
  const standardH = () => Math.min(floorY() * 0.6, W * 0.46)

  // One fighter, body centre at (x, floor).
  function drawFighter(f, x, floor, time, flash, ghostsOf) {
    const look = LOOKS[f.id] || LOOKS.nzame
    const img = images[f.id]
    if (!img?.complete || !img.naturalWidth) return
    const pose = poseOf(f, time)
    const dir = f.facing
    const scale = standardH() / STANDARD_H
    const h = img.naturalHeight * scale
    const w = img.naturalWidth * scale
    // Mirror the picture so the weapon points at the opponent.
    const flip = look.weaponSide ? look.weaponSide !== dir : dir < 0
    const anchor = flip ? 1 - look.cx : look.cx
    const bx = x + dir * pose.shift * standardH()
    const by = floor - pose.lift * standardH()

    const draw = (alpha, ox = 0, glow = null) => {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(bx + ox, by)
      // Falling: the whole body tips over backwards, away from the opponent.
      ctx.rotate(dir * (pose.lean - pose.fall * (Math.PI / 2)))
      ctx.scale((flip ? -1 : 1) * pose.sx, pose.sy)
      if (glow) {
        ctx.shadowColor = glow
        ctx.shadowBlur = 24
      }
      if (flash && 'filter' in ctx) ctx.filter = `brightness(${1 + flash * 1.8})`
      ctx.drawImage(img, -anchor * w, -h + (pose.fall ? h * 0.06 * pose.fall : 0), w, h)
      ctx.restore()
    }

    // Afterimages trailing a special.
    for (const g of ghostsOf) draw(0.22 * g.life, g.x - bx, look.aura)
    if (pose.aura) {
      const gr = ctx.createRadialGradient(bx, by - h * 0.5, h * 0.1, bx, by - h * 0.5, h * 0.75)
      gr.addColorStop(0, `${look.aura}66`)
      gr.addColorStop(1, `${look.aura}00`)
      ctx.fillStyle = gr
      ctx.beginPath()
      ctx.arc(bx, by - h * 0.5, h * 0.75, 0, Math.PI * 2)
      ctx.fill()
    }
    draw(1, 0, pose.aura || f.id === 'nzame' ? look.aura : null)

    // The blow's trail, in front of the body.
    if (pose.swoosh) {
      const sh = standardH()
      const y = by - sh * (pose.swoosh === 'kick' ? 0.32 : pose.swoosh === 'special' ? 0.55 : 0.68)
      const reach = (MOVES[pose.swoosh].range + FIGHTERS[f.id].reach) / ARENA * W
      const cx = bx + dir * reach * 0.45
      const r = reach * (pose.swoosh === 'special' ? 0.7 : 0.5)
      ctx.save()
      ctx.translate(cx, y)
      ctx.scale(dir, 1)
      ctx.lineCap = 'round'
      for (const [width, alpha] of [[sh * 0.07, 0.25], [sh * 0.035, 0.85]]) {
        ctx.strokeStyle = look.trail
        ctx.globalAlpha = alpha
        ctx.lineWidth = width
        ctx.beginPath()
        ctx.arc(0, 0, r, -0.9, 0.9)
        ctx.stroke()
      }
      ctx.restore()
    }
    if (pose.guard) {
      ctx.save()
      ctx.globalAlpha = 0.55
      ctx.strokeStyle = '#8fd3ff'
      ctx.lineWidth = Math.max(3, standardH() * 0.03)
      ctx.beginPath()
      ctx.ellipse(bx + dir * standardH() * 0.2, by - h * 0.55, standardH() * 0.12, h * 0.42, 0, -Math.PI / 2, Math.PI / 2, dir < 0)
      ctx.stroke()
      ctx.restore()
    }
    return { bx, special: pose.trail }
  }

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
      const y = floorY() - standardH() * (e.move === 'kick' ? 0.38 : 0.66)
      const heavy = e.move === 'special'
      const n = heavy ? 30 : e.guarded ? 8 : 14
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const s = (heavy ? 8 : 4.5) * (0.4 + Math.random())
        sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, life: 1, color: e.guarded ? '#9ad7ff' : heavy ? '#ffd34d' : '#fff3c4' })
      }
      popups.push({ text: e.guarded ? 'GARDE' : `-${e.damage}`, x, y: y - 20, life: 1, color: e.guarded ? '#9ad7ff' : '#ffe066', size: heavy ? 36 : 24 })
      if (!e.guarded) flashes[target] = 0.8
      shake = heavy ? 16 : e.guarded ? 2 : 6
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

      const xs = state.fighters.map((f, i) => toX(prev ? lerp(prev[i], f.x, alpha) : f.x))
      // Shadows first, under both.
      for (const [i, f] of state.fighters.entries()) {
        const fall = poseOf(f, time).fall
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
        ctx.beginPath()
        ctx.ellipse(xs[i] - f.facing * fall * standardH() * 0.4, floor + 2, standardH() * (0.2 + fall * 0.3), standardH() * 0.04, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      const order = state.fighters[0].state === 'attack' ? [1, 0] : [0, 1] // the attacker on top
      for (const i of order) {
        const drawn = drawFighter(state.fighters[i], xs[i], floor, time, flashes[i], ghosts[i])
        flashes[i] = Math.max(0, flashes[i] - 0.08)
        for (const gh of ghosts[i]) gh.life -= 0.08
        ghosts[i] = ghosts[i].filter((gh) => gh.life > 0)
        if (drawn?.special && Math.random() < 0.6) ghosts[i].push({ x: drawn.bx, life: 1 })
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
