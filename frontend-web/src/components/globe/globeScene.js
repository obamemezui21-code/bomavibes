import * as THREE from 'three'
import { LAND_COLS, LAND_MASK, LAND_ROWS, LAND_STEP } from '../../lib/globeLand.js'

// The 3D part of ActiveGlobe.jsx, in plain three.js: a dark globe whose land
// is made of glowing dots, a pink-violet halo, a pulsing ring and a beam on
// each active city, light running along arcs from your city to theirs. The
// city pins are the component's own HTML buttons, moved here every frame onto
// their city (hidden when it turns to the far side).

const DEG = Math.PI / 180
const AUTO_SPIN = 0.12 // rad/s
const PIN_LIFT = 1.13
const PITCH_MIN = -0.5
const PITCH_MAX = 0.9
// Where the globe opens when nobody, you included, has a known city.
const LIBREVILLE = [0.4087, 9.4419]

function toVector(lat, lng, radius = 1) {
  const phi = (90 - lat) * DEG
  const theta = (lng + 180) * DEG
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  )
}

// Yaw that brings a longitude in front of the camera (which looks down -z).
function yawFor(lng) {
  const v = toVector(0, lng)
  return -Math.atan2(v.x, v.z)
}

function landDots() {
  const bits = Uint8Array.from(atob(LAND_MASK), (c) => c.charCodeAt(0))
  const positions = []
  const colors = []
  const pink = new THREE.Color('#ff5fa2')
  const violet = new THREE.Color('#9d7bff')
  const gold = new THREE.Color('#ffd27a')
  const color = new THREE.Color()
  for (let r = 0; r < LAND_ROWS; r++) {
    const lat = 90 - (r + 0.5) * LAND_STEP
    // Fewer dots towards the poles, so they stay evenly spaced on the sphere.
    const every = Math.max(1, Math.round(1 / Math.max(Math.cos(lat * DEG), 0.05)))
    for (let c = 0; c < LAND_COLS; c += every) {
      const i = r * LAND_COLS + c
      if (!(bits[i >> 3] & (1 << (i & 7)))) continue
      const lng = -180 + (c + 0.5) * LAND_STEP
      const v = toVector(lat, lng, 1.008)
      positions.push(v.x, v.y, v.z)
      const t = (lng + 180) / 360
      color.copy(violet).lerp(pink, Math.sin(t * Math.PI * 2) * 0.5 + 0.5)
      if (Math.abs(lat) < 12) color.lerp(gold, 0.25) // a warm band around the equator
      colors.push(color.r, color.g, color.b)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return geometry
}

function dotTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.9)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(canvas)
}

// Night-blue sea, lit from the upper left, with a pink rim on the edge.
// Written in sRGB values straight to the screen (no colour management).
const globeMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      dark: { value: new THREE.Vector3(0.05, 0.02, 0.13) },
      lit: { value: new THREE.Vector3(0.2, 0.1, 0.42) },
      rim: { value: new THREE.Vector3(1.0, 0.37, 0.64) },
    },
    vertexShader: `varying vec3 vNormal;
      void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 dark; uniform vec3 lit; uniform vec3 rim; varying vec3 vNormal;
      void main() {
        float light = max(dot(vNormal, normalize(vec3(-0.5, 0.6, 0.9))), 0.0);
        float edge = pow(1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);
        vec3 color = mix(dark, lit, light);
        gl_FragColor = vec4(mix(color, rim, edge * 0.6), 1.0); }`,
  })

// A soft glow around the globe, fading out from its edge.
const haloMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: { glow: { value: new THREE.Vector3(0.66, 0.33, 0.97) } },
    vertexShader: `varying vec3 vNormal;
      void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 glow; varying vec3 vNormal;
      void main() { float f = pow(max(-dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 1.4);
        gl_FragColor = vec4(glow, f * 0.9); }`,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  })

