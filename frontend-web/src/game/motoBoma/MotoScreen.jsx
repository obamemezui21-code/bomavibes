import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Flame, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { COURSES, TICK_RATE, createRace, step } from '../../../../shared/moto-boma/engine.mjs'
import { createRenderer } from '../ngoriRun/renderer.js'
import { loadRenderer3d } from '../ngoriRun/graphics.js'
import NgoriCoin from '../../components/NgoriCoin.jsx'
import { formatTicks, kmh } from './format.js'

const SIM_MS = 1000 / TICK_RATE
const STEER_KEYS = { ArrowLeft: -1, a: -1, q: -1, ArrowRight: 1, d: 1 }
const NITRO_KEYS = new Set(['ArrowUp', ' ', 'w', 'z', 'n'])
const HONK_AHEAD = 2200


// One MOTO BOMA race, full screen. Runs the shared simulation at a fixed 60
// ticks/s and records every gesture with its tick; onEnd gets
// { inputs, endTick, claimed } for the server to replay. Drawn by NGORI RUN's
// renderers (2D or 3D): traffic as its cars, the rider as its motorbike.
//
// Controls: hold the left or right half of the screen (or ← →) to steer,
// the NITRO button (or ↑ / space) to boost.
function MotoScreen({ seed, course, runner, graphics = '2d', audio, muted, onToggleMute, onEnd }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const pendingRef = useRef([])
  const pausedRef = useRef(false)
  const onEndRef = useRef(onEnd)
  const endRef = useRef(null)
  const steerRef = useRef({ pointers: new Map(), keys: [], current: 0 })
  const [hud, setHud] = useState({ ticks: 0, progress: 0, speed: 0, coins: 0, nitroCharges: 1, nitro: false })
  const [countdown, setCountdown] = useState(3)
  const [paused, setPaused] = useState(false)
  const [toast, setToast] = useState(null)
  const courseInfo = COURSES[course]

  useEffect(() => {
    onEndRef.current = onEnd
  }, [onEnd])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    let renderer = null
    let cancelled = false
    function adopt(r) {
      if (cancelled) {
        r.dispose?.()
        return
      }
      renderer = r
      r.setBillboards([])
      resize()
    }
    const start2d = () => adopt(createRenderer(canvas, { runner }))
    if (graphics === '3d') {
      loadRenderer3d()
        .then(({ createRenderer3d }) => adopt(createRenderer3d(wrap, { runner })))
        .catch(() => !cancelled && start2d())
    } else {
      start2d()
    }

    const state = createRace(seed, course)
    const inputs = []
    let acc = 0
    let last = performance.now()
    let startAt = last + 3000
    let raf = 0
    let lastHud = 0
    let ended = false
    let toastTimer = null
    let started = false
    const honked = new Set()

    function resize() {
      renderer?.resize(wrap.clientWidth, wrap.clientHeight)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)

    function finish() {
      if (ended) return
      ended = true
      audio.stopMusic()
      const claimed = { finishTick: state.finished ? state.finishTick : null, coins: state.coins }
      onEndRef.current({ inputs, endTick: state.tick, claimed })
    }
    endRef.current = () => {
      state.over = true
      finish()
    }

    function showToast(text) {
      setToast({ text, key: performance.now() })
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => setToast(null), 1300)
    }

    function handleEvents(laneVis) {
      for (const e of state.events) {
        if (e.type === 'coin') {
          audio.play(e.gold ? 'gold' : 'coin')
          renderer?.popup(`+${e.value}`, e.gold ? '#ffd23f' : '#fde68a', laneVis, e.gold ? 32 : 24)
        } else if (e.type === 'pickup') {
          audio.play('powerup')
          showToast('🔥 Nitro +1')
        } else if (e.type === 'nitro') {
          audio.play('moto')
          renderer?.popup('NITRO !', '#67e8f9', laneVis, 32)
        } else if (e.type === 'bump') {
          audio.play('crash')
          renderer?.popup('Aïe !', '#fb7185', laneVis, 30)
          if (navigator.vibrate) navigator.vibrate(60)
        } else if (e.type === 'pothole') {
          audio.play('shield')
          renderer?.popup('Nid-de-poule !', '#fdba74', laneVis, 24)
        } else if (e.type === 'finish') {
          audio.play('bonus')
        }
      }
    }

    function frame(now) {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(now - last, 250)
      last = now

      if (pausedRef.current) {
        startAt += dt
      } else if (now >= startAt && !state.over) {
        acc += dt
        while (acc >= SIM_MS && !state.over) {
          const actions = pendingRef.current.splice(0)
          for (const a of actions) inputs.push([state.tick, a])
          step(state, actions)
          handleEvents(state.x / 100)
          acc -= SIM_MS
        }
      } else {
        pendingRef.current.length = 0
      }

      const alpha = state.over ? 0 : acc / SIM_MS
      const laneVis = (state.x - state.steer * 6 * (1 - alpha)) / 100
      // What NGORI RUN's renderers expect to draw (see renderer.js).
      const scene = {
        lane: laneVis + state.steer * 0.6, // leans the bike into the turn
        jump: 0,
        slide: 0,
        shield: false,
        grace: state.grace,
        magnet: 0,
        multiplier: 0,
        boost: state.nitro,
        moto: 0,
        riding: true,
        speed: state.speed,
        obstacles: state.vehicles,
        coinsOnRoad: state.coinsOnRoad,
        powerups: state.pickups,
      }
      renderer?.render(scene, {
        dist: state.prevDist + (state.dist - state.prevDist) * alpha,
        laneVis,
        alpha,
        time: now / 1000,
        dt: dt / 1000,
        crashT: 0,
      })

      if (!started && now >= startAt) {
        started = true
        showToast('🏍️ Plein gaz !')
      }
      if (started && !state.over && !pausedRef.current) {
        for (const v of state.vehicles) {
          const ahead = v.z - state.dist
          if (v.type === 'car' && Math.abs(v.lane * 100 - state.x) < 60 && ahead > 0 && ahead < HONK_AHEAD && !honked.has(v.id)) {
            honked.add(v.id)
            audio.play('honk')
          }
        }
      }

      if (now - lastHud > 100) {
        lastHud = now
        setHud({
          ticks: state.finished ? state.finishTick : state.tick,
          progress: Math.min(1, state.dist / state.length),
          speed: kmh(state.speed),
          coins: state.coins,
          nitroCharges: state.nitroCharges,
          nitro: state.nitro > 0,
        })
        const left = Math.ceil((startAt - now) / 1000)
        setCountdown(left > 0 ? left : 0)
      }
      if (state.over) finish()
    }
    raf = requestAnimationFrame(frame)
    audio.startMusic()

    function onVisibility() {
      if (document.hidden && !state.over) {
        pausedRef.current = true
        setPaused(true)
        audio.stopMusic()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      clearTimeout(toastTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      audio.stopMusic()
      cancelled = true
      renderer?.dispose?.()
    }
  }, [seed, course, runner, graphics, audio])

  // Steering is held: the latest finger (or key) pressed wins; a gesture is
  // recorded only when the direction actually changes.
  function updateSteer() {
    const s = steerRef.current
    const fingers = [...s.pointers.values()]
    const want = s.keys.length ? s.keys[s.keys.length - 1] : fingers.length ? fingers[fingers.length - 1] : 0
    if (want === s.current || pausedRef.current) return
    s.current = want
    pendingRef.current.push(want === 0 ? 'S' : want < 0 ? 'L' : 'R')
  }

  function nitro() {
    if (!pausedRef.current) pendingRef.current.push('N')
  }

  function togglePause() {
    const next = !pausedRef.current
    pausedRef.current = next
    setPaused(next)
    if (next) {
      steerRef.current.pointers.clear()
      steerRef.current.keys = []
      steerRef.current.current = 0
      pendingRef.current.push('S')
      audio.stopMusic()
    } else {
      audio.startMusic()
    }
  }

  function onPointerDown(e) {
    audio.unlock()
    const rect = e.currentTarget.getBoundingClientRect()
    steerRef.current.pointers.set(e.pointerId, e.clientX - rect.left < rect.width / 2 ? -1 : 1)
    updateSteer()
  }
  function onPointerUp(e) {
    steerRef.current.pointers.delete(e.pointerId)
    updateSteer()
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape' || e.key === 'p') return togglePause()
      if (NITRO_KEYS.has(e.key)) {
        e.preventDefault()
        if (!e.repeat) nitro()
        return
      }
      const dir = STEER_KEYS[e.key] ?? STEER_KEYS[e.key.toLowerCase?.()]
      if (!dir) return
      e.preventDefault()
      const keys = steerRef.current.keys
      if (!keys.includes(dir)) keys.push(dir)
      updateSteer()
    }
    function onKeyUp(e) {
      const dir = STEER_KEYS[e.key] ?? STEER_KEYS[e.key.toLowerCase?.()]
      if (!dir) return
      steerRef.current.keys = steerRef.current.keys.filter((k) => k !== dir)
      updateSteer()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const medals = courseInfo.medals
  const target = hud.ticks <= medals.gold ? ['🥇', medals.gold] : hud.ticks <= medals.silver ? ['🥈', medals.silver] : hud.ticks <= medals.bronze ? ['🥉', medals.bronze] : null

  return (
    <div className="fixed inset-0 z-[90] select-none bg-black text-white">
      <div
        ref={wrapRef}
        className="absolute inset-0 touch-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-2">
          <div className="rounded-2xl bg-black/35 px-3 py-2 backdrop-blur-md">
            <p className="font-display text-2xl font-bold leading-none tabular-nums">{formatTicks(hud.ticks)}</p>
            <p className="mt-1 text-[11px] font-semibold text-white/75 tabular-nums">
              {target ? `${target[0]} avant ${formatTicks(target[1])}` : 'Hors médailles, fonce !'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5 rounded-full bg-black/35 py-1 pl-1 pr-3 backdrop-blur-md">
              <NgoriCoin size={26} />
              <span className="font-display text-lg font-bold tabular-nums">{hud.coins}</span>
            </div>
            <span className="rounded-full bg-black/35 px-3 py-1 font-display text-sm font-bold tabular-nums backdrop-blur-md">
              {hud.speed} km/h
            </span>
          </div>
        </div>
        <div className="mx-auto mt-3 max-w-xs">
          <div className="relative h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-amber-300" style={{ width: `${hud.progress * 100}%` }} />
          </div>
          <p className="mt-1 text-center text-[11px] font-semibold text-white/75">{courseInfo.name}</p>
        </div>
      </div>

      <div className="absolute left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] flex -translate-x-1/2 gap-2">
        <button
          type="button"
          onClick={togglePause}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 backdrop-blur-md"
          aria-label={paused ? 'Reprendre' : 'Pause'}
        >
          {paused ? <Play size={18} /> : <Pause size={18} />}
        </button>
        <button
          type="button"
          onClick={onToggleMute}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 backdrop-blur-md"
          aria-label={muted ? 'Activer le son' : 'Couper le son'}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Nitro */}
      <div className="absolute inset-x-0 bottom-0 flex justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation()
            audio.unlock()
            nitro()
          }}
          disabled={!hud.nitroCharges || hud.nitro}
          className={`flex h-16 items-center gap-2 rounded-full px-6 font-display text-lg font-black tracking-wide shadow-lg transition active:scale-95 disabled:opacity-40 ${
            hud.nitro ? 'bg-cyan-300 text-cyan-950' : 'bg-gradient-to-r from-cyan-400 to-sky-500 text-white shadow-cyan-500/40'
          }`}
        >
          <Flame size={22} fill="currentColor" />
          NITRO
          <span className="flex gap-1">
            {Array.from({ length: 3 }, (_, i) => (
              <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < hud.nitroCharges ? 'bg-white' : 'bg-white/30'}`} />
            ))}
          </span>
        </button>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="pointer-events-none absolute inset-x-0 top-[26%] text-center"
          >
            <span className="rounded-full bg-black/45 px-4 py-2 font-display text-lg font-bold text-amber-200 backdrop-blur-md">
              {toast.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {countdown > 0 && !paused && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            key={countdown}
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="font-display text-8xl font-black text-white drop-shadow-[0_6px_20px_rgba(236,72,153,0.7)]"
          >
            {countdown}
          </motion.span>
          <p className="mt-4 max-w-xs rounded-2xl bg-black/40 px-4 py-2 text-center text-sm text-white/85 backdrop-blur-md">
            Maintiens le doigt à gauche ou à droite de l’écran pour te déplacer · NITRO pour accélérer
          </p>
        </div>
      )}

      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-[28px] bg-violet-950 p-6 text-center">
            <p className="font-display text-2xl font-bold">Pause</p>
            <p className="mt-1 text-sm text-white/70">
              {formatTicks(hud.ticks)} · {Math.round(hud.progress * 100)} % du parcours
            </p>
            <button type="button" onClick={togglePause} className="mt-5 w-full rounded-full bg-white py-3 text-sm font-semibold text-violet-950">
              Reprendre
            </button>
            <button type="button" onClick={() => endRef.current?.()} className="mt-2 w-full py-2 text-sm text-white/70 hover:text-white">
              Abandonner la course
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MotoScreen
