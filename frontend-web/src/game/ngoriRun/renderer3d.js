import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { JUMP_TICKS, SLIDE_TICKS } from '../../../../shared/ngori-run/engine.mjs'
import runnersUrl from '../../assets/game/runners.webp'
import roadsideUrl from '../../assets/game/roadside.webp'
import horizonsUrl from '../../assets/game/horizons.webp'
import monumentsUrl from '../../assets/game/monuments.webp'
import {
  BUILDING_COLORS,
  CAR_COLORS,
  HORIZONS,
  HORIZON_FADE_M,
  MONUMENTS,
  MOTO_HEIGHT_CM,
  MOTO_SPRITES,
  POWERUP_STYLE,
  ROADSIDE,
  ROADSIDE_SCALE,
  RUNNERS,
  SHEET,
  TAXI,
  TRAFFIC_CARS,
  TRAFFIC_CAR_WIDTH_CM,
  TRAFFIC_URL,
  hash,
  horizonAt,
  isTaxi,
  motoTilt,
  trafficCarFor,
} from './renderer.js'
import {
  DIRECTION_SIGNS,
  DISTRICTS,
  FOREST_DISTRICTS,
  LANDMARKS,
  SHOP_SIGNS,
  STALL_EVERY,
  districtAt,
  passerbyFor,
  stallFor,
} from './libreville.js'

// NGORI RUN in 3D (beta) — the same Libreville seafront as renderer.js, drawn
// with Three.js: a real road, real depth and a camera that follows the
// runner. Same interface as createRenderer, and just as purely visual:
// nothing here may feed back into the simulation.
//
// World units are metres (the engine's cm / 100), x to the right, y up and
// -z ahead. The runner never moves forward: every frame the world is placed
// relative to them (z = -distance ahead), which keeps floats precise however
// long the run.

const M = 0.01 // cm → m
const LANE_W = 1.8
const ROAD_HALF = LANE_W * 1.5
const VIEW_CM = 12500 // as far ahead as renderer.js draws
const RUNNER_Z = -0.3
const SKY_R = 480
const STRIP_LEN = 140 // m of road drawn ahead
const STRIP_BACK = 12 // m of road behind the runner

const COLORS = {
  fog: '#f2967a',
  sea: '#2b2f6b',
  plaza: '#3a2340',
  plazaAlt: '#43294a',
  promenade: '#c9a27c',
  promenadeAlt: '#bb926d',
  road: '#2a2233',
  roadAlt: '#2f2639',
  curb: '#e9467d',
  curbAlt: '#f4efe9',
}
// [height above the horizon (sine of the elevation), colour]
const SKY_STOPS = [
  [0, COLORS.fog],
  [0.04, '#ffb36b'],
  [0.12, '#f0607a'],
  [0.3, '#6b2a7a'],
  [0.65, '#1d0b36'],
]
const VENUE_EMOJI = { Restaurant: '🍽️', Bar: '🍸', Lounge: '🛋️' }