// An arc lifted above the surface, with a light running along it.
function arc(from, to, phase) {
  const a = toVector(from[0], from[1])
  const b = toVector(to[0], to[1])
  const lift = 1.04 + Math.min(a.distanceTo(b), 2) * 0.45
  const mid = a.clone().add(b).normalize().multiplyScalar(lift)
  const curve = new THREE.QuadraticBezierCurve3(a.multiplyScalar(1.004), mid, b.multiplyScalar(1.004))
  const points = curve.getPoints(80)
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  geometry.setAttribute('along', new THREE.Float32BufferAttribute(points.map((_, i) => i / (points.length - 1)), 1))
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, phase: { value: phase }, color: { value: new THREE.Color('#ffd27a') } },
    vertexShader: `attribute float along; varying float vAlong;
      void main() { vAlong = along; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float time; uniform float phase; uniform vec3 color; varying float vAlong;
      void main() { float head = fract(time * 0.35 + phase);
        float d = head - vAlong;
        float trail = d >= 0.0 ? exp(-d * 9.0) : 0.0;
        gl_FragColor = vec4(color, 0.3 + trail * 0.7); }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  return new THREE.Line(geometry, material)
}

function cityMarker(lat, lng) {
  const marker = new THREE.Group()
  const normal = toVector(lat, lng).normalize()
  marker.position.copy(normal).multiplyScalar(1.004)
  marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.028, 0.038, 40),
    new THREE.MeshBasicMaterial({ color: '#ff5fa2', transparent: true, side: THREE.DoubleSide, depthWrite: false }),
  )
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.018, 24), new THREE.MeshBasicMaterial({ color: '#ffd27a' }))
  const beam = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, PIN_LIFT - 1.004)]),
    new THREE.LineBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.8 }),
  )
  marker.add(ring, core, beam)
  return { marker, ring }
}

export function createGlobeScene(container, { cities, groups, home, pins, reducedMotion }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.domElement.style.position = 'absolute'
  renderer.domElement.style.inset = '0'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.setAttribute('aria-hidden', 'true')
  container.prepend(renderer.domElement)

  let width = container.clientWidth
  let height = container.clientHeight
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
  camera.position.set(0, 0, 4.6)

  const pitchGroup = new THREE.Group()
  const globe = new THREE.Group()
  pitchGroup.add(globe)
  scene.add(pitchGroup)

  const disposables = []
  const keep = (...items) => (disposables.push(...items), items[0])

  const sphereGeometry = keep(new THREE.SphereGeometry(1, 64, 64))
  globe.add(new THREE.Mesh(sphereGeometry, keep(globeMaterial())))
  const halo = new THREE.Mesh(keep(new THREE.SphereGeometry(1.2, 64, 64)), keep(haloMaterial()))
  scene.add(halo)

  const dotsMaterial = keep(
    new THREE.PointsMaterial({ size: 0.03, map: keep(dotTexture()), vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.05 }),
  )
  globe.add(new THREE.Points(keep(landDots()), dotsMaterial))

  const markers = cities.map((g, i) => {
    const { marker, ring } = cityMarker(g.lat, g.lng)
    marker.traverse((o) => o.geometry && keep(o.geometry, o.material))
    globe.add(marker)
    return { ring, offset: i * 0.37 }
  })

  // Arcs from your city to each other active city (or, without yours, from the busiest one).
  const origin = home || (groups[0] ? [groups[0].lat, groups[0].lng] : LIBREVILLE)
  const arcs = cities
    .filter((g) => Math.abs(g.lat - origin[0]) + Math.abs(g.lng - origin[1]) > 0.5)
    .slice(0, 10)
    .map((g, i) => {
      const line = arc(origin, [g.lat, g.lng], i * 0.23)
      keep(line.geometry, line.material)
      globe.add(line)
      return line
    })

  // Start facing your city, or the busiest one.
  let yaw = yawFor(origin[1])
  let pitch = Math.min(Math.max(origin[0] * DEG, PITCH_MIN), PITCH_MAX)
  let target = null
  let velocity = 0
  let dragging = null
  let pausedUntil = 0

  function onDown(e) {
    dragging = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId }
    target = null
  }
  function onMove(e) {
    if (!dragging || dragging.id !== e.pointerId) return
    const dx = e.clientX - dragging.x
    const dy = e.clientY - dragging.y
    if (!dragging.moved && Math.abs(dx) + Math.abs(dy) < 4) return
    if (!dragging.moved) {
      dragging.moved = true
      container.setPointerCapture?.(e.pointerId)
    }
    dragging.x = e.clientX
    dragging.y = e.clientY
    velocity = dx * 0.006
    yaw += velocity
    // Vertical drags scroll the page on touch screens (touch-action: pan-y).
    if (e.pointerType !== 'touch') pitch = Math.min(Math.max(pitch + dy * 0.004, PITCH_MIN), PITCH_MAX)
  }
  function onUp(e) {
    if (dragging?.id !== e.pointerId) return
    dragging = null
    pausedUntil = performance.now() + 1500
  }
  container.addEventListener('pointerdown', onDown)
  container.addEventListener('pointermove', onMove)
  container.addEventListener('pointerup', onUp)
  container.addEventListener('pointercancel', onUp)

  function resize() {
    const { clientWidth: w, clientHeight: h } = container
    if (!w || !h) return
    width = w
    height = h
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // Keep the whole globe in view on narrow screens.
    camera.position.z = w / h < 1 ? 4.6 / (w / h) ** 0.55 : 4.6
    camera.updateProjectionMatrix()
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)
  resize()

  const pinVector = new THREE.Vector3()
  const normalVector = new THREE.Vector3()
  const toCamera = new THREE.Vector3()
  const pinPoints = groups.map((g) => ({
    key: g.key,
    lifted: toVector(g.lat, g.lng, PIN_LIFT),
    normal: toVector(g.lat, g.lng).normalize(),
    last: {},
  }))

  // Only what changed is written: a style change costs the page a recalc,
  // and this runs every frame.
  function setOnce(el, last, prop, value) {
    if (last[prop] === value) return
    last[prop] = value
    if (prop === 'tabIndex') el.tabIndex = value
    else el.style[prop] = value
  }

  function placePins() {
    for (const p of pinPoints) {
      const el = pins.get(p.key)
      if (!el) continue
      pinVector.copy(p.lifted).applyMatrix4(globe.matrixWorld)
      normalVector.copy(p.normal).transformDirection(globe.matrixWorld)
      toCamera.copy(camera.position).sub(pinVector).normalize()
      const facing = normalVector.dot(toCamera)
      const opacity = Math.round(Math.min(Math.max((facing - 0.05) / 0.3, 0), 1) * 20) / 20
      const shown = opacity > 0.5
      setOnce(el, p.last, 'opacity', String(opacity))
      setOnce(el, p.last, 'visibility', opacity > 0 ? 'visible' : 'hidden')
      setOnce(el, p.last, 'pointerEvents', shown ? 'auto' : 'none')
      setOnce(el, p.last, 'tabIndex', shown ? 0 : -1)
      setOnce(el, p.last, 'zIndex', String(Math.round(10 + facing * 10)))
      if (opacity === 0) continue
      pinVector.project(camera)
      const x = Math.round((pinVector.x * 0.5 + 0.5) * width * 2) / 2
      const y = Math.round((-pinVector.y * 0.5 + 0.5) * height * 2) / 2
      const scale = (0.75 + opacity * 0.25).toFixed(2)
      setOnce(el, p.last, 'transform', `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%) scale(${scale})`)
    }
  }

  let running = false
  let frame = 0
  let last = performance.now()
  const clock = { t: 0 }

  function tick(time) {
    const dt = Math.min((time - last) / 1000, 0.05)
    last = time
    clock.t += dt

    if (target) {
      // Shortest way round to the city asked for.
      const dYaw = Math.atan2(Math.sin(target.yaw - yaw), Math.cos(target.yaw - yaw))
      yaw += dYaw * Math.min(dt * 4, 1)
      pitch += (target.pitch - pitch) * Math.min(dt * 4, 1)
      if (Math.abs(dYaw) < 0.002 && Math.abs(target.pitch - pitch) < 0.002) target = null
    } else if (!dragging) {
      velocity *= 0.94
      yaw += velocity
      if (!reducedMotion && time > pausedUntil) yaw += AUTO_SPIN * dt
    }
    globe.rotation.y = yaw
    pitchGroup.rotation.x = pitch

    if (!reducedMotion) {
      for (const m of markers) {
        const k = (clock.t * 0.6 + m.offset) % 1
        m.ring.scale.setScalar(1 + k * 2.2)
        m.ring.material.opacity = 1 - k
      }
      for (const line of arcs) line.material.uniforms.time.value = clock.t
    }

    scene.updateMatrixWorld()
    renderer.render(scene, camera)
    placePins()
    frame = requestAnimationFrame(tick)
  }

  function start() {
    if (running) return
    running = true
    last = performance.now()
    frame = requestAnimationFrame(tick)
  }
  function stop() {
    running = false
    cancelAnimationFrame(frame)
  }

  // Only drawn while on screen and while the tab is visible.
  let onScreen = true
  const visibility = () => (onScreen && !document.hidden ? start() : stop())
  const intersection = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting
    visibility()
  })
  intersection.observe(container)
  document.addEventListener('visibilitychange', visibility)
  start()

  return {
    focus(lat, lng) {
      target = { yaw: yawFor(lng), pitch: Math.min(Math.max(lat * DEG, PITCH_MIN), PITCH_MAX) }
      velocity = 0
      pausedUntil = performance.now() + 4000
    },
    dispose() {
      stop()
      intersection.disconnect()
      resizeObserver.disconnect()
      document.removeEventListener('visibilitychange', visibility)
      container.removeEventListener('pointerdown', onDown)
      container.removeEventListener('pointermove', onMove)
      container.removeEventListener('pointerup', onUp)
      container.removeEventListener('pointercancel', onUp)
      for (const item of disposables) item.dispose?.()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
