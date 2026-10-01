import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { POWER_TICKS, TICK_RATE, createRun, scoreOf, step } from '../../../../shared/ngori-run/engine.mjs'
import { createRenderer } from './renderer.js'
import { districtAt } from './libreville.js'
import NgoriCoin from '../../components/NgoriCoin.jsx'

const SIM_MS = 1000 / TICK_RATE
const SWIPE_PX = 28
const KEYS = {
  ArrowLeft: 'L', a: 'L', q: 'L',
  ArrowRight: 'R', d: 'R',
  ArrowUp: 'U', w: 'U', z: 'U', ' ': 'U',
  ArrowDown: 'D', s: 'D',
}
const POWERUP_LABEL = { magnet: '🧲 Aimant', multiplier: '🔥 ×2', boost: '⚡ Boost' }
const BONUS_LABEL = { combo: 'Combo', distance: 'Distance' }

// One run of NGORI RUN, full screen. Runs the shared simulation at a fixed
// 60 ticks/s, records every gesture with the tick it was applied on, and
// hands { inputs, endTick, claimed } to onEnd — the server replays it.
function GameScreen({ seed, runner, billboards, audio, muted, onToggleMute, showButtons, onEnd }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const pendingRef = useRef([])
  const pausedRef = useRef(false)
  const [hud, setHud] = useState({ distance: 0, district: districtAt(0), score: 0, coins: 0, combo: 0, shield: false, timers: {} })
  const [countdown, setCountdown] = useState(3)
  const [paused, setPaused] = useState(false)
  const [toast, setToast] = useState(null)
  const onEndRef = useRef(onEnd)
  const rendererRef = useRef(null)
  const endRef = useRef(null)

  useEffect(() => {
    onEndRef.current = onEnd
  }, [onEnd])

  // Coins Chics billboards may arrive after the run has started.
  useEffect(() => {
    rendererRef.current?.setBillboards(billboards)
  }, [billboards, seed])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const renderer = createRenderer(canvas, { runner })
    rendererRef.current = renderer
    const state = createRun(seed)
    const inputs = []
    let laneVis = state.lane
    let acc = 0
    let last = performance.now()
    let startAt = last + 3000 // after "3, 2, 1"
    let raf = 0
    let lastHud = 0
    let crashAt = 0
    let ended = false
    let toastTimer = null
    let district = districtAt(0)

    const resize = () => renderer.resize(wrap.clientWidth, wrap.clientHeight)
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)

    function finish() {
      if (ended) return
      ended = true
      audio.stopMusic()
      const claimed = { score: scoreOf(state), distance: Math.floor(state.dist / 100), coins: state.coins, bonus: state.bonus }
      onEndRef.current({ inputs, endTick: state.tick, claimed })
    }
    endRef.current = () => {
      if (!state.over) state.over = true
      finish()
    }

    function showToast(text) {
      setToast({ text, key: performance.now() })
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => setToast(null), 1300)
    }

    function handleEvents() {
      for (const e of state.events) {
        if (e.type === 'coin') {
          audio.play(e.gold ? 'gold' : 'coin')
          renderer.popup(`+${e.value}`, e.gold ? '#ffd23f' : '#fde68a', laneVis, e.gold ? 32 : 24)
        } else if (e.type === 'bonus') {
          audio.play('bonus')
          showToast(`${BONUS_LABEL[e.reason]} ! +${e.ngori} Ngori`)
        } else if (e.type === 'powerup') {
          audio.play('powerup')
          showToast(e.powerup === 'shield' ? '🛡️ Bouclier activé' : `${POWERUP_LABEL[e.powerup]} !`)
        } else if (e.type === 'shield') {
          audio.play('shield')
          renderer.popup('Bouclier !', '#7dd3fc', laneVis, 28)
        } else if (e.type === 'crash') {
          audio.play('crash')
          renderer.crash()
          crashAt = performance.now()
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
          for (const a of actions) {
            inputs.push([state.tick, a])
            audio.play(a === 'U' ? 'jump' : a === 'D' ? 'slide' : 'lane')
          }
          step(state, actions)
          handleEvents()
          acc -= SIM_MS
        }
      } else {
        pendingRef.current.length = 0
      }

      laneVis += (state.lane - laneVis) * Math.min(1, (dt / 1000) * 16)
      const alpha = state.over ? 0 : acc / SIM_MS
      const view = {
        dist: state.prevDist + (state.dist - state.prevDist) * alpha,
        laneVis,
        alpha,
        time: now / 1000,
        dt: dt / 1000,
        crashT: crashAt ? (now - crashAt) / 1000 : 0,
      }
      renderer.render(state, view)

      const here = districtAt(Math.floor(state.dist / 100))
      if (here !== district) {
        district = here
        audio.play('district')
        showToast(`📍 Bienvenue à ${here}`)
      }

      if (now - lastHud > 100) {
        lastHud = now
        setHud({
          distance: Math.floor(state.dist / 100),
          district,
          score: scoreOf(state),
          coins: state.coins + state.bonus,
          combo: state.combo,
          shield: state.shield,
          timers: {
            magnet: state.magnet / POWER_TICKS.magnet,
            multiplier: state.multiplier / POWER_TICKS.multiplier,
            boost: state.boost / POWER_TICKS.boost,
          },
        })
        const left = Math.ceil((startAt - now) / 1000)
        setCountdown(left > 0 ? left : 0)
      }
      if (crashAt && now - crashAt > 1100) finish()
      else if (state.over && !state.crashed) finish()
    }
    raf = requestAnimationFrame(frame)
    audio.startMusic()

    // Leaving the tab pauses the run.
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
    }
  }, [seed, runner, audio])

  function act(action) {
    if (!pausedRef.current) pendingRef.current.push(action)
  }

  function togglePause() {
    const next = !pausedRef.current
    pausedRef.current = next
    setPaused(next)
    if (next) audio.stopMusic()
    else audio.startMusic()
  }

  // Swipes: one gesture = one action, triggered as soon as the finger has
  // moved far enough (no need to lift it), like the big runner games.
  const swipe = useRef(null)
  function onPointerDown(e) {
    audio.unlock()
    swipe.current = { x: e.clientX, y: e.clientY, done: false }
  }
  function onPointerMove(e) {
    const s = swipe.current
    if (!s || s.done) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return
    s.done = true
    act(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'L' : 'R') : dy < 0 ? 'U' : 'D')
  }
  function onPointerUp() {
    swipe.current = null
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' || e.key === 'p') {
        togglePause()
        return
      }
      const action = KEYS[e.key] || KEYS[e.key.toLowerCase?.()]
      if (!action) return
      e.preventDefault()
      act(action)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeTimers = Object.entries(hud.timers).filter(([, v]) => v > 0)

  return (
    <div className="fixed inset-0 z-[90] select-none bg-black text-white">
      <div
        ref={wrapRef}
        className="absolute inset-0 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="rounded-2xl bg-black/35 px-3 py-2 backdrop-blur-md">
          <p className="font-display text-xl font-bold leading-none tabular-nums">{hud.distance.toLocaleString('fr-FR')} m</p>
          <p className="mt-0.5 text-xs font-semibold text-amber-200">📍 {hud.district}</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-white/70 tabular-nums">
            Score {hud.score.toLocaleString('fr-FR')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5 rounded-full bg-black/35 py-1 pl-1 pr-3 backdrop-blur-md">
            <NgoriCoin size={26} />
            <span className="font-display text-lg font-bold tabular-nums">{hud.coins}</span>
          </div>
          {hud.combo >= 2 && (
            <motion.span
              key={hud.combo}
              initial={{ scale: 1.4 }}
              animate={{ scale: 1 }}
              className="rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-2.5 py-0.5 text-xs font-bold"
            >
              🔥 Combo ×{hud.combo}
            </motion.span>
          )}
          {hud.shield && <span className="rounded-full bg-sky-500/80 px-2.5 py-0.5 text-xs font-bold">🛡️ Bouclier</span>}
          {activeTimers.map(([key, v]) => (
            <span key={key} className="relative overflow-hidden rounded-full bg-black/40 px-2.5 py-0.5 text-xs font-bold">
              <span className="absolute inset-y-0 left-0 bg-white/20" style={{ width: `${v * 100}%` }} />
              <span className="relative">{POWERUP_LABEL[key]}</span>
            </span>
          ))}
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

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="pointer-events-none absolute inset-x-0 top-[22%] text-center"
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
          <p className="mt-4 rounded-full bg-black/40 px-4 py-1.5 text-sm text-white/85 backdrop-blur-md">
            Glisse ← → pour changer de voie · ↑ sauter · ↓ glisser
          </p>
        </div>
      )}

      {showButtons && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {[
            ['L', ArrowLeft, 'Gauche'],
            ['D', ArrowDown, 'Glisser'],
            ['U', ArrowUp, 'Sauter'],
            ['R', ArrowRight, 'Droite'],
          ].map(([action, Icon, label]) => (
            <button
              key={action}
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation()
                audio.unlock()
                act(action)
              }}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md active:bg-white/30"
              aria-label={label}
            >
              <Icon size={24} strokeWidth={2.5} />
            </button>
          ))}
        </div>
      )}

      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-[28px] bg-violet-950 p-6 text-center">
            <p className="font-display text-2xl font-bold">Pause</p>
            <p className="mt-1 text-sm text-white/70">
              {hud.distance.toLocaleString('fr-FR')} m · {hud.coins} Ngori ramassés
            </p>
            <button
              type="button"
              onClick={togglePause}
              className="mt-5 w-full rounded-full bg-white py-3 text-sm font-semibold text-violet-950"
            >
              Reprendre
            </button>
            <button
              type="button"
              onClick={() => endRef.current?.()}
              className="mt-2 w-full py-2 text-sm text-white/70 hover:text-white"
            >
              Arrêter et encaisser
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default GameScreen
