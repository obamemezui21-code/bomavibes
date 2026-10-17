// COMMANDO OKOUMÉ renderer: 16-bit style pixel art, all drawn in code on a
// 320×180 buffer that is scaled up with no smoothing. Purely visual — the
// game itself lives in shared/commando-okoume/engine.mjs.
import { FP, GROUND_Y, MISSIONS, SCREEN_H, SCREEN_W, WEAPONS } from '../../../../shared/commando-okoume/engine.mjs'
import { LOOKS, drawFigure, drawLying, drawPuff } from './sprites.js'

const THEMES = {
  port: {
    sky: ['#2b1b4a', '#4a2462', '#7d2f6b', '#b8456a', '#e2725b', '#f6a96b'],
    sun: '#ffd36b',
    ground: '#6d7b7c',
    groundTop: '#bdc3c7',
    gap: '#163250',
  },
  lope: {
    sky: ['#5fb4dd', '#78c3e6', '#93d0ec', '#aedcf1', '#c9e8f6', '#e2f3fa'],
    sun: '#fff3b0',
    ground: '#9c4a1a',
    groundTop: '#6aa121',
    gap: '#2a1608',
  },
  ivindo: {
    sky: ['#16302a', '#1d3d33', '#25493c', '#2e5a47', '#3b6b52', '#4c7a5d'],
    sun: null,
    ground: '#3b2a1a',
    groundTop: '#4f7a28',
    gap: '#1d5a5a',
  },
}

const CONTAINER_COLORS = ['#c0392b', '#2471a3', '#1e8449', '#d68910', '#7d3c98']