export function createRenderer3d(container, { runner = 'man' } = {}) {
  const runnerRow = RUNNERS[runner] ?? 0
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
  container.appendChild(canvas)
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  let gl
  try {
    gl = new THREE.WebGLRenderer({ canvas, antialias: dpr < 1.5, powerPreference: 'high-performance' })
  } catch (err) {
    canvas.remove()
    throw err
  }
  gl.setPixelRatio(dpr)
  gl.autoClear = false
  gl.shadowMap.enabled = true
  gl.shadowMap.type = THREE.PCFSoftShadowMap
  const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy())

  let disposed = false
  let billboards = []
  const stadium = LANDMARKS.find((l) => l.visual === 'stadium')
  const stadiumZ = stadium ? stadium.at * 100 : -1e9
  const airport = LANDMARKS.find((l) => l.visual === 'plane')
  const airportZ = airport ? airport.at * 100 : -1e9

  // ---- Resources ---------------------------------------------------------
  // Geometries, materials and textures shared for the renderer's lifetime;
  // what belongs to one object only goes in its userData.own.
  const owned = []
  const keep = (x) => {
    owned.push(x)
    return x
  }
  const lambertCache = new Map()
  const lambert = (color) => {
    let m = lambertCache.get(color)
    if (!m) lambertCache.set(color, (m = keep(new THREE.MeshLambertMaterial({ color }))))
    return m
  }
  const basicCache = new Map()
  const basic = (color) => {
    let m = basicCache.get(color)
    if (!m) basicCache.set(color, (m = keep(new THREE.MeshBasicMaterial({ color }))))
    return m
  }
  const boxGeo = keep(new THREE.BoxGeometry(1, 1, 1))
  const planeGeo = keep(new THREE.PlaneGeometry(1, 1))
  const poleGeo = keep(new THREE.CylinderGeometry(0.5, 0.5, 1, 8).translate(0, 0.5, 0))

  function paint(w, h, draw) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    draw(c.getContext('2d'), w, h)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = aniso
    return t
  }
  // Painted textures reused by key (sign texts, district names…).
  const painted = new Map()
  function painting(key, w, h, draw) {
    let t = painted.get(key)
    if (!t) painted.set(key, (t = keep(paint(w, h, draw))))
    return t
  }
  const panelMats = new Map()
  function panelMat(key, w, h, draw, opts = {}) {
    let m = panelMats.get(key)
    if (!m) panelMats.set(key, (m = keep(new THREE.MeshBasicMaterial({ map: painting(key, w, h, draw), ...opts }))))
    return m
  }

  // A box of w × h × d standing on y, centred on x and z.
  function cube(w, h, d, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(boxGeo, material)
    m.scale.set(w, h, d)
    m.position.set(x, y + h / 2, z)
    return m
  }
  function pole(radius, h, material, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(poleGeo, material)
    m.scale.set(radius * 2, h, radius * 2)
    m.position.set(x, y, z)
    return m
  }

  const glowTex = keep(
    paint(128, 128, (ctx, w) => {
      const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.35, 'rgba(255,255,255,0.45)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, w)
    }),
  )
  const glowMats = new Map()
  function glow(color, size, opacity = 1) {
    const key = `${color}|${opacity}`
    let m = glowMats.get(key)
    if (!m) {
      m = keep(
        new THREE.SpriteMaterial({ map: glowTex, color, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
      )
      glowMats.set(key, m)
    }
    const s = new THREE.Sprite(m)
    s.scale.set(size, size, 1)
    return s
  }

  function fitText(ctx, text, weight, size, maxW) {
    let s = size
    ctx.font = `${weight} ${s}px system-ui, sans-serif`
    while (s > 8 && ctx.measureText(text).width > maxW) {
      s -= 2
      ctx.font = `${weight} ${s}px system-ui, sans-serif`
    }
  }

  // ---- Scene, camera, lights ---------------------------------------------
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(COLORS.fog, 40, VIEW_CM * M)
  const camera = new THREE.PerspectiveCamera(64, 1, 0.3, 700)
  scene.add(new THREE.HemisphereLight('#ffd5cc', '#1b1130', 1.8))
  const sunLight = new THREE.DirectionalLight('#ffc28a', 2.8)
  sunLight.position.set(-60, 25, -80)
  sunLight.castShadow = true
  sunLight.shadow.mapSize.set(1024, 1024)
  sunLight.shadow.camera.left = -35
  sunLight.shadow.camera.right = 35
  sunLight.shadow.camera.top = 30
  sunLight.shadow.camera.bottom = -30
  sunLight.shadow.camera.near = 1
  sunLight.shadow.camera.far = 120
  const fillLight = new THREE.DirectionalLight('#b9a6ff', 1.1)
  fillLight.position.set(20, 30, 60)
  scene.add(sunLight, fillLight)

  // Everything at the horizon follows the camera: sky, sun, sea, panoramas.
  const skyGroup = new THREE.Group()
  scene.add(skyGroup)

  const skyGeo = keep(new THREE.SphereGeometry(SKY_R, 32, 32))
  {
    const pos = skyGeo.attributes.position
    const colors = []
    const c = new THREE.Color()
    const a = new THREE.Color()
    const b = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getY(i) / SKY_R
      let j = 0
      while (j < SKY_STOPS.length - 2 && t > SKY_STOPS[j + 1][0]) j++
      const [t0, c0] = SKY_STOPS[j]
      const [t1, c1] = SKY_STOPS[j + 1]
      const f = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)))
      c.copy(a.set(c0)).lerp(b.set(c1), f)
      colors.push(c.r, c.g, c.b)
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  }
  const sky = new THREE.Mesh(
    skyGeo,
    keep(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })),
  )
  sky.renderOrder = -10
  skyGroup.add(sky)
  const daySkyTint = new THREE.Color('#ffffff')
  const nightSkyTint = new THREE.Color('#81769f')
  const sunsetFog = new THREE.Color(COLORS.fog)
  const nightFog = new THREE.Color('#34264f')

  // Sun setting over the estuary, on the sea side; placed on resize.
  const sunDisc = new THREE.Sprite(
    keep(
      new THREE.SpriteMaterial({
        map: keep(
          paint(128, 128, (ctx, w) => {
            ctx.fillStyle = '#ffe2a8'
            ctx.beginPath()
            ctx.arc(w / 2, w / 2, w / 2 - 2, 0, Math.PI * 2)
            ctx.fill()
          }),
        ),
        fog: false,
        depthWrite: false,
      }),
    ),
  )
  sunDisc.scale.set(34, 34, 1)
  const sunGlow = glow('#ffd68c', 150, 0.85)
  sunGlow.material.fog = false
  sunDisc.renderOrder = -8
  sunGlow.renderOrder = -9
  skyGroup.add(sunGlow, sunDisc)

  // Slow drifting clouds.
  const cloudMat = keep(
    new THREE.SpriteMaterial({ map: glowTex, color: '#ffaabe', opacity: 0.22, transparent: true, fog: false, depthWrite: false }),
  )
  const clouds = Array.from({ length: 4 }, (_, i) => {
    const s = new THREE.Sprite(cloudMat)
    s.scale.set(160, 9, 1)
    s.renderOrder = -7
    s.userData.y = 40 + hash(i + 3) * 70
    s.userData.speed = 2 * (i + 1)
    s.userData.x0 = hash(i + 11)
    skyGroup.add(s)
    return s
  })

  // Warm firefly-like motes drift around the runner and gradually cool in tone
  // as the run moves from sunset into night.
  const MOTE_COUNT = 64
  const moteGeo = keep(new THREE.BufferGeometry())
  const motePositions = new Float32Array(MOTE_COUNT * 3)
  const moteVelocities = new Float32Array(MOTE_COUNT * 3)
  const moteColors = new Float32Array(MOTE_COUNT * 3)
  const sunsetMote = new THREE.Color('#ffd28a')
  const nightMote = new THREE.Color('#c4a7ff')
  for (let i = 0; i < MOTE_COUNT; i++) {
    const j = i * 3
    motePositions[j] = (hash(i * 3 + 1) - 0.5) * 34
    motePositions[j + 1] = -1 + hash(i * 3 + 2) * 9
    motePositions[j + 2] = -3 - hash(i * 3 + 3) * 48
    moteVelocities[j] = (hash(i * 5 + 4) - 0.5) * 0.35
    moteVelocities[j + 1] = 0.08 + hash(i * 5 + 5) * 0.18
    moteVelocities[j + 2] = 1.1 + hash(i * 5 + 6) * 1.8
    const color = sunsetMote.clone().lerp(nightMote, hash(i * 7 + 2) * 0.55)
    moteColors[j] = color.r
    moteColors[j + 1] = color.g
    moteColors[j + 2] = color.b
  }
  moteGeo.setAttribute('position', new THREE.Float32BufferAttribute(motePositions, 3))
  moteGeo.setAttribute('color', new THREE.Float32BufferAttribute(moteColors, 3))
  const motes = new THREE.Points(
    moteGeo,
    keep(
      new THREE.PointsMaterial({
        map: glowTex,
        size: 0.22,
        vertexColors: true,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    ),
  )
  motes.frustumCulled = false
  scene.add(motes)

  // The sea, under everything left of the road and out to the horizon.
  const sea = new THREE.Mesh(planeGeo, keep(new THREE.MeshLambertMaterial({ color: COLORS.sea })))
  sea.rotation.x = -Math.PI / 2
  sea.scale.set(1400, 1400, 1)
  sea.position.y = -0.05
  skyGroup.add(sea)

  // The sun's reflection on the water.
  const glitterTex = keep(
    paint(64, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, 0)
      g.addColorStop(0, 'rgba(255,200,140,0)')
      g.addColorStop(0.5, 'rgba(255,200,140,1)')
      g.addColorStop(1, 'rgba(255,200,140,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      // Fade towards the shore, broken into ripples.
      ctx.globalCompositeOperation = 'destination-in'
      for (let y = 0; y < h; y += 4) {
        ctx.fillStyle = `rgba(0,0,0,${(1 - y / h) * (0.35 + 0.65 * hash(y))})`
        ctx.fillRect(0, y, w, 3)
      }
    }),
  )
  const glitter = new THREE.Mesh(
    planeGeo,
    keep(
      new THREE.MeshBasicMaterial({
        map: glitterTex,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    ),
  )
  glitter.rotation.x = -Math.PI / 2
  glitter.position.y = -0.02
  const glitterPivot = new THREE.Group()
  glitterPivot.add(glitter)
  skyGroup.add(glitterPivot)

  // Pointe Denis, across the estuary, while running along the Bord de mer.
  const pointeDenis = new THREE.Mesh(
    keep(new THREE.CircleGeometry(1, 32, 0, Math.PI)),
    keep(new THREE.MeshBasicMaterial({ color: '#3d2a5c', fog: false, transparent: true, depthWrite: false })),
  )
  pointeDenis.renderOrder = -6
  skyGroup.add(pointeDenis)

  // Far-away horizon panoramas (city, forest coast, port), three side by side.
  const horizons = HORIZONS.map(() => {
    const mat = keep(new THREE.MeshBasicMaterial({ transparent: true, fog: false, depthWrite: false, opacity: 0 }))
    const group = new THREE.Group()
    for (let i = -1; i <= 1; i++) {
      const m = new THREE.Mesh(planeGeo, mat)
      m.renderOrder = -5
      m.userData.slot = i
      group.add(m)
    }
    group.visible = false
    skyGroup.add(group)
    return { mat, group }
  })

  // A plane climbing out of Léon Mba airport while you run past it.
  const plane = new THREE.Group()
  {
    const white = keep(new THREE.MeshBasicMaterial({ color: '#f1f5f9', fog: false }))
    plane.add(cube(12, 1.6, 1.6, white, 0, -0.8))
    plane.add(cube(2.6, 0.25, 15, white, -1, -0.4))
    plane.add(cube(1.6, 3, 0.3, white, 5.4, 0))
    const blink = glow('#ef4444', 4)
    blink.material.fog = false
    blink.position.set(5.6, 3, 0)
    plane.add(blink)
    plane.userData.blink = blink
    plane.rotation.z = 0.12
    plane.visible = false
    skyGroup.add(plane)
  }

  // ---- The road ----------------------------------------------------------
  // One strip from the promenade to the right curb, 2.5 cm a pixel, repeated
  // every 10 m and scrolled with the distance run.
  const STRIP_X0 = -ROAD_HALF - 3.8
  const STRIP_X1 = ROAD_HALF + 0.22
  const stripTex = keep(
    paint(Math.round((STRIP_X1 - STRIP_X0) * 40), 400, (ctx, w) => {
      const px = (x) => Math.round((x - STRIP_X0) * 40)
      for (let half = 0; half < 2; half++) {
        const alt = half === 0
        const y = half * 200
        ctx.fillStyle = alt ? COLORS.promenade : COLORS.promenadeAlt
        ctx.fillRect(0, y, px(-ROAD_HALF), 200)
        ctx.fillStyle = alt ? COLORS.road : COLORS.roadAlt
        ctx.fillRect(px(-ROAD_HALF), y, px(ROAD_HALF) - px(-ROAD_HALF), 200)
        ctx.fillStyle = alt ? COLORS.curb : COLORS.curbAlt
        ctx.fillRect(px(-ROAD_HALF - 0.22), y, px(-ROAD_HALF) - px(-ROAD_HALF - 0.22), 200)
        ctx.fillRect(px(ROAD_HALF), y, w - px(ROAD_HALF), 200)
        if (alt) {
          ctx.fillStyle = 'rgba(255,255,255,0.75)'
          for (const lx of [-LANE_W / 2, LANE_W / 2]) ctx.fillRect(px(lx) - 2, y + 24, 4, 152)
        }
      }
    }),
  )
  stripTex.wrapT = THREE.RepeatWrapping
  stripTex.repeat.set(1, (STRIP_LEN + STRIP_BACK) / 10)
  const strip = new THREE.Mesh(planeGeo, keep(new THREE.MeshLambertMaterial({ map: stripTex })))
  strip.rotation.x = -Math.PI / 2
  strip.scale.set(STRIP_X1 - STRIP_X0, STRIP_LEN + STRIP_BACK, 1)
  strip.position.set((STRIP_X0 + STRIP_X1) / 2, 0, STRIP_BACK - (STRIP_LEN + STRIP_BACK) / 2)
  strip.receiveShadow = true
  scene.add(strip)

  const plazaTex = keep(
    paint(1, 2, (ctx) => {
      ctx.fillStyle = COLORS.plaza
      ctx.fillRect(0, 0, 1, 1)
      ctx.fillStyle = COLORS.plazaAlt
      ctx.fillRect(0, 1, 1, 1)
    }),
  )
  plazaTex.magFilter = THREE.NearestFilter
  plazaTex.minFilter = THREE.NearestFilter
  plazaTex.generateMipmaps = false
  plazaTex.wrapT = THREE.RepeatWrapping
  plazaTex.repeat.set(1, (STRIP_LEN + STRIP_BACK) / 10)
  const plaza = new THREE.Mesh(planeGeo, keep(new THREE.MeshLambertMaterial({ map: plazaTex })))
  plaza.rotation.x = -Math.PI / 2
  plaza.scale.set(200, STRIP_LEN + STRIP_BACK, 1)
  plaza.position.set(STRIP_X1 + 100, 0, strip.position.z)
  plaza.receiveShadow = true
  scene.add(plaza)

  // ---- Pictures from the 2D game ------------------------------------------
  const loader = new THREE.TextureLoader()
  function load(url, onLoad) {
    const t = keep(loader.load(url, () => !disposed && onLoad?.(t)))
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  // A [x, y, w, h] rectangle of a loaded picture, as its own texture.
  function region(tex, [sx, sy, sw, sh], mirror = false) {
    const { width, height } = tex.image
    const t = keep(tex.clone())
    t.repeat.set(((mirror ? -1 : 1) * sw) / width, sh / height)
    t.offset.set((mirror ? sx + sw : sx) / width, 1 - (sy + sh) / height)
    t.needsUpdate = true
    return t
  }
  // A standing picture: plane geometry with its feet at the origin.
  function standee(tex, rect, heightM) {
    const [, , sw, sh] = rect
    const w = (heightM * sw) / sh
    return {
      geo: keep(new THREE.PlaneGeometry(w, heightM).translate(0, heightM / 2, 0)),
      mat: keep(new THREE.MeshBasicMaterial({ map: region(tex, rect), alphaTest: 0.5, side: THREE.DoubleSide })),
      w,
    }
  }

  // Cars seen from behind: the picture on the back, a body in their colour behind it.
  let traffic = null
  load(TRAFFIC_URL, (tex) => {
    traffic = TRAFFIC_CARS.map(({ rect }) => standee(tex, rect, ((TRAFFIC_CAR_WIDTH_CM * rect[3]) / rect[2]) * M))
    // Cars already on the road were built as plain boxes: rebuild them.
    for (const [key, o] of live) {
      if (key.startsWith('o')) {
        release(o)
        live.delete(key)
      }
    }
  })

  let roadside = null
  load(roadsideUrl, (tex) => {
    roadside = ROADSIDE.map(({ rect, heightCm }) => standee(tex, rect, heightCm * ROADSIDE_SCALE * M))
  })
  let monuments = null
  load(monumentsUrl, (tex) => {
    monuments = MONUMENTS.map((m) => ({ ...standee(tex, m.rect, m.heightCm * M), lengthCm: m.lengthCm, heightCm: m.heightCm }))
  })
  load(horizonsUrl, (tex) => {
    HORIZONS.forEach((band, i) => {
      const { mat, group } = horizons[i]
      mat.map = region(tex, [0, band.y, tex.image.width, band.h], band.mirror)
      mat.needsUpdate = true
      group.userData.ratio = band.h / tex.image.width
      group.userData.ready = true
    })
    layoutHorizons()
  })

  let sheetLoaded = false
  const sheetTex = load(runnersUrl, () => {
    sheetLoaded = true
    runnerSprite.visible = true
    runnerFallback.visible = false
  })
  sheetTex.repeat.set(1 / 4, 1 / 6)
  sheetTex.generateMipmaps = false
  sheetTex.minFilter = THREE.LinearFilter

  // ---- The runner ----------------------------------------------------------
  const cmPerPx = 178 / SHEET.figureH
  const runnerGroup = new THREE.Group()
  scene.add(runnerGroup)
  const shadow = new THREE.Mesh(
    planeGeo,
    keep(new THREE.MeshBasicMaterial({ map: glowTex, color: '#000000', transparent: true, opacity: 0.5, depthWrite: false })),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.02
  runnerGroup.add(shadow)
  const runnerSprite = new THREE.Mesh(
    keep(
      new THREE.PlaneGeometry(SHEET.cellW * cmPerPx * M, SHEET.cellH * cmPerPx * M).translate(
        0,
        (SHEET.cellH * cmPerPx * M) / 2 - SHEET.feetPad * cmPerPx * M,
        0,
      ),
    ),
    keep(new THREE.MeshBasicMaterial({ map: sheetTex, alphaTest: 0.4, fog: false })),
  )
  runnerSprite.visible = false
  runnerSprite.renderOrder = 5
  runnerGroup.add(runnerSprite)
  // Until the sprite sheet has loaded: a plain capsule in the jacket colours.
  const runnerFallback = new THREE.Mesh(
    keep(new THREE.CapsuleGeometry(0.3, 1.1, 4, 10).translate(0, 0.85, 0)),
    keep(new THREE.MeshLambertMaterial({ color: '#8b5cf6', emissive: '#ec4899', emissiveIntensity: 0.4 })),
  )
  runnerGroup.add(runnerFallback)
  const shieldBubble = new THREE.Mesh(
    keep(new THREE.SphereGeometry(1, 20, 14)),
    keep(
      new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  )
  shieldBubble.scale.set(0.75, 1.15, 0.75)
  shieldBubble.position.y = 0.95
  runnerGroup.add(shieldBubble)
  const magnetRing = new THREE.Mesh(
    keep(new THREE.TorusGeometry(1.2, 0.035, 6, 48).rotateX(Math.PI / 2)),
    keep(new THREE.MeshBasicMaterial({ color: '#f43f5e', transparent: true, depthWrite: false })),
  )
  magnetRing.position.y = 0.9
  runnerGroup.add(magnetRing)
  const boostGlow = glow('#f59e0b', 3, 0.6)
  boostGlow.position.y = 0.9
  runnerGroup.add(boostGlow)

  // On the motorbike (power-up): its picture (bike and rider together, see
  // MOTO_SPRITES) stands in for the runner, facing the camera like it.
  let motoLoaded = false
  const motoTex = load(MOTO_SPRITES[runner] ?? MOTO_SPRITES.man, (tex) => {
    motoLoaded = true
    const h = MOTO_HEIGHT_CM * M
    motoSprite.scale.set((h * tex.image.naturalWidth) / tex.image.naturalHeight, h, 1)
  })
  const motoSprite = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0)),
    keep(new THREE.MeshBasicMaterial({ map: motoTex, transparent: true, alphaTest: 0.05, fog: false })),
  )
  motoSprite.visible = false
  motoSprite.renderOrder = 5
  runnerGroup.add(motoSprite)

  // MOTO BOMA duel: the challenger's replayed race, as a see-through bike
  // with their first name above it.
  const ghostMats = Object.fromEntries(
    Object.entries(MOTO_SPRITES).map(([id, src]) => {
      const mat = keep(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false, fog: false }))
      mat.map = load(src, (tex) => (mat.userData.aspect = tex.image.naturalWidth / tex.image.naturalHeight))
      return [id, mat]
    }),
  )
  const ghostSprite = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0)), ghostMats.man)
  ghostSprite.visible = false
  ghostSprite.renderOrder = 4
  scene.add(ghostSprite)
  const ghostLabel = new THREE.Sprite(keep(new THREE.SpriteMaterial({ transparent: true, depthTest: false, fog: false })))
  ghostLabel.renderOrder = 16
  ghostLabel.visible = false
  scene.add(ghostLabel)
  let ghostLabelName = null

  function updateGhost(ghost) {
    const mat = ghost && (ghostMats[ghost.runner] || ghostMats.man)
    const shown = !!mat?.userData.aspect
    ghostSprite.visible = shown
    ghostLabel.visible = shown
    if (!shown) return
    ghostSprite.material = mat
    const h = MOTO_HEIGHT_CM * M
    ghostSprite.scale.set(h * mat.userData.aspect, h, 1)
    ghostSprite.position.set((ghost.lane - 1) * LANE_W, 0, RUNNER_Z - ghost.zr * M)
    ghostSprite.quaternion.copy(camera.quaternion)
    if (ghostLabelName !== ghost.name) {
      ghostLabelName = ghost.name
      ghostLabel.material.map?.dispose()
      ghostLabel.material.map = paint(512, 96, (ctx, w, hh) => {
        ctx.font = '800 56px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineWidth = 8
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'
        ctx.strokeText(`👻 ${ghost.name}`, w / 2, hh / 2)
        ctx.fillStyle = '#67e8f9'
        ctx.fillText(`👻 ${ghost.name}`, w / 2, hh / 2)
      })
      ghostLabel.material.needsUpdate = true
    }
    ghostLabel.scale.set(1.6, 0.3, 1)
    ghostLabel.position.set(ghostSprite.position.x, h + 0.25, ghostSprite.position.z)
  }
  const timesTwo = new THREE.Sprite(
    keep(
      new THREE.SpriteMaterial({
        map: keep(
          paint(128, 64, (ctx, w, h) => {
            ctx.font = '900 52px system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = '#c084fc'
            ctx.fillText('×2', w / 2, h / 2)
          }),
        ),
        fog: false,
        depthTest: false,
      }),
    ),
  )
  timesTwo.scale.set(0.7, 0.35, 1)
  timesTwo.renderOrder = 15
  runnerGroup.add(timesTwo)

  const impactRing = new THREE.Mesh(
    keep(new THREE.TorusGeometry(0.55, 0.055, 8, 32).rotateX(Math.PI / 2)),
    keep(new THREE.MeshBasicMaterial({ color: '#fb7185', transparent: true, opacity: 0, depthWrite: false })),
  )
  impactRing.visible = false
  scene.add(impactRing)
  const impactParticleGeo = keep(new THREE.IcosahedronGeometry(0.12, 0))
  const impactParticleMat = keep(new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0, depthWrite: false }))
  const impactParticles = Array.from({ length: 14 }, () => {
    const particle = new THREE.Mesh(impactParticleGeo, impactParticleMat)
    particle.visible = false
    scene.add(particle)
    return particle
  })

  // ---- Overlay: flash, crash vignette, speed lines --------------------------
  const hud = new THREE.Scene()
  const hudCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1)
  const nightWash = new THREE.Mesh(
    planeGeo,
    keep(new THREE.MeshBasicMaterial({ color: '#21163c', transparent: true, opacity: 0, depthTest: false, depthWrite: false })),
  )
  nightWash.renderOrder = 1
  const flash = new THREE.Mesh(planeGeo, keep(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 })))
  const vignette = new THREE.Mesh(
    planeGeo,
    keep(
      new THREE.MeshBasicMaterial({
        map: keep(
          paint(256, 256, (ctx, w) => {
            const g = ctx.createRadialGradient(w / 2, w / 2, w * 0.2, w / 2, w / 2, w * 0.72)
            g.addColorStop(0, 'rgba(225,29,72,0)')
            g.addColorStop(1, 'rgba(225,29,72,1)')
            ctx.fillStyle = g
            ctx.fillRect(0, 0, w, w)
          }),
        ),
        transparent: true,
        opacity: 0,
      }),
    ),
  )
  const SPEED_LINES = 22
  const speedGeo = keep(new THREE.BufferGeometry())
  speedGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(SPEED_LINES * 6), 3))
  const speedLines = new THREE.LineSegments(speedGeo, keep(new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true })))
  speedLines.frustumCulled = false
  hud.add(speedLines, nightWash, flash, vignette)

  // ---- Layout on resize --------------------------------------------------------
  let W = 1
  let H = 1
  let camBack = 6
  let camH = 3.5
  let camX = 0
  let baseFov = camera.fov
  let previousPlayerX = 0
  let laneVelocity = 0

  function layoutHorizons() {
    // As in renderer.js: the forest band takes ~19% of the screen height.
    const halfV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const D = SKY_R * 0.85
    const scale = (0.19 * 2 * D * halfV) / 250
    for (const { group } of horizons) {
      if (!group.userData.ready) continue
      const w = scale * 1264
      const h = w * group.userData.ratio
      for (const m of group.children) {
        m.scale.set(w, h, 1)
        m.position.set(m.userData.slot * w, h / 2 - 0.5, -D)
      }
    }
  }

  function resize(width, height) {
    W = Math.max(1, width)
    H = Math.max(1, height)
    gl.setSize(W, H, false)
    const aspect = W / H
    baseFov = aspect < 1 ? 70 : 58
    camera.fov = baseFov
    camera.aspect = aspect
    camera.updateProjectionMatrix()
    // Far enough back for the three lanes to fit across a narrow phone while
    // keeping the road immersive and close to the runner.
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect
    camBack = Math.min(7.8, Math.max(4.4, 2.7 / halfH))
    camH = 2.1 + camBack * 0.32

    // Sun and Pointe Denis on the left of the screen, like the 2D game.
    const hAngle = Math.atan(halfH)
    const sunAz = -hAngle * 0.56
    const D = SKY_R * 0.9
    sunDisc.position.set(Math.sin(sunAz) * D, 22, -Math.cos(sunAz) * D)
    sunGlow.position.copy(sunDisc.position)
    sunLight.position.set(Math.sin(sunAz) * 100, 30, -Math.cos(sunAz) * 100)
    glitterPivot.rotation.y = -sunAz
    glitter.scale.set(40, D, 1)
    glitter.position.set(0, -0.02, -D / 2 - 12)
    const denisAz = -hAngle * 0.68
    pointeDenis.position.set(Math.sin(denisAz) * SKY_R * 0.8, -0.3, -Math.cos(denisAz) * SKY_R * 0.8)
    pointeDenis.rotation.y = -denisAz
    pointeDenis.scale.set(Math.tan(hAngle * 0.32) * SKY_R * 0.8, 9, 1)
    layoutHorizons()

    hudCam.left = -W / 2
    hudCam.right = W / 2
    hudCam.top = H / 2
    hudCam.bottom = -H / 2
    hudCam.updateProjectionMatrix()
    flash.scale.set(W, H, 1)
    nightWash.scale.set(W, H, 1)
    vignette.scale.set(W, H, 1)
  }

  // ---- Objects placed along the road ---------------------------------------------
  // Each is built the first time it comes into view, kept while in view and
  // dropped once out of it. z (cm) = distance ahead of the runner.
  const live = new Map()
  let frameNo = 0
  let camBackCm = 600
  const inView = (zr0, zr1 = zr0) => zr1 > -camBackCm - 300 && zr0 < VIEW_CM
  function applyShadows(obj) {
    obj.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return obj
  }
  function place(key, build, zr, x = 0, y = 0) {
    let o = live.get(key)
    if (!o) {
      o = applyShadows(build())
      live.set(key, o)
      scene.add(o)
    }
    o.userData.frame = frameNo
    o.position.set(x, y, -zr * M)
    return o
  }
  function release(o) {
    scene.remove(o)
    for (const r of o.userData.own || []) r.dispose()
  }
  function sweep() {
    for (const [key, o] of live) {
      if (o.userData.frame !== frameNo) {
        release(o)
        live.delete(key)
      }
    }
  }
  const group = (...children) => {
    const g = new THREE.Group()
    if (children.length) g.add(...children)
    return g
  }
  // Turns a standing picture to face the camera (around the vertical only).
  function faceCamera(o) {
    o.rotation.y = Math.atan2(camera.position.x - o.position.x, camera.position.z - o.position.z)
  }

  // Buildings on the city side: one block per 15 m, windows lit at random.
  function buildBuilding(k) {
    const h = 7 + Math.floor(hash(k) * 10)
    const color = BUILDING_COLORS[Math.floor(hash(k + 99) * BUILDING_COLORS.length)]
    const PX = 8 // pixels a metre
    const draw = (lit) => (ctx, w, ht) => {
      ctx.fillStyle = lit ? '#000' : color
      ctx.fillRect(0, 0, w, ht)
      for (let row = 1; row * 2.2 < h - 1; row++) {
        for (let col = 0; col < 4; col++) {
          const on = hash(k * 31 + row * 7 + col) >= 0.45
          if (lit && !on) continue
          ctx.fillStyle = on ? '#ffd68c' : 'rgba(20,5,30,0.45)'
          ctx.fillRect((1.2 + col * 2.7) * PX, ht - (row * 2.2 + 1.2) * PX, 1.4 * PX, 1.2 * PX)
        }
      }
    }
    const map = paint(12 * PX, h * PX, draw(false))
    const emissiveMap = paint(12 * PX, h * PX, draw(true))
    const facade = new THREE.MeshLambertMaterial({ map, emissiveMap, emissive: '#ffffff', emissiveIntensity: 0.85 })
    const side = lambert(color)
    const body = new THREE.Mesh(boxGeo, [side, facade, lambert('#2a1a33'), side, facade, side])
    body.scale.set(10, h, 12)
    body.position.set(5, h / 2, 0)
    const g = group(body)
    if (hash(k + 5) < 0.55) {
      const text = SHOP_SIGNS[k % SHOP_SIGNS.length]
      const sign = new THREE.Mesh(
        planeGeo,
        panelMat(
          `neon|${text}`,
          512,
          96,
          (ctx, w, ht) => {
            fitText(ctx, text, 800, 60, w - 40)
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.shadowColor = '#ff4fa3'
            ctx.shadowBlur = 18
            ctx.fillStyle = '#ffd1e8'
            ctx.fillText(text, w / 2, ht / 2)
            ctx.fillText(text, w / 2, ht / 2)
          },
          { transparent: true, depthWrite: false, fog: true },
        ),
      )
      sign.scale.set(5, 0.95, 1)
      sign.position.set(-0.6, 2.8, 3)
      sign.rotation.y = -Math.PI / 4
      g.add(sign)
    }
    g.userData.own = [map, emissiveMap, facade]
    return g
  }

  const trunkGeo = keep(new THREE.CylinderGeometry(0.2, 0.3, 1, 6).translate(0, 0.5, 0))
  const crownGeo = keep(
    (() => {
      const parts = [
        [-0.6, 0.35, 0.8, '#14532d'],
        [0.6, 0.3, 0.75, '#166534'],
        [0, 0, 1, '#15803d'],
      ].map(([dx, dy, r, color]) => {
        const g = new THREE.IcosahedronGeometry(r, 0).translate(dx, dy, 0)
        const c = new THREE.Color(color)
        g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count).fill([c.r, c.g, c.b]).flat(), 3))
        return g
      })
      return mergeGeometries(parts)
    })(),
  )
  const crownMat = keep(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }))

  // Equatorial forest where the city thins out (Angondjé, Cap Estérias).
  function buildTree(n) {
    const h = 7 + hash(n + 7) * 6
    const r = 2.6 + hash(n + 3) * 1.4
    const trunk = new THREE.Mesh(trunkGeo, lambert('#4a3222'))
    trunk.scale.set(1, h * 0.65, 1)
    const crown = new THREE.Mesh(crownGeo, crownMat)
    crown.scale.setScalar(r)
    crown.position.y = h
    crown.rotation.y = hash(n) * Math.PI
    return group(trunk, crown)
  }

  const palmTrunkGeo = keep(new THREE.CylinderGeometry(0.1, 0.16, 1, 6).translate(0, 0.5, 0))
  const frondGeo = keep(
    (() => {
      const parts = []
      for (let i = 0; i < 7; i++) {
        const g = new THREE.PlaneGeometry(2.6, 0.55, 6, 1)
        g.rotateX(-Math.PI / 2)
        g.translate(1.3, 0, 0)
        const p = g.attributes.position
        for (let v = 0; v < p.count; v++) {
          const x = p.getX(v)
          p.setY(v, 0.45 * x - 0.3 * x * x)
          p.setZ(v, p.getZ(v) * (1 - (0.7 * x) / 2.6))
        }
        g.rotateY((i / 7) * Math.PI * 2 + 0.3)
        g.computeVertexNormals()
        parts.push(g)
      }
      return mergeGeometries(parts)
    })(),
  )
  const frondMat = keep(new THREE.MeshLambertMaterial({ color: '#1f7a55', side: THREE.DoubleSide, flatShading: true }))

  function buildPalm(k) {
    const h = 6.5 + hash(k) * 2
    const lean = (hash(k + 3) - 0.5) * 1.2
    const trunk = new THREE.Mesh(palmTrunkGeo, lambert('#6b4a32'))
    trunk.scale.set(1, h, 1)
    const crown = new THREE.Mesh(frondGeo, frondMat)
    crown.position.y = h
    crown.rotation.y = hash(k + 9) * Math.PI
    const tilt = group(trunk, crown)
    tilt.rotation.z = -Math.atan2(lean, h)
    const g = group(tilt)
    g.userData.crown = crown
    return g
  }

  function buildLamp() {
    const dark = lambert('#2b2236')
    const head = cube(0.4, 0.12, 0.25, basic('#ffe9b0'), -0.9, 5.45)
    const halo = glow('#ffdc96', 2.2, 0.8)
    halo.position.set(-0.9, 5.4, 0)
    return group(pole(0.06, 5.6, dark), cube(0.95, 0.09, 0.09, dark, -0.45, 5.55), head, halo)
  }

  // A post and a painted panel.
  function signPost({ key, draw, texW = 512, texH = 160, postX, postH, panelX, panelW, panelY0, panelY1, color }) {
    const mat = panelMat(key, texW, texH, draw)
    const back = lambert(color)
    const board = new THREE.Mesh(boxGeo, [back, back, back, back, mat, back])
    board.scale.set(panelW, panelY1 - panelY0, 0.08)
    board.position.set(panelX, (panelY0 + panelY1) / 2, 0)
    return group(pole(0.06, postH, lambert('#52525b'), postX), board)
  }

  const drawSignText = (text, bg, border) => (ctx, w, h) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = border
    ctx.lineWidth = h * 0.05
    ctx.strokeRect(w * 0.03, h * 0.1, w * 0.94, h * 0.8)
    fitText(ctx, text, 700, h * 0.42, w * 0.86)
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, w / 2, h / 2)
  }

  // Green direction sign on the right sidewalk, like Libreville's own.
  const buildDirectionSign = (text) =>
    signPost({
      key: `dir|${text}`,
      draw: drawSignText(text, '#0f7a4a', '#f8fafc'),
      postX: ROAD_HALF + 0.7,
      postH: 4.1,
      panelX: ROAD_HALF - 0.2,
      panelW: 4,
      panelY0: 2.9,
      panelY1: 4.1,
      color: '#0f7a4a',
    })

  // Brown tourist sign for a public landmark.
  const buildLandmarkSign = (text) =>
    signPost({
      key: `lm|${text}`,
      draw: drawSignText(text, '#7c4a1e', '#fef3c7'),
      postX: -ROAD_HALF - 0.8,
      postH: 3.3,
      panelX: -ROAD_HALF - 1.4,
      panelW: 3.8,
      panelY0: 2.3,
      panelY1: 3.3,
      color: '#7c4a1e',
    })

  // "Bienvenue à …" gantry across the road where a new district starts.
  function buildArch(name) {
    const span = ROAD_HALF + 1.1
    const pillar = lambert('#3b1d4f')
    const face = panelMat(`arch|${name}`, 1024, 150, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, 0)
      g.addColorStop(0, '#8b5cf6')
      g.addColorStop(1, '#ec4899')
      ctx.fillStyle = '#5b1f6e'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = g
      ctx.fillRect(w * 0.01, h * 0.06, w * 0.98, h * 0.88)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.font = `700 ${h * 0.22}px system-ui, sans-serif`
      ctx.fillText('BIENVENUE À', w / 2, h * 0.3)
      fitText(ctx, name.toUpperCase(), 900, h * 0.42, w * 0.9)
      ctx.fillStyle = '#fff'
      ctx.fillText(name.toUpperCase(), w / 2, h * 0.68)
    })
    const beamSide = lambert('#5b1f6e')
    const beam = new THREE.Mesh(boxGeo, [beamSide, beamSide, beamSide, beamSide, face, face])
    beam.scale.set(span * 2 + 0.26, 1.15, 0.3)
    beam.position.y = 4.1 + 0.575
    return group(cube(0.26, 5.25, 0.26, pillar, -span), cube(0.26, 5.25, 0.26, pillar, span), beam)
  }

  // Coins Chics billboard on the seafront promenade, with the venue's photo
  // once it has loaded (when its server allows it in WebGL).
  function billboardMaterial(b) {
    const key = `bb|${b.name}|${b.category}|${b.image}`
    let m = panelMats.get(key)
    if (m) return m
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 310
    const ctx = c.getContext('2d')
    const draw = (img) => {
      const { width: w, height: h } = c
      ctx.fillStyle = '#ec4899'
      ctx.fillRect(0, 0, w, h)
      const pad = h * 0.05
      ctx.fillStyle = '#1f1030'
      ctx.fillRect(pad, pad, w - pad * 2, h - pad * 2)
      const side = h - pad * 4
      if (img) {
        const sq = Math.min(img.naturalWidth, img.naturalHeight)
        ctx.drawImage(img, (img.naturalWidth - sq) / 2, (img.naturalHeight - sq) / 2, sq, sq, pad * 2, pad * 2, side, side)
      } else {
        ctx.fillStyle = '#3b1d4f'
        ctx.fillRect(pad * 2, pad * 2, side, side)
        ctx.font = `${side * 0.55}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(VENUE_EMOJI[b.category] || '✨', pad * 2 + side / 2, pad * 2 + side / 2)
      }
      const tx = pad * 3 + side
      const tw = w - pad * 2 - tx
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#f9a8d4'
      fitText(ctx, 'COINS CHICS ✨', 800, h * 0.12, tw)
      ctx.fillText('COINS CHICS ✨', tx, h * 0.24)
      ctx.fillStyle = '#fff'
      fitText(ctx, b.name, 900, h * 0.2, tw)
      ctx.fillText(b.name, tx, h * 0.5)
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      const cat = `${VENUE_EMOJI[b.category] || ''} ${b.category}`.trim()
      fitText(ctx, cat, 600, h * 0.13, tw)
      ctx.fillText(cat, tx, h * 0.76)
    }
    draw(null)
    const tex = keep(new THREE.CanvasTexture(c))
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = aniso
    m = keep(new THREE.MeshBasicMaterial({ map: tex }))
    panelMats.set(key, m)
    if (b.image) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (disposed) return
        draw(img)
        tex.needsUpdate = true
      }
      img.src = b.image
    }
    return m
  }

  function buildBillboard(b) {
    const post = lambert('#3f3f46')
    const frame = lambert('#ec4899')
    const board = new THREE.Mesh(boxGeo, [frame, frame, frame, frame, billboardMaterial(b), frame])
    board.scale.set(3.4, 2.05, 0.12)
    board.position.y = 2.25 + 1.025
    return group(pole(0.06, 2.4, post, -1.3), pole(0.06, 2.4, post, 1.3), board)
  }

  // A vendor's stall: the picture from the 2D game, and a little board
  // saying what it sells.
  function buildStall(stall) {
    const s = roadside[stall.sprite]
    const picture = new THREE.Mesh(s.geo, s.mat)
    picture.position.set(-0.3, 0, -0.4)
    const sign = new THREE.Mesh(
      planeGeo,
      panelMat(`stall|${stall.label}`, 256, 86, (ctx, w, h) => {
        ctx.fillStyle = '#fef3c7'
        ctx.fillRect(0, 0, w, h)
        fitText(ctx, stall.label, 800, h * 0.5, w * 0.9)
        ctx.fillStyle = '#7c2d12'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(stall.label, w / 2, h / 2)
      }),
    )
    sign.scale.set(1.5, 0.5, 1)
    sign.position.set(0.75, 0.8, 0.2)
    const g = group(picture, pole(0.04, 0.7, lambert('#5b3a1e'), 0.75, 0, 0.18), sign)
    g.userData.picture = picture
    return g
  }

  function buildPasserby(p) {
    const s = roadside[p.sprite]
    const picture = new THREE.Mesh(s.geo, s.mat)
    const g = group(picture)
    g.userData.picture = picture
    return g
  }

  const buildMonument = (m) => group(new THREE.Mesh(m.geo, m.mat))

  // Stade de l'Amitié: a long stand along the road, with floodlights.
  function buildStadium() {
    const facade = panelMat('stadium', 1024, 324, (ctx, w, h) => {
      ctx.fillStyle = '#d6d3d1'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#3f3f46'
      for (let i = 0; i < 10; i++) {
        const x = (w / 10) * i + w * 0.02
        ctx.beginPath()
        ctx.moveTo(x, h)
        ctx.lineTo(x, h * 0.72)
        ctx.arc(x + w * 0.03, h * 0.72, w * 0.03, Math.PI, 0)
        ctx.lineTo(x + w * 0.06, h)
        ctx.fill()
      }
      ctx.fillStyle = '#f5f5f4'
      ctx.fillRect(0, 0, w, h * 0.06)
      fitText(ctx, "STADE DE L'AMITIÉ", 900, h * 0.2, w * 0.9)
      ctx.fillStyle = '#7c3aed'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText("STADE DE L'AMITIÉ", w / 2, h * 0.33)
    })
    const wall = lambert('#bdb8b4')
    const body = new THREE.Mesh(boxGeo, [wall, facade, lambert('#f5f5f4'), wall, wall, wall])
    body.scale.set(12, 9.5, 30)
    body.position.set(6, 4.75, 0)
    const g = group(body)
    for (const z of [-14, 14]) {
      g.add(pole(0.12, 7, lambert('#52525b'), 2, 9.5, z))
      g.add(cube(1.2, 0.5, 0.3, basic('#fef9c3'), 2, 16.5, z))
      const halo = glow('#fef9c3', 5, 0.7)
      halo.position.set(2, 16.8, z)
      g.add(halo)
    }
    return g
  }

  // Pirogues and small sailing boats moored off Port-Môle.
  const sailGeo = keep(
    new THREE.ShapeGeometry(
      new THREE.Shape([new THREE.Vector2(0, 0.8), new THREE.Vector2(0, 3.8), new THREE.Vector2(1.3, 0.8)]),
    ),
  )
  const sailMat = keep(new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide }))
  function buildBoat(k) {
    const g = group(cube(3.2, 0.5, 1.1, lambert(k % 2 ? '#f8fafc' : '#b45309')))
    if (k % 2) {
      g.add(pole(0.04, 3.8, lambert('#e5e7eb')))
      const sail = new THREE.Mesh(sailGeo, sailMat)
      sail.position.y = 0.1
      g.add(sail)
    }
    return g
  }

  // Container cranes of the Port d'Owendo, out over the water.
  function buildCrane(k) {
    const steel = lambert(k % 2 ? '#dc2626' : '#2563eb')
    const leg = (dx) => {
      const len = Math.hypot(1.5, 22)
      const m = cube(0.3, len, 0.3, steel)
      m.position.set(dx / 2, 11, 0)
      m.rotation.z = Math.atan2(dx, 22)
      return m
    }
    const g = group(leg(-1.5), leg(1.5), cube(14, 0.35, 0.35, steel, 2, 20.8))
    const colors = ['#f97316', '#0ea5e9', '#22c55e', '#e11d48']
    for (let i = 0; i < 3; i++) g.add(cube(2.5, 2.6 + (i % 2) * 2.6, 2.4, lambert(colors[(k + i) % colors.length]), 3.5 + i * 2.7, 0, -2))
    return g
  }

  // ---- Obstacles, coins, power-ups ------------------------------------------------
  const textMat = (key, text, bg, fg, w = 256, h = 96) =>
    panelMat(key, w, h, (ctx) => {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)
      fitText(ctx, text, 800, h * 0.55, w * 0.9)
      ctx.fillStyle = fg
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, w / 2, h / 2)
    })
  const stripesMat = (key, a, b, n, w = 256, h = 64) =>
    panelMat(key, w, h, (ctx) => {
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i % 2 ? b : a
        ctx.fillRect((w / n) * i, 0, w / n + 1, h)
      }
    })
  const decal = (color) =>
    keep(new THREE.MeshLambertMaterial({ color, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }))
  const holeMat = decal('#120a18')
  const holeEdgeMat = decal('#f97316')
  const coneGeo = keep(new THREE.ConeGeometry(0.22, 0.75, 12))

  // Each obstacle's group spans its length from z = 0 (its near end) to
  // -len, like the engine's o.z … o.z + len.
  function buildObstacle(o) {
    if (o.type === 'barrier') {
      const post = lambert('#d4d4d8')
      const stripes = stripesMat('barrier', '#e11d48', '#f8fafc', 5)
      const white = lambert('#f8fafc')
      const bar = new THREE.Mesh(boxGeo, [white, white, white, white, stripes, stripes])
      bar.scale.set(1.6, 0.45, 0.08)
      bar.position.set(0, 0.775, -0.3)
      return group(cube(0.1, 0.95, 0.1, post, -0.65, 0, -0.3), cube(0.1, 0.95, 0.1, post, 0.65, 0, -0.3), bar)
    }
    if (o.type === 'cone') {
      const g = group()
      for (const dx of [-0.45, 0.45]) {
        const c = new THREE.Mesh(coneGeo, lambert('#f97316'))
        c.position.set(dx, 0.375, -0.25)
        const band = pole(0.13, 0.1, lambert('#fff7ed'), dx, 0.38, -0.25)
        g.add(c, band)
      }
      return g
    }
    if (o.type === 'hole') {
      const flat = (w, d, mat, z) => {
        const m = new THREE.Mesh(planeGeo, mat)
        m.rotation.x = -Math.PI / 2
        m.scale.set(w, d, 1)
        m.position.set(0, 0.01, z)
        return m
      }
      return group(flat(1.5, 1.2, holeMat, -0.6), flat(1.64, 0.14, holeEdgeMat, 0.07), flat(1.64, 0.14, holeEdgeMat, -1.27))
    }
    if (o.type === 'sign') {
      const post = lambert('#3f3f46')
      const pink = lambert('#e9467d')
      const face = textMat('sign|boma', 'BOMA ↓', '#e9467d', '#ffffff')
      const banner = new THREE.Mesh(boxGeo, [pink, pink, pink, pink, face, face])
      banner.scale.set(1.7, 0.9, 0.08)
      banner.position.set(0, 1.65, -0.3)
      return group(cube(0.1, 2.2, 0.1, post, -0.82, 0, -0.3), cube(0.1, 2.2, 0.1, post, 0.82, 0, -0.3), banner)
    }
    if (o.type === 'car' && !isTaxi(o) && traffic) {
      const car = trafficCarFor(o)
      const picture = traffic[TRAFFIC_CARS.indexOf(car)]
      const back = new THREE.Mesh(picture.geo, picture.mat)
      back.position.z = 0.02
      const height = picture.geo.parameters.height
      return group(back, cube(picture.w * 0.82, height * 0.62, 4.0, lambert(car.color), 0, height * 0.12, -2.02))
    }
    if (o.type === 'car') {
      const taxi = isTaxi(o)
      const color = taxi ? TAXI.lower : CAR_COLORS[1 + (o.id % (CAR_COLORS.length - 1))]
      const top = taxi ? TAXI.upper : color
      const glass = lambert('#1e1e32')
      const len = 4.2
      const body = cube(1.5, 0.62, len, lambert(color), 0, 0.22, -len / 2)
      const cabin = new THREE.Mesh(boxGeo, [glass, glass, lambert(top), glass, glass, glass])
      cabin.scale.set(1.3, 0.55, 2.2)
      cabin.position.set(0, 0.84 + 0.275, -len / 2 - 0.2)
      const g = group(body, cabin)
      if (taxi) {
        // Red upper half: a band along the body under the windows.
        g.add(cube(1.52, 0.2, len + 0.02, lambert(TAXI.upper), 0, 0.64, -len / 2))
        const sign = new THREE.Mesh(boxGeo, [glass, glass, glass, glass, textMat('taxi', 'TAXI', '#111111', '#facc15', 192, 64), glass])
        sign.scale.set(0.5, 0.22, 0.25)
        sign.position.set(0, 1.5, -len / 2 - 0.2)
        g.add(sign)
      }
      const light = basic('#ef4444')
      g.add(cube(0.28, 0.1, 0.04, light, -0.55, 0.62, 0.01), cube(0.28, 0.1, 0.04, light, 0.55, 0.62, 0.01))
      const tyre = lambert('#111111')
      for (const z of [-0.8, -len + 0.8]) for (const x of [-0.7, 0.7]) g.add(cube(0.22, 0.42, 0.62, tyre, x, 0, z))
      return g
    }
    if (o.type === 'bus') {
      // MOTO BOMA's city bus: 11 m long, green and white.
      const len = 11
      const g = group(
        cube(1.75, 2.75, len, lambert('#0f766e'), 0, 0.3, -len / 2),
        cube(1.77, 0.28, len + 0.02, lambert('#f8fafc'), 0, 1.45, -len / 2),
        cube(1.5, 0.95, 0.04, lambert('#141824'), 0, 1.85, 0.01),
        new THREE.Mesh(planeGeo, textMat('bus|label', 'BUS', '#0f766e', '#facc15', 192, 64)),
      )
      const label = g.children[3]
      label.scale.set(0.7, 0.24, 1)
      label.position.set(0, 2.9, 0.03)
      const light = basic('#ef4444')
      g.add(cube(0.24, 0.16, 0.04, light, -0.68, 0.95, 0.01), cube(0.24, 0.16, 0.04, light, 0.68, 0.95, 0.01))
      const tyre = lambert('#111111')
      for (const z of [-1.4, -len + 2]) for (const x of [-0.8, 0.8]) g.add(cube(0.24, 0.6, 0.9, tyre, x, 0, z))
      return g
    }
    if (o.type === 'works') {
      const orange = lambert('#c2410c')
      const stripes = stripesMat('works', '#f97316', '#fff7ed', 8)
      const body = new THREE.Mesh(boxGeo, [stripes, stripes, orange, orange, stripes, orange])
      body.scale.set(1.6, 1.4, 2.2)
      body.position.set(0, 0.7, -1.1)
      const plate = new THREE.Mesh(planeGeo, textMat('works|plate', 'TRAVAUX', '#facc15', '#111111'))
      plate.scale.set(1.2, 0.5, 1)
      plate.position.set(0, 1.75, -0.1)
      return group(body, plate)
    }
    return group()
  }

  const capTex = (gold) =>
    keep(
      paint(128, 128, (ctx, w) => {
        ctx.fillStyle = gold ? '#ffd23f' : '#f2bf4e'
        ctx.fillRect(0, 0, w, w)
        ctx.strokeStyle = '#c98a12'
        ctx.lineWidth = 10
        ctx.beginPath()
        ctx.arc(w / 2, w / 2, w / 2 - 8, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = '#7a4b00'
        ctx.font = '900 70px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('N', w / 2, w / 2 + 4)
      }),
    )
  const coinGeo = keep(new THREE.CylinderGeometry(1, 1, 0.25, 28).rotateX(Math.PI / 2))
  const coinMats = [false, true].map((gold) => {
    const cap = keep(new THREE.MeshLambertMaterial({ map: capTex(gold), emissive: '#ffffff', emissiveMap: capTex(gold), emissiveIntensity: 0.45 }))
    return [lambert('#c98a12'), cap, cap]
  })
  function buildCoin(c) {
    const coin = new THREE.Mesh(coinGeo, coinMats[c.gold ? 1 : 0])
    coin.scale.setScalar(c.gold ? 0.36 : 0.27)
    const g = group(coin)
    if (c.gold) g.add(glow('#ffd75a', 1.8, 0.6))
    g.userData.spin = coin
    return g
  }

  const orbGeo = keep(new THREE.SphereGeometry(0.42, 20, 14))
  const ringGeo = keep(new THREE.TorusGeometry(0.44, 0.05, 6, 32))
  const iconMats = new Map()
  function powerupIcon(type) {
    let m = iconMats.get(type)
    if (!m) {
      const style = POWERUP_STYLE[type]
      const map = painting(`pu|${type}`, 128, 128, (ctx, w) => {
        ctx.font = '900 76px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = style.color
        ctx.fillText(style.icon, w / 2, w / 2 + 4)
      })
      iconMats.set(type, (m = keep(new THREE.SpriteMaterial({ map, depthTest: false }))))
    }
    return m
  }
  function buildPowerup(p) {
    const style = POWERUP_STYLE[p.type]
    const orb = new THREE.Mesh(orbGeo, basic('#f8fafc'))
    const ring = new THREE.Mesh(ringGeo, basic(style.color))
    const icon = new THREE.Sprite(powerupIcon(p.type))
    icon.scale.set(0.6, 0.6, 1)
    icon.renderOrder = 4
    return group(glow(style.color, 2), orb, ring, icon)
  }

  // ---- Popups ("+1", "Bouclier !") ---------------------------------------------
  const popups = []
  function popup(text, color, laneVis, size = 26) {
    const measure = document.createElement('canvas').getContext('2d')
    measure.font = '900 64px system-ui, sans-serif'
    const tw = Math.ceil(measure.measureText(text).width) + 24
    const tex = paint(tw, 88, (ctx, w, h) => {
      ctx.font = '900 64px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = 8
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      ctx.strokeText(text, w / 2, h / 2)
      ctx.fillStyle = color
      ctx.fillText(text, w / 2, h / 2)
    })
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, fog: false })
    const s = new THREE.Sprite(mat)
    const k = (size / 26) * 0.5
    s.scale.set((k * tw) / 88, k, 1)
    s.renderOrder = 20
    s.position.set((laneVis - 1) * LANE_W, 2.2, RUNNER_Z)
    scene.add(s)
    popups.push({ s, born: performance.now() })
  }
  function updatePopups(now) {
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i]
      const age = (now - p.born) / 900
      if (age >= 1) {
        scene.remove(p.s)
        p.s.material.map.dispose()
        p.s.material.dispose()
        popups.splice(i, 1)
        continue
      }
      p.s.material.opacity = 1 - age
      p.s.position.y = 2.2 + age * 0.8
    }
  }

  // ---- Every frame --------------------------------------------------------------
  let shakeUntil = 0
  let flashUntil = 0

  function updateHorizons(metres) {
    const current = horizonAt(metres)
    const entry = [...DISTRICTS].reverse().find(([from]) => metres >= from)
    const since = metres - (entry ? entry[0] : 0)
    const previous = entry && entry[0] > 0 ? horizonAt(entry[0] - 1) : current
    const t = previous !== current && since < HORIZON_FADE_M ? since / HORIZON_FADE_M : 1
    horizons.forEach(({ mat, group: g }, i) => {
      const a = i === current ? t : i === previous ? 1 - t : 0
      mat.opacity = a
      g.visible = a > 0 && !!g.userData.ready
    })
  }

  function updateSky(dist, time) {
    for (const c of clouds) {
      const span = 900
      c.position.set(((c.userData.x0 * span + time * c.userData.speed) % span) - span / 2, c.userData.y, -SKY_R * 0.88)
    }
    // Pointe Denis fades out after the Bord de mer.
    pointeDenis.visible = dist < 150000
    pointeDenis.material.opacity = Math.min(1, (150000 - dist) / 50000)
    const progress = (dist - (airportZ - 40000)) / 80000
    plane.visible = progress >= 0 && progress <= 1
    if (plane.visible) {
      plane.position.set(220 - progress * 420, 45 + progress * 70, -SKY_R * 0.75)
      plane.scale.setScalar(1 + progress)
      plane.userData.blink.visible = Math.sin(time * 8) > 0.6
    }
  }

  function updateScenery(dist, time) {
    const first = Math.floor((dist - camBackCm) / 1500)
    const last = Math.floor((dist + VIEW_CM) / 1500)
    for (let k = first; k <= last; k++) {
      const z0 = k * 1500
      if (z0 + 1500 > stadiumZ - 600 && z0 < stadiumZ + 3600) continue // the stadium stands here
      if (monuments && LANDMARKS.some((l) => l.visual === 'monument' && z0 + 1500 > l.at * 100 - 600 && z0 < l.at * 100 + monuments[l.monument].lengthCm)) continue
      if (FOREST_DISTRICTS.includes(districtAt(Math.floor(z0 / 100)))) {
        for (let j = 0; j < 3; j++) {
          const n = k * 3 + j
          const zr = k * 1500 + 100 + j * 500 - dist
          if (inView(zr)) place(`tree${n}`, () => buildTree(n), zr, ROAD_HALF + 3.5 + hash(n) * 7)
        }
      } else {
        const zr0 = k * 1500 + 100 - dist
        if (inView(zr0, zr0 + 1200)) place(`bld${k}`, () => buildBuilding(k), zr0 + 600, ROAD_HALF + 4.2)
      }
    }
    if (inView(stadiumZ - dist, stadiumZ + 3000 - dist)) place('stadium', buildStadium, stadiumZ + 1500 - dist, ROAD_HALF + 5.2)

    for (let k = Math.floor((dist - camBackCm) / 1100); k * 1100 < dist + VIEW_CM; k++) {
      const zr = k * 1100 + 300 - dist
      if (!inView(zr)) continue
      const palm = place(`palm${k}`, () => buildPalm(k), zr, -ROAD_HALF - 2.2)
      palm.userData.crown.rotation.z = Math.sin(time * 1.4 + k) * 0.06
    }
    for (let k = Math.floor((dist - camBackCm) / 1400); k * 1400 < dist + VIEW_CM; k++) {
      const zr = k * 1400 + 700 - dist
      if (inView(zr)) place(`lamp${k}`, buildLamp, zr, ROAD_HALF + 1.1)
    }
    LANDMARKS.forEach((l, i) => {
      const z = l.at * 100
      if (inView(z - dist)) place(`lm${i}`, () => buildLandmarkSign(l.text), z - dist)
      if (l.visual === 'boats') {
        for (let k = 0; k < 5; k++) {
          const zr = z - 2500 + k * 1300 - dist
          if (!inView(zr)) continue
          const boat = place(`boat${i}-${k}`, () => buildBoat(k), zr, -ROAD_HALF - 7 - hash(k) * 9, Math.sin(time * 1.5 + k) * 0.08)
          boat.rotation.z = Math.sin(time * 1.2 + k) * 0.04
        }
      }
      if (l.visual === 'cranes') {
        for (let k = 0; k < 3; k++) {
          const zr = z + 800 + k * 1800 - dist
          if (inView(zr)) place(`crane${i}-${k}`, () => buildCrane(k), zr, -ROAD_HALF - 9 - k * 5)
        }
      }
      if (l.visual === 'monument' && monuments) {
        const m = monuments[l.monument]
        const zr = z + m.lengthCm * 0.4 - dist
        if (inView(zr)) {
          faceCamera(place(`mon${i}`, () => buildMonument(m), zr, ROAD_HALF + 4.2 + m.w * 0.35))
        }
      }
    })
    for (const b of billboards) {
      const zr = b.at * 100 - dist
      if (inView(zr)) place(`bb${b.at}|${b.name}`, () => buildBillboard(b), zr, -ROAD_HALF - 1.9)
    }
    if (roadside) {
      const stallStep = STALL_EVERY * 100
      for (let k = Math.max(0, Math.floor((dist - camBackCm) / stallStep)); k * stallStep < dist + VIEW_CM; k++) {
        const stall = stallFor(k, billboards)
        if (stall && inView(stall.at * 100 - dist)) {
          const o = place(`stall${k}|${stall.at}`, () => buildStall(stall), stall.at * 100 + 40 - dist, -ROAD_HALF - 1.5)
          o.userData.picture.rotation.y = Math.atan2(camera.position.x - o.position.x, camera.position.z - o.position.z)
        }
        const p = passerbyFor(k, billboards)
        if (p && inView(p.at * 100 - dist)) {
          const bob = p.kind === 'mama' ? 0 : Math.abs(Math.sin(time * (p.kind === 'football' ? 7 : 4.5) + k)) * 0.06
          const o = place(`pb${k}|${p.at}`, () => buildPasserby(p), p.at * 100 - dist, -ROAD_HALF - 1.1, bob)
          faceCamera(o)
        }
      }
    }
    // A direction sign every ~650 m, kept away from the district arches.
    for (let k = Math.max(0, Math.floor((dist - camBackCm - 40000) / 65000)); k * 65000 + 40000 < dist + VIEW_CM; k++) {
      const z = k * 65000 + 40000
      if (DISTRICTS.some(([from]) => Math.abs(from * 100 - z) < 15000) || !inView(z - dist)) continue
      const text = DIRECTION_SIGNS[k % DIRECTION_SIGNS.length]
      place(`dir${k}`, () => buildDirectionSign(text), z - dist)
    }
    DISTRICTS.forEach(([from, name], i) => {
      if (from > 0 && inView(from * 100 - dist)) place(`arch${i}`, () => buildArch(name), from * 100 - dist)
    })
  }

  const laneX = (lane) => (lane - 1) * LANE_W

  function updateItems(state, view) {
    const { dist, time } = view
    for (const o of state.obstacles) {
      const zr = o.z - dist
      if (!inView(zr, zr + (o.type === 'bus' ? 1100 : 420))) continue
      const obj = place(`o${o.id}`, () => buildObstacle(o), zr, laneX(o.lane))
      obj.visible = !o.hit
    }
    for (const c of state.coinsOnRoad) {
      const zr = c.z - dist
      if (c.taken || !inView(zr)) continue
      const obj = place(`c${c.id}`, () => buildCoin(c), zr, laneX(c.lane), 0.6 + Math.sin(time * 4 + c.id) * 0.08)
      obj.userData.spin.rotation.y = time * 3.5 + c.id
    }
    for (const p of state.powerups) {
      const zr = p.z - dist
      if (p.taken || !inView(zr)) continue
      const obj = place(`p${p.id}`, () => buildPowerup(p), zr, laneX(p.lane), 0.75 + Math.sin(time * 3 + p.id) * 0.1)
      obj.rotation.y = Math.sin(time * 2 + p.id) * 0.4
    }
  }

  function updateRunner(state, view) {
    const x = (view.laneVis - 1) * LANE_W
    const jumpT = state.jump ? Math.min(1, (state.jump + view.alpha) / JUMP_TICKS) : 0
    const y = state.jump ? 4 * 1.3 * jumpT * (1 - jumpT) : 0
    const sliding = state.slide > 0 && state.slide < SLIDE_TICKS
    runnerGroup.position.set(x, 0, RUNNER_Z)
    // On the motorbike its picture replaces the runner, leaning into lane changes.
    const riding = !!(state.moto || state.riding) && motoLoaded
    motoSprite.visible = riding
    runnerSprite.visible = sheetLoaded && !riding
    runnerFallback.visible = !sheetLoaded && !riding
    if (riding) {
      motoSprite.position.y = y
      motoSprite.quaternion.copy(camera.quaternion)
      motoSprite.rotateZ(motoTilt({ ...view, laneTarget: state.lane }))
    }
    runnerSprite.position.y = y
    runnerFallback.position.y = y
    runnerFallback.scale.y = sliding ? 0.5 : 1
    runnerFallback.rotation.z = view.crashT > 0 ? Math.min(1, view.crashT * 2.5) * 1.2 : 0
    runnerSprite.quaternion.copy(camera.quaternion)

    let frame
    if (view.crashT > 0) frame = 11
    else if (sliding) frame = 10
    else if (state.jump) frame = jumpT < 0.22 || jumpT > 0.9 ? 8 : 9
    else frame = Math.floor(view.time * (8 + state.speed / 2.5)) % 8 // faster stride as speed grows
    const index = runnerRow * 4 + frame
    sheetTex.offset.set((index % 4) / 4, 1 - (Math.floor(index / 4) + 1) / 6)

    const air = Math.min(1, y / 2.6)
    shadow.scale.set(1.1 * (1 - air * 0.5), 0.45 * (1 - air * 0.5), 1)
    shadow.material.opacity = 0.5 * (1 - air)

    shieldBubble.visible = !!(state.shield || state.grace)
    shieldBubble.position.y = 0.95 + y
    shieldBubble.material.opacity = state.grace ? 0.15 + 0.15 * Math.sin(view.time * 30) : 0.25
    magnetRing.visible = !!state.magnet
    magnetRing.position.y = 0.9 + y
    magnetRing.rotation.y = view.time * 2
    magnetRing.material.opacity = 0.45 + 0.3 * Math.sin(view.time * 8)
    boostGlow.visible = !!state.boost
    boostGlow.position.y = 0.9 + y
    timesTwo.visible = !!state.multiplier
    timesTwo.position.y = (sliding ? 1.5 : 2.2) + y
  }

  function updateMotes(view) {
    const positions = moteGeo.attributes.position
    const dt = Math.min(view.dt, 0.05)
    for (let i = 0; i < MOTE_COUNT; i++) {
      const j = i * 3
      motePositions[j] += moteVelocities[j] * dt
      motePositions[j + 1] += moteVelocities[j + 1] * dt
      motePositions[j + 2] += moteVelocities[j + 2] * dt
      if (motePositions[j + 2] > 4 || motePositions[j + 1] > 8) {
        motePositions[j] = (hash(i * 11 + Math.floor(view.time)) - 0.5) * 34
        motePositions[j + 1] = -1
        motePositions[j + 2] = -42 - hash(i * 13 + Math.floor(view.time)) * 9
      }
    }
    positions.needsUpdate = true
    motes.position.copy(camera.position)
  }

  function updateOverlay(state, view, now) {
    flash.material.opacity = now < flashUntil ? ((flashUntil - now) / 250) * 0.8 : 0
    vignette.material.opacity = view.crashT > 0 ? Math.min(0.5, view.crashT) : 0
    const night = THREE.MathUtils.smoothstep(view.dist, 30000, 180000)
    nightWash.material.opacity = night * 0.085
    sky.material.color.copy(daySkyTint).lerp(nightSkyTint, night * 0.72)
    scene.fog.color.copy(sunsetFog).lerp(nightFog, night * 0.7)
    motes.material.opacity = 0.28 + night * 0.3
    sunLight.intensity = 2.8 - night * 1.3
    fillLight.intensity = 1.1 + night * 0.45
    const intensity = Math.min(1.5, state.moto ? 1.5 : state.boost ? 1.35 : Math.max(0, (state.speed - 24) / 10))
    speedLines.visible = intensity > 0
    if (!speedLines.visible) return
    speedLines.material.opacity = Math.min(0.42, 0.28 * intensity)
    // From the vanishing point of the road.
    const vp = new THREE.Vector3(camX, 0, -150).project(camera)
    const cx = (vp.x * W) / 2
    const cy = (vp.y * H) / 2
    const pos = speedGeo.attributes.position
    for (let i = 0; i < SPEED_LINES; i++) {
      const seed = Math.floor(view.time * 20) + i * 13
      const angle = hash(seed) * Math.PI * 2
      const r0 = Math.min(W, H) * (0.35 + hash(seed + 1) * 0.3)
      const r1 = r0 + 40 + hash(seed + 2) * 80
      pos.setXYZ(i * 2, cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0, 0)
      pos.setXYZ(i * 2 + 1, cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1, 0)
    }
    pos.needsUpdate = true
  }

  function triggerImpact(now) {
    const x = runnerGroup.position.x
    impactRing.position.set(x, 0.045, RUNNER_Z)
    impactRing.scale.setScalar(0.35)
    impactRing.material.opacity = 0.9
    impactRing.visible = true

    for (const particle of impactParticles) {
      particle.position.set(x + (Math.random() - 0.5) * 0.5, 0.45 + Math.random() * 1.1, RUNNER_Z - Math.random() * 0.8)
      particle.userData.vx = (Math.random() - 0.5) * 5
      particle.userData.vy = 2 + Math.random() * 5
      particle.userData.vz = -1 - Math.random() * 4
      particle.userData.born = now
      particle.visible = true
    }
  }

  function updateImpact(now, dt) {
    const age = (now - flashUntil + 250) / 700
    if (impactRing.visible) {
      const t = Math.max(0, Math.min(1, age))
      impactRing.scale.setScalar(0.35 + t * 2.2)
      impactRing.material.opacity = (1 - t) * 0.9
      if (t >= 1) impactRing.visible = false
    }
    for (const particle of impactParticles) {
      if (!particle.visible) continue
      const t = (now - particle.userData.born) / 650
      if (t >= 1) {
        particle.visible = false
        continue
      }
      const step = Math.min(dt, 0.05)
      particle.position.x += particle.userData.vx * step
      particle.position.y += particle.userData.vy * step
      particle.position.z += particle.userData.vz * step
      particle.userData.vy -= 9.8 * step
      particle.scale.setScalar(1 - t * 0.65)
      impactParticleMat.opacity = 1 - t
    }
  }

  function render(state, view) {
    if (disposed) return
    const now = performance.now()
    frameNo++
    const playerX = (view.laneVis - 1) * LANE_W
    camX += (playerX * 0.55 - camX) * Math.min(1, view.dt * 8)
    const instantLaneVelocity = view.dt > 0 ? (playerX - previousPlayerX) / view.dt : 0
    laneVelocity += (instantLaneVelocity - laneVelocity) * Math.min(1, view.dt * 10)
    previousPlayerX = playerX
    const laneBias = (playerX / (LANE_W * 1.5)) * 1.1
    let sx = 0
    let sy = 0
    if (now < shakeUntil) {
      const k = (shakeUntil - now) / 400
      sx = (Math.random() - 0.5) * 0.25 * k
      sy = (Math.random() - 0.5) * 0.25 * k
    }
    const targetX = camX + sx
    const targetY = camH + sy + Math.sin(view.time * 2.3) * 0.12 + (state.jump ? 0.18 : 0)
    const targetZ = RUNNER_Z + camBack + 0.25
    camera.position.x += (targetX - camera.position.x) * 0.24
    camera.position.y += (targetY - camera.position.y) * 0.22
    camera.position.z += (targetZ - camera.position.z) * 0.22
    const lookX = targetX * 0.82 + laneBias * 0.8
    const lookY = 0.78 + Math.sin(view.time * 1.6) * 0.08 + (state.jump ? 0.16 : 0)
    camera.lookAt(lookX, lookY, RUNNER_Z - 16)
    camera.rotation.z += THREE.MathUtils.clamp(-laneVelocity * 0.006, -0.035, 0.035)
    const targetFov = baseFov + (state.moto ? 8 : state.boost ? 5 : Math.min(2, Math.max(0, (state.speed - 25) * 0.18)))
    camera.fov += (targetFov - camera.fov) * Math.min(1, view.dt * 3)
    camera.updateProjectionMatrix()
    camBackCm = camBack * 100
    skyGroup.position.set(camera.position.x, 0, camera.position.z)

    stripTex.offset.y = (view.dist / 1000) % 1
    plazaTex.offset.y = stripTex.offset.y

    updateHorizons(view.dist / 100)
    updateSky(view.dist, view.time)
    updateMotes(view)
    updateScenery(view.dist, view.time)
    updateItems(state, view)
    updateRunner(state, view)
    updateGhost(state.ghost)
    updatePopups(now)
    updateImpact(now, view.dt)
    sweep()
    updateOverlay(state, view, now)

    gl.clear()
    gl.render(scene, camera)
    gl.clearDepth()
    gl.render(hud, hudCam)
  }

  function dispose() {
    if (disposed) return
    disposed = true
    for (const o of live.values()) release(o)
    live.clear()
    for (const p of popups) {
      p.s.material.map.dispose()
      p.s.material.dispose()
    }
    for (const r of owned) r.dispose()
    gl.dispose()
    gl.forceContextLoss()
    canvas.remove()
  }

  return {
    resize,
    render,
    dispose,
    setBillboards(list) {
      billboards = list || []
    },
    popup,
    crash() {
      const now = performance.now()
      shakeUntil = now + 400
      flashUntil = now + 250
      triggerImpact(now)
    },
  }
}
