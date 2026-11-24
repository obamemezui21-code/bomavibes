import { GOLD } from '../../../../shared/chantier-boma/engine.mjs'

// The bricks' look. Every material has its own pattern besides its colour, so
// the plan can be read without telling the colours apart.
export const MATERIAL_COLORS = { T: '#d9763a', B: '#8a5229', P: '#eec24f', R: '#a9b2bd', V: '#2fc0cf', [GOLD]: '#ffd84a' }
export const MATERIAL_NAMES = { T: 'Terre', B: 'Bois', P: 'Paille', R: 'Pierre', V: 'Vitrail', [GOLD]: 'Or' }

const line = (g, pts) => {
  g.beginPath()
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  g.stroke()
}

const PATTERNS = {
  // Earth: two rows of mud bricks.
  T(g) {
    g.strokeStyle = '#8f4218'
    g.lineWidth = 6
    line(g, [[0, 50], [100, 50]])
    line(g, [[50, 0], [50, 50]])
    line(g, [[24, 50], [24, 100]])
    line(g, [[76, 50], [76, 100]])
  },
  // Wood: a board and its grain.
  B(g) {
    g.strokeStyle = '#55300f'
    g.lineWidth = 5
    for (const x of [22, 50, 78]) line(g, [[x, 0], [x + 4, 35], [x - 3, 70], [x, 100]])
    g.beginPath()
    g.ellipse(36, 56, 6, 11, 0, 0, Math.PI * 2)
    g.stroke()
  },
  // Straw: bundles of raffia.
  P(g) {
    g.strokeStyle = '#a87414'
    g.lineWidth = 5
    for (let i = -80; i < 100; i += 26) {
      line(g, [[i, 0], [i + 22, 48]])
      line(g, [[i + 46, 52], [i + 24, 100]])
    }
    g.lineWidth = 6
    line(g, [[0, 50], [100, 50]])
  },
  // Stone: rubble.
  R(g) {
    g.strokeStyle = '#5f6975'
    g.lineWidth = 6
    line(g, [[0, 40], [34, 34], [58, 48], [100, 38]])
    line(g, [[34, 34], [40, 0]])
    line(g, [[58, 48], [52, 76], [0, 80]])
    line(g, [[52, 76], [72, 100]])
    line(g, [[78, 43], [84, 72], [100, 78]])
  },
  // Stained glass: four panes.
  V(g) {
    g.fillStyle = '#f2d24a'
    g.fillRect(8, 8, 40, 40)
    g.fillStyle = '#e2568a'
    g.fillRect(52, 52, 40, 40)
    g.strokeStyle = '#0c3b46'
    g.lineWidth = 7
    line(g, [[50, 0], [50, 100]])
    line(g, [[0, 50], [100, 50]])
    g.fillStyle = 'rgba(255,255,255,0.55)'
    g.beginPath()
    g.moveTo(60, 12)
    g.lineTo(80, 12)
    g.lineTo(60, 36)
    g.fill()
  },
  // Gold: a star.
  [GOLD](g) {
    g.fillStyle = '#fff6c8'
    g.beginPath()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 15 : 36
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      g.lineTo(50 + Math.cos(a) * r, 50 + Math.sin(a) * r)
    }
    g.fill()
    g.strokeStyle = '#b07a00'
    g.lineWidth = 4
    g.closePath()
    g.stroke()
  },
}

// Paints one brick in a 100 × 100 square.
export function paintBrick(g, m) {
  g.fillStyle = MATERIAL_COLORS[m]
  g.fillRect(0, 0, 100, 100)
  g.save()
  g.beginPath()
  g.rect(0, 0, 100, 100)
  g.clip()
  PATTERNS[m](g)
  g.restore()
  g.fillStyle = 'rgba(255,255,255,0.28)'
  g.fillRect(0, 0, 100, 9)
  g.fillRect(0, 0, 8, 100)
  g.fillStyle = 'rgba(0,0,0,0.3)'
  g.fillRect(0, 91, 100, 9)
  g.fillRect(92, 0, 8, 100)
  g.strokeStyle = 'rgba(0,0,0,0.55)'
  g.lineWidth = 3
  g.strokeRect(1.5, 1.5, 97, 97)
}
