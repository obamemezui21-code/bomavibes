// COMMANDO OKOUMÉ sprites, in the style of the team's reference sheet:
// dark outlines, jungle camouflage, red beret / bush hat for the commandos,
// cap-and-beard or shaved-head poachers. A figure is a list of pixel boxes
// in a 16×26 frame (feet on the bottom row, facing right); every box is
// drawn once enlarged in the outline colour, then filled.

const OUTLINE = '#15140f'

// Lighter (amount > 0) or darker (< 0) version of a #rrggbb colour.
export function shade(hex, amount) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex
  const n = parseInt(hex.slice(1), 16)
  const ch = (v) => Math.max(0, Math.min(255, Math.round(amount > 0 ? v + (255 - v) * amount : v * (1 + amount))))
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`
}
const GUN = '#2b2b2b'
const GUN_LIGHT = '#4a4a4a'

export const LOOKS = {
  mboumba: {
    head: 'beret', hat: '#b8322a', hatLight: '#dc4b3c', skin: '#5a3825',
    top: '#5d6b34', spots: ['#3e4a22', '#7a8448'], vest: '#46502a', pants: '#55622f', pantsDark: '#3d4721', boots: '#24180f',
  },
  moussavou: {
    head: 'boonie', hat: '#4f6b2a', hatLight: '#66843a', skin: '#6b4226', hair: '#1a1210',
    top: '#5d6b34', spots: ['#3e4a22', '#7a8448'], vest: '#46502a', pants: '#55622f', pantsDark: '#3d4721', boots: '#24180f', pack: '#4a5228',
  },
  soldier: {
    head: 'cap', hat: '#56672c', hatLight: '#6c7f38', skin: '#6b4a33', beard: '#2a1b12',
    top: '#6b6b3a', spots: ['#55552c', '#808048'], vest: '#4d4a2a', pants: '#8a7a55', pantsDark: '#6f6142', boots: '#2a1d14',
  },
  runner: {
    head: 'bald', skin: '#7a5236', tank: '#7a7a4a',
    top: '#7a7a4a', spots: ['#6a6a3e', '#8c8c58'], vest: '#7a7a4a', pants: '#8a7a55', pantsDark: '#6f6142', boots: '#2a1d14',
  },
  sniper: {
    head: 'bald', skin: '#6b4a33', tank: '#5f6a34', beard: '#2a1b12',
    top: '#5f6a34', spots: ['#4a5428', '#727e40'], vest: '#4d4a2a', pants: '#7a6c4b', pantsDark: '#61553a', boots: '#2a1d14',
  },
}

// Legs for each pose: [thighX, shinX, footX, lift] for the back then the front leg.
const RUN = [
  [[4, 3, 2, 0], [8, 10, 10, 1]],
  [[6, 6, 5, 1], [7, 8, 8, 0]],
  [[7, 8, 9, 1], [6, 4, 3, 0]],
  [[6, 7, 7, 0], [7, 6, 5, 1]],
]
const STAND = [[5, 5, 4, 0], [8, 8, 8, 0]]

/**
 * Draws one figure.
 * @param {CanvasRenderingContext2D} g
 * @param {number} cx - centre x (screen px)
 * @param {number} fy - feet y (screen px)
 * @param {1|-1} facing
 * @param {object} look - one of LOOKS
 * @param {{ kind?: 'stand'|'run'|'jump'|'up'|'throw'|'hurt'|'kneel', frame?: number, gun?: 'rifle'|'long'|'none', muzzle?: boolean, flash?: boolean }} pose
 */
export function drawFigure(g, cx, fy, facing, look, pose = {}) {
  const kind = pose.kind || 'stand'
  const gun = pose.gun || 'rifle'
  const boxes = [] // [x, y, w, h, color, outlined]
  const box = (x, y, w, h, color, outlined = true) => boxes.push([x, y, w, h, color, outlined])
  const drop = kind === 'kneel' ? 4 : 0 // the body sits lower when kneeling
  const lean = kind === 'hurt' ? -1 : 0

  // Backpack, behind everything.
  if (look.pack) box(1 + lean, 10 + drop, 4, 8, look.pack)

  // Legs.
  if (kind === 'kneel') {
    box(3, 20, 6, 3, look.pantsDark)
    box(1, 23, 5, 3, look.boots)
    box(9, 19, 3, 5, look.pants)
    box(9, 24, 5, 2, look.boots)
  } else if (kind === 'jump') {
    box(4, 18, 3, 3, look.pantsDark)
    box(3, 20, 3, 3, look.pantsDark)
    box(2, 22, 4, 2, look.boots)
    box(8, 18, 3, 3, look.pants)
    box(10, 19, 3, 3, look.pants)
    box(11, 21, 4, 2, look.boots)
  } else {
    const legs = kind === 'run' ? RUN[(pose.frame || 0) % 4] : STAND
    legs.forEach(([thigh, shin, foot, lift], i) => {
      const color = i === 0 ? look.pantsDark : look.pants
      box(thigh + lean, 18, 3, 3, color)
      box(shin + lean, 21 - lift, 3, 3, color)
      box(foot + lean, 24 - lift, 4, 2, look.boots)
    })
  }

  // Torso: camouflage, or a tank top with bare arms.
  const t = 10 + drop
  box(4 + lean, t, 8, 8, look.tank || look.top)
  if (!look.tank) {
    box(5 + lean, t + 1, 2, 1, look.spots[0], false)
    box(9 + lean, t + 3, 2, 1, look.spots[1], false)
    box(5 + lean, t + 5, 2, 1, look.spots[1], false)
    box(8 + lean, t + 6, 2, 1, look.spots[0], false)
    box(5 + lean, t + 4, 2, 2, look.vest, false)
    box(9 + lean, t + 4, 2, 2, look.vest, false)
  }
  box(4 + lean, t + 7, 8, 1, OUTLINE, false) // belt

  // Head and headgear.
  const h = 3 + drop + lean
  box(5 + lean, h, 6, 7, look.skin)
  box(7 + lean, h + 7, 2, 1, look.skin, false) // neck
  box(9 + lean, h + 3, 1, 1, '#ffffff', false)
  box(10 + lean, h + 3, 1, 1, OUTLINE, false)
  if (look.beard) box(6 + lean, h + 5, 5, 2, look.beard, false)
  if (look.head === 'beret') {
    box(4 + lean, h - 1, 8, 2, look.hat)
    box(5 + lean, h - 2, 6, 1, look.hat)
    box(6 + lean, h - 2, 3, 1, look.hatLight, false)
    box(3 + lean, h, 2, 1, look.hat)
  } else if (look.head === 'boonie') {
    box(4 + lean, h - 3, 8, 3, look.hat)
    box(5 + lean, h - 3, 4, 1, look.hatLight, false)
    box(2 + lean, h, 12, 1, look.hat)
    if (look.hair) box(4 + lean, h + 1, 1, 3, look.hair, false)
  } else if (look.head === 'cap') {
    box(5 + lean, h - 1, 6, 2, look.hat)
    box(6 + lean, h - 1, 3, 1, look.hatLight, false)
    box(10 + lean, h, 3, 1, look.hat)
  } else {
    box(6 + lean, h, 2, 1, '#ffffff33', false) // shine on a shaved head
  }

  // Arms and weapon.
  const sleeve = look.tank ? look.skin : look.top
  if (kind === 'up') {
    // Rifle held up beside the face, not in front of it.
    box(10, t - 1, 3, 5, sleeve)
    box(12, t - 15, 2, 15, GUN)
    box(14, t - 5, 1, 3, GUN_LIGHT, false)
    box(12, t - 3, 2, 2, look.skin, false)
    if (pose.muzzle) {
      box(11, t - 20, 4, 4, '#ffd23f', false)
      box(12, t - 19, 2, 2, '#ffffff', false)
    }
  } else if (kind === 'throw') {
    box(1, t - 5, 3, 6, sleeve)
    box(0, t - 9, 4, 4, '#3f5a22') // the grenade, held high behind the head
    box(1, t - 8, 1, 1, '#8aa05a', false)
    box(9, t + 2, 6, 2, GUN)
  } else if (kind === 'hurt') {
    box(1, t + 1, 3, 3, sleeve)
    box(12, t, 3, 3, sleeve)
    box(0, t + 1, 2, 2, look.skin, false)
    box(14, t - 1, 2, 2, look.skin, false)
  } else if (gun === 'none') {
    const swing = kind === 'run' && (pose.frame || 0) % 2 ? 1 : 0
    box(9, t + 1 + swing, 4, 3, sleeve)
    box(12, t + 1 + swing, 3, 3, look.skin)
  } else {
    const len = gun === 'long' ? 16 : 10
    box(6, t + 3, 4, 2, GUN) // stock
    box(9, t + 2, len, 3, GUN)
    box(10, t + 2, len - 3, 1, GUN_LIGHT, false)
    box(12, t + 5, 2, 3, GUN) // magazine
    box(9, t + 1, 3, 4, sleeve)
    box(12, t + 2, 2, 2, look.skin, false)
    if (pose.muzzle) {
      box(9 + len, t + 1, 4, 5, '#ff9f1c', false)
      box(10 + len, t + 2, 3, 3, '#ffd23f', false)
      box(11 + len, t + 3, 2, 1, '#ffffff', false)
    }
  }

  // Mirror for facing left, then outline pass, then fill pass.
  const left = Math.round(cx) - 8
  const top = Math.round(fy) - 26
  const place = ([x, y, w, hh]) => [facing === 1 ? left + x : left + 16 - x - w, top + y, w, hh]
  // Thin outline (half a world pixel: the buffer is drawn at twice the size).
  g.fillStyle = OUTLINE
  for (const b of boxes) {
    if (!b[5]) continue
    const [x, y, w, hh] = place(b)
    g.fillRect(x - 0.5, y - 0.5, w + 1, hh + 1)
  }
  for (const b of boxes) {
    const [x, y, w, hh] = place(b)
    const muzzle = !b[5] && (b[4] === '#ff9f1c' || b[4] === '#ffd23f' || b[4] === '#ffffff')
    g.fillStyle = pose.flash && !muzzle ? '#ffffff' : b[4]
    g.fillRect(x, y, w, hh)
    // Volume: light from the top-left, shadow on the far side and underneath.
    if (b[5] && !pose.flash && w >= 2 && hh >= 2) {
      const light = facing === 1 ? x : x + w - 0.5
      const dark = facing === 1 ? x + w - 0.5 : x
      g.fillStyle = shade(b[4], 0.22)
      g.fillRect(x, y, w, 0.5)
      g.fillRect(light, y, 0.5, hh)
      g.fillStyle = shade(b[4], -0.3)
      g.fillRect(dark, y + 0.5, 0.5, hh - 0.5)
      g.fillRect(x, y + hh - 0.5, w, 0.5)
    }
  }
}

// A poacher out of action, lying on the ground (first half of the defeat).
export function drawLying(g, cx, fy, look) {
  const left = Math.round(cx) - 11
  const top = Math.round(fy) - 7
  const parts = [
    [0, 2, 4, 3, look.boots],
    [3, 2, 7, 4, look.pants],
    [9, 1, 8, 5, look.tank || look.top],
    [16, 0, 6, 6, look.skin],
  ]
  g.fillStyle = OUTLINE
  for (const [x, y, w, h] of parts) g.fillRect(left + x - 0.5, top + y - 0.5, w + 1, h + 1)
  for (const [x, y, w, h, c] of parts) {
    g.fillStyle = c
    g.fillRect(left + x, top + y, w, h)
  }
  if (look.head === 'cap') {
    g.fillStyle = look.hat
    g.fillRect(left + 18, top - 2, 5, 2)
  }
}

// Grey smoke puff with a white ✕ (second half of the defeat).
export function drawPuff(g, cx, fy, progress) {
  const size = 4 + progress * 6
  g.globalAlpha = 1 - progress * 0.6
  g.fillStyle = '#c9c9c9'
  for (const [dx, dy, k] of [[-5, 0, 1], [4, -1, 0.9], [0, -5, 1.1], [-2, 3, 0.8], [5, 4, 0.7]]) {
    g.beginPath()
    g.arc(cx + dx, fy - 6 + dy, size * k, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = '#ffffff'
  const x = Math.round(cx) + 8
  const y = Math.round(fy) - 22
  for (let i = 0; i < 5; i++) {
    g.fillRect(x + i, y + i, 1, 1)
    g.fillRect(x + 4 - i, y + i, 1, 1)
  }
  g.globalAlpha = 1
}
