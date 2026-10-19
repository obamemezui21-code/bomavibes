// A storm over the games: drawn on a transparent canvas laid over the game
// (so it works with the 2D and the 3D renderer alike) — darker sky, slanted
// rain, lightning bolts with a white flash. Purely visual: nothing here
// touches the simulation.

// How stormy it is (0–1) at `metres` into a run: a storm every STORM_EVERY m,
// starting at STORM_FIRST m, lasting STORM_LENGTH m, rolling in and out.
const STORM_FIRST = 700
const STORM_EVERY = 2200
const STORM_LENGTH = 650
const STORM_RAMP = 120
export function stormLevel(metres) {
  if (metres < STORM_FIRST) return 0
  const into = (metres - STORM_FIRST) % STORM_EVERY
  if (into > STORM_LENGTH) return 0
  return Math.min(1, into / STORM_RAMP, (STORM_LENGTH - into) / STORM_RAMP)
}

export function createStormOverlay(canvas) {
  const ctx = canvas.getContext('2d')
  let W = 1
  let H = 1
  const drops = []
  let flash = 0
  let bolt = null // { points, branches, life }

  function resize(width, height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    W = Math.max(1, width)
    H = Math.max(1, height)
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function jagged(x0, y0, x1, y1, roughness) {
    const pts = [[x0, y0]]
    const n = 12
    for (let i = 1; i < n; i++) {
      const t = i / n
      pts.push([x0 + (x1 - x0) * t + (Math.random() - 0.5) * roughness, y0 + (y1 - y0) * t])
    }
    pts.push([x1, y1])
    return pts
  }

  // A lightning strike: a bolt from the top of the screen down towards the
  // horizon, with a couple of branches, and a flash.
  function strike() {
    const x = W * (0.15 + Math.random() * 0.7)
    const end = H * (0.28 + Math.random() * 0.22)
    const points = jagged(x, -10, x + (Math.random() - 0.5) * W * 0.2, end, W * 0.06)
    const branches = []
    for (let b = 0; b < 2; b++) {
      const [bx, by] = points[3 + Math.floor(Math.random() * 6)]
      branches.push(jagged(bx, by, bx + (Math.random() - 0.5) * W * 0.25, by + H * 0.12, W * 0.04))
    }
    bolt = { points, branches, life: 1 }
    flash = 1
  }

  function line(points, width, color) {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.stroke()
  }

  function render(level, dt) {
    ctx.clearRect(0, 0, W, H)
    if (level <= 0 && flash <= 0 && !bolt) {
      drops.length = 0
      return
    }
    // Storm light: dark blue-grey, heavier at the top.
    const dark = ctx.createLinearGradient(0, 0, 0, H)
    dark.addColorStop(0, `rgba(12,16,32,${0.62 * level})`)
    dark.addColorStop(0.45, `rgba(20,26,44,${0.4 * level})`)
    dark.addColorStop(1, `rgba(10,14,24,${0.3 * level})`)
    ctx.fillStyle = dark
    ctx.fillRect(0, 0, W, H)

    // Rain: slanted streaks falling fast.
    const want = Math.floor(260 * level)
    while (drops.length < want) drops.push({ x: Math.random() * W * 1.2, y: Math.random() * H, v: 0.8 + Math.random() * 0.6, l: 12 + Math.random() * 18 })
    drops.length = Math.min(drops.length, want)
    ctx.strokeStyle = 'rgba(200,215,240,0.45)'
    ctx.lineWidth = 1.3
    ctx.beginPath()
    for (const d of drops) {
      d.y += d.v * H * 1.6 * dt
      d.x -= d.v * H * 0.35 * dt
      if (d.y > H) {
        d.y = -d.l
        d.x = Math.random() * W * 1.2
      }
      ctx.moveTo(d.x, d.y)
      ctx.lineTo(d.x + d.l * 0.22, d.y - d.l)
    }
    ctx.stroke()

    if (bolt) {
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalAlpha = Math.max(0, bolt.life)
      line(bolt.points, 14, 'rgba(160,190,255,0.35)')
      line(bolt.points, 4, '#ffffff')
      for (const br of bolt.branches) {
        line(br, 6, 'rgba(160,190,255,0.3)')
        line(br, 2, '#f1f5ff')
      }
      ctx.globalAlpha = 1
      bolt.life -= dt * 4
      if (bolt.life <= 0) bolt = null
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(235,240,255,${flash * 0.7})`
      ctx.fillRect(0, 0, W, H)
      flash = Math.max(0, flash - dt * 3.5)
    }
  }

  return { resize, render, strike }
}