// Small deterministic noise for scenery placement.
const hash = (n) => {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

export function createCommandoRenderer(canvas) {
  const buf = document.createElement('canvas')
  buf.width = SCREEN_W
  buf.height = SCREEN_H
  const g = buf.getContext('2d')
  const out = canvas.getContext('2d')
  let particles = []
  let shake = 0
  let view = { x: 0, y: 0, w: SCREEN_W, h: SCREEN_H }

  const r = (x, y, w, h, c) => {
    g.fillStyle = c
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  }

  // ---- Scenery ------------------------------------------------------------
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
      // Libreville's skyline at dusk.
      for (let i = Math.floor(off / 22) - 1; i < Math.floor(off / 22) + 17; i++) {
        const x = i * 22 - off
        const h = 26 + Math.floor(hash(i) * 40)
        r(x, 118 - h, 20, h, '#3a2350')
        for (let wy = 118 - h + 4; wy < 114; wy += 6) {
          for (let wx = 3; wx < 18; wx += 5) if (hash(i * 31 + wy + wx) > 0.55) r(x + wx, wy, 2, 2, '#f7c86b')
        }
      }
      // The sea of the estuary.
      r(0, 118, SCREEN_W, 40, '#1f3f66')
      for (let i = 0; i < 12; i++) r(((i * 37 + time * 8) % 340) - 10, 124 + (i % 4) * 7, 10, 1, '#5d8fbf')
    } else if (theme === 'lope') {
      // Rolling savannah hills, elephants far away.
      for (let x = 0; x < SCREEN_W; x += 2) {
        const wx = x + off
        const h = 26 + Math.sin(wx / 40) * 8 + Math.sin(wx / 17) * 3
        r(x, 130 - h, 2, h + 30, '#7a9a4a')
      }
      for (let i = Math.floor(off / 160) - 1; i < Math.floor(off / 160) + 3; i++) {
        if (hash(i + 3) < 0.5) continue
        const x = i * 160 + 60 - off
        // A grey elephant silhouette.
        r(x, 98, 18, 9, '#6e6e6e')
        r(x + 16, 96, 6, 8, '#6e6e6e')
        r(x + 21, 101, 2, 7, '#6e6e6e')
        r(x + 2, 107, 3, 5, '#6e6e6e')
        r(x + 12, 107, 3, 5, '#6e6e6e')
        r(x + 17, 98, 2, 2, '#f2f2f2')
      }
    } else {
      // Dense canopy of the Ivindo forest.
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
      // Gantry cranes and stacked containers of the Owendo port.
      for (let i = Math.floor(off / 210) - 1; i < Math.floor(off / 210) + 3; i++) {
        const x = i * 210 + 40 - off
        r(x, 40, 4, 116, '#c0392b')
        r(x + 40, 40, 4, 116, '#c0392b')
        r(x - 30, 40, 110, 5, '#d35400')
        r(x + 10, 45, 1, 30, '#2c2c2c')
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
      // Acacia-like trees and tall grass.
      for (let i = Math.floor(off / 120) - 1; i < Math.floor(off / 120) + 4; i++) {
        const x = i * 120 + hash(i) * 50 - off
        r(x + 10, 96, 4, 60, '#5b3a1e')
        r(x - 8, 88, 42, 8, '#3d5a1e')
        r(x - 2, 82, 30, 6, '#4a6b22')
      }
      for (let i = 0; i < 40; i++) {
        const x = ((i * 23 - off * 1.2) % 340 + 340) % 340 - 10
        r(x, 146, 1, 10, '#8fae3a')
        r(x + 2, 149, 1, 7, '#a4c24a')
      }
    } else {
      // The Kongou falls: white water pouring down, animated.
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

  function drawFloors(state, cam, time) {
    const mission = MISSIONS[state.mission]
    const theme = THEMES[mission.theme]
    // Water / pit under the gaps first.
    r(0, GROUND_Y, SCREEN_W, SCREEN_H - GROUND_Y, theme.gap)
    if (mission.theme !== 'lope') {
      for (let i = 0; i < 16; i++) r(((i * 29 + time * 20) % 340) - 10, GROUND_Y + 6 + (i % 3) * 6, 8, 1, '#ffffff44')
    }
    mission.floors.forEach(([x0, x1, y], i) => {
      const sx = x0 - cam
      const w = x1 - x0
      if (sx > SCREEN_W || sx + w < 0) return
      if (y === GROUND_Y) {
        r(sx, y, w, SCREEN_H - y, theme.ground)
        r(sx, y, w, 3, theme.groundTop)
        if (mission.theme === 'port') {
          for (let bx = Math.max(0, Math.ceil((cam - x0) / 16) * 16); bx < w; bx += 16) r(sx + bx, y + 8, 1, 16, '#5a6667')
        } else {
          for (let bx = 4; bx < w; bx += 11) r(sx + bx, y + 7 + (bx % 3) * 5, 2, 2, '#00000033')
        }
        return
      }
      if (mission.theme === 'port') {
        // A shipping container.
        const col = CONTAINER_COLORS[i % CONTAINER_COLORS.length]
        r(sx, y, w, 12, col)
        for (let bx = 3; bx < w; bx += 5) r(sx + bx, y + 1, 1, 10, '#00000033')
        r(sx, y, w, 1, '#ffffff55')
      } else if (mission.theme === 'lope') {
        // A rock ledge.
        r(sx, y, w, 8, '#8d7b68')
        r(sx + 2, y + 8, w - 4, 3, '#6d5d4c')
        r(sx, y, w, 2, '#a99784')
      } else {
        // An okoumé log.
        r(sx, y, w, 9, '#8b5a2b')
        r(sx, y, w, 2, '#a47148')
        r(sx, y + 1, 4, 7, '#d9a066')
        r(sx + w - 4, y + 1, 4, 7, '#d9a066')
        r(sx + 1, y + 3, 2, 3, '#8b5a2b')
      }
    })
  }

  // ---- Characters (sprites.js) --------------------------------------------
  let corpses = [] // poachers just put out of action: lying, then a puff of smoke

  function drawEnemy(e, cam, time) {
    const x = e.x / FP - cam
    const y = e.y / FP
    const flash = e.flash > 0
    if (e.type === 'jeep') {
      const c = flash ? '#ffffff' : '#4b5320'
      r(x - 17, y - 14, 34, 9, c)
      r(x - 10, y - 20, 12, 6, flash ? '#ffffff' : '#3b421a')
      r(x - 8, y - 19, 8, 4, '#9fc5e8')
      r(x - 22, y - 12, 8, 2, '#2b2b2b') // gun
      r(x + 4, y - 26, 5, 6, '#4a2f1d') // gunner
      r(x + 3, y - 27, 7, 2, '#b03a2e')
      for (const wx of [-11, 9]) {
        g.fillStyle = '#1a1a1a'
        g.beginPath()
        g.arc(x + wx, y - 4, 4, 0, Math.PI * 2)
        g.fill()
      }
      return
    }
    if (e.type === 'drone') {
      const c = flash ? '#ffffff' : '#555b61'
      r(x - 6, y - 3, 12, 5, c)
      const blade = Math.floor(time * 30) % 2 ? 6 : 3
      r(x - 9 - blade / 2, y - 5, blade, 1, '#cccccc')
      r(x + 9 - blade / 2, y - 5, blade, 1, '#cccccc')
      r(x - 1, y + 2, 2, 2, Math.floor(time * 4) % 2 ? '#ff3b30' : '#7a1c17')
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
      r(x - 7, y - 6, 14, 11, '#6b7d2f')
      r(x - 7, y - 6, 14, 2, '#8a9d43')
      g.fillStyle = '#ffe066'
      g.font = 'bold 8px monospace'
      g.textAlign = 'center'
      g.fillText(it.kind, x, y + 3)
    } else if (it.kind === 'M') {
      r(x - 6, y - 5, 12, 10, '#f5f5f5')
      r(x - 1, y - 3, 2, 6, '#e74c3c')
      r(x - 3, y - 1, 6, 2, '#e74c3c')
    } else if (it.kind === 'H') {
      // A hostage tied up, waving for help.
      r(x - 4, y - 2, 8, 8, '#ecf0f1')
      r(x - 3, y - 8, 6, 6, '#5a3825')
      r(x - 5, y + 1, 10, 1, '#c8a165')
      const wave = Math.floor(time * 4) % 2
      r(x + 4, y - 6 - wave * 2, 2, 5, '#5a3825')
      r(x - 2, y - 15, 4, 5, '#ffffff')
      r(x - 1, y - 14, 2, 2, '#e74c3c')
      r(x - 1, y - 11, 2, 1, '#e74c3c')
    } else if (it.kind === 'I') {
      // A seized ivory tusk.
      g.strokeStyle = '#fdfaf0'
      g.lineWidth = 3
      g.beginPath()
      g.arc(x, y + 4, 8, Math.PI * 1.1, Math.PI * 1.9)
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
      r(0, y - 12, SCREEN_W, 4, '#7f8c8d') // rail
      r(x + 20, y - 8, 16, 8, '#2c3e50')
      r(x, y, b.w, b.h, c('#f1c40f'))
      r(x + 4, y + 6, b.w - 8, 18, '#2c3e50')
      r(x + 6, y + 8, 14, 12, '#85c1e9')
      r(x + 30, y + 8, 18, 12, '#85c1e9')
      r(x + 8, y + 30, 40, 4, c('#d4ac0d'))
      r(x - 12, y + 44, 16, 4, '#2b2b2b') // gun
      r(x + 24, y + b.h, 2, 14, '#2b2b2b')
      r(x + 20, y + b.h + 14, 10, 4, '#7f8c8d') // hook
    } else if (b.type === 'gorille') {
      r(x + 6, y + 6, 32, 30, c('#34495e'))
      r(x + 12, y, 20, 14, c('#2c3e50'))
      r(x + 15, y + 5, 4, 3, '#ff3b30')
      r(x + 25, y + 5, 4, 3, '#ff3b30')
      r(x, y + 10, 8, 30, c('#2c3e50')) // arms
      r(x + 36, y + 10, 8, 30, c('#2c3e50'))
      r(x + 10, y + 36, 9, 16, c('#22313f'))
      r(x + 25, y + 36, 9, 16, c('#22313f'))
      r(x + 14, y + 18, 16, 6, '#95a5a6') // armour plate
    } else {
      // The illegal gold dredge.
      r(x, y + 24, b.w, 24, c('#6e2c00'))
      r(x, y + 24, b.w, 3, c('#a04000'))
      r(x + 40, y + 4, 26, 20, c('#7f8c8d'))
      r(x + 44, y + 8, 8, 6, '#85c1e9')
      r(x + 56, y - 8, 5, 12, '#2c2c2c') // smokestack
      for (let s = 0; s < 3; s++) {
        const sy = (time * 20 + s * 8) % 24
        r(x + 55 + s, y - 10 - sy, 4, 3, '#95a5a688')
      }
      r(x + 4, y + 2, 30, 4, c('#d68910')) // excavator arm
      r(x - 4, y + 2, 10, 10, c('#b9770e'))
      r(x - 10, y + 30, 12, 3, '#2b2b2b') // gun
    }
    // Where the next crate will fall.
    const a = b.action
    if (a?.kind === 'drop' && a.t < 40 && Math.floor(time * 10) % 2) {
      const sx = a.x / FP - cam
      r(sx - 8, GROUND_Y - 2, 16, 2, '#ff3b30')
      r(sx - 1, GROUND_Y - 8, 2, 5, '#ff3b30')
    }
  }

  function drawShots(state, cam) {
    for (const s of state.bullets) {
      const x = s.x / FP - cam
      const y = s.y / FP
      if (s.grenade) r(x - 2, y - 2, 4, 4, '#2d4a1e')
      else r(x - 2, y - 1, 4, 2, s.pierce ? '#7df9ff' : '#ffe066')
    }
    for (const s of state.enemyShots) {
      const x = s.x / FP - cam
      const y = s.y / FP
      if (s.kind === 'crate') {
        r(x - 8, y - 8, 16, 16, '#8e5b2a')
        r(x - 8, y - 1, 16, 2, '#5d3a1a')
        r(x - 1, y - 8, 2, 16, '#5d3a1a')
      } else if (s.kind === 'bomb') {
        r(x - 2, y - 2, 4, 5, '#1a1a1a')
      } else if (s.kind === 'wave') {
        r(x - 8, y - 2, 16, 6, '#e8d8b066')
        r(x - 5, y - 5, 10, 3, '#e8d8b0aa')
      } else {
        r(x - 2, y - 2, 4, 4, '#ff5e3a')
        r(x - 1, y - 1, 2, 2, '#ffd0a0')
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
    if (rolling) {
      g.fillStyle = '#15140f'
      g.beginPath()
      g.arc(x, y - 8, 9, 0, Math.PI * 2)
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
      muzzle: p.weapon !== 'grenade' && p.fireCooldown >= rate - 2,
    })
    // Elite shots: a cyan glow around Moussavou.
    if (state.character === 'moussavou' && p.special > 0) {
      g.strokeStyle = '#7df9ff'
      g.lineWidth = 1
      g.strokeRect(Math.round(x - 10), Math.round(y - 30), 20, 30)
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
      pt.vy += 120 * dt
      const a = Math.max(0, pt.life / pt.max)
      g.globalAlpha = a
      r(pt.x - cam, pt.y, pt.size, pt.size, pt.color)
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
          else burst(e.x / FP, e.y / FP - 10, '#f39c12', 14, 90)
        }
        else if (e.type === 'explosion') {
          burst(e.x / FP, e.y / FP, '#e67e22', 18, 110, 3)
          burst(e.x / FP, e.y / FP, '#f1c40f', 10, 70)
          shake = Math.max(shake, 0.2)
        } else if (e.type === 'hurt') shake = Math.max(shake, 0.3)
        else if (e.type === 'item') burst(p.x / FP, p.y / FP - 14, '#2ecc71', 12, 60)
        else if (e.type === 'bossDown' && state.boss) {
          const b = state.boss
          for (let i = 0; i < 4; i++) burst(b.x / FP + Math.random() * b.w, b.y / FP + Math.random() * b.h, '#e74c3c', 20, 140, 3)
          shake = 0.8
        }
      }
    },
    render(state, time, dt) {
      const mission = MISSIONS[state.mission]
      let cam = state.camX / FP
      if (shake > 0) {
        shake = Math.max(0, shake - dt)
        cam += (Math.random() - 0.5) * 6 * shake * 4
      }
      drawSky(mission.theme)
      drawFar(mission.theme, cam, time)
      drawMid(mission.theme, cam, time)
      drawFloors(state, cam, time)
      for (const it of state.items) drawItem(it, cam, time)
      drawBoss(state, cam, time)
      for (const e of state.enemies) drawEnemy(e, cam, time)
      drawCorpses(cam, dt)
      drawPlayer(state, cam, time)
      drawShots(state, cam)
      drawParticles(cam, dt)

      out.imageSmoothingEnabled = false
      out.fillStyle = '#000000'
      out.fillRect(0, 0, canvas.width, canvas.height)
      out.drawImage(buf, view.x, view.y, view.w, view.h)
    },
  }
}
