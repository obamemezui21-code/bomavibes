import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Pause, Play, Volume2, VolumeX, X } from 'lucide-react'
import { GAME_TICKS, H, LIVES, RIFLES, TICK_RATE, W, createGame, step } from '../../../../shared/oeil-de-panthere/engine.mjs'
import { createPantherRenderer, preloadArt } from './renderer.js'
import PantherHelp from './PantherHelp.jsx'

const SIM_MS = 1000 / TICK_RATE
const HAS_MOUSE = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches
const INTRO_MS = HAS_MOUSE ? 4000 : 3000
const TOUCH_SPEED = 0.9 // a finger's drag moves the scope a little less than the finger
const BREATH_KEYS = new Set([' ', 'Shift'])

const KIND_SOUND = { cible: 'ding', braconnier: 'thud', monstre: 'monster', or: 'gold' }

// A touch button: `onDown` when pressed, `onUp` when let go.
function TouchButton({ label, onDown, onUp, className, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.stopPropagation()
        e.currentTarget.setPointerCapture?.(e.pointerId)
        onDown()
      }}
      onPointerUp={() => onUp?.()}
      onPointerCancel={() => onUp?.()}
      onContextMenu={(e) => e.preventDefault()}
      className={`flex select-none items-center justify-center rounded-full border-2 border-white/30 bg-black/40 font-display text-xs font-bold text-white backdrop-blur-sm active:bg-white/25 ${className}`}
      style={{ touchAction: 'none', WebkitUserSelect: 'none' }}
    >
      {children}
    </button>
  )
}

// One game of ŒIL DE PANTHÈRE, full screen. Runs the shared simulation at a
// fixed 60 ticks/s and records every shot ([tick, x, y]) and reload
// ([tick, 'R']); onEnd gets { inputs, endTick, claimed } for the server to
// replay. The scope's sway, recoil and held breath only move the aim.
function PantherScreen({ seed, options, audio, muted, onToggleMute, onEnd }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const pendingRef = useRef([])
  const pausedRef = useRef(false)
  const onEndRef = useRef(onEnd)
  const quitRef = useRef(null)
  const pauseRef = useRef(null)
  const fireRef = useRef(null)
  const breathRef = useRef(false)
  const pointerRef = useRef({ x: W / 2, y: H / 2 })
  const dragRef = useRef(null)
  const rendererRef = useRef(null)
  const [hud, setHud] = useState(null)
  const [paused, setPaused] = useState(false)
  const [toast, setToast] = useState(null)
  const [intro, setIntro] = useState(true)
  const rifle = RIFLES[options.rifle] || RIFLES.carabine

  useEffect(() => {
    onEndRef.current = onEnd
  }, [onEnd])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const renderer = createPantherRenderer(canvas)
    rendererRef.current = renderer
    preloadArt()
    const state = createGame(seed, options)
    const gun = RIFLES[state.rifle]
    const inputs = []
    let acc = 0
    let last = performance.now()
    const startAt = last + INTRO_MS
    let pausedFor = 0
    let raf = 0
    let lastHud = 0
    let endedAt = 0
    let finished = false
    let toastTimer = null
    let recoil = 0
    let stamina = 1
    const aim = { x: W / 2, y: H / 2 }

    const resize = () => renderer.resize(wrap.clientWidth, wrap.clientHeight)
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)

    function finish() {
      if (finished) return
      finished = true
      audio.stopMusic()
      onEndRef.current({ inputs, endTick: state.tick, claimed: { score: state.score } })
    }
    quitRef.current = () => {
      state.over = true
      finish()
    }

    function showToast(text) {
      setToast({ text, key: performance.now() })
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => setToast(null), 1500)
    }

    fireRef.current = () => {
      if (pausedRef.current || state.over || performance.now() < startAt + pausedFor) return
      const x = Math.max(0, Math.min(W - 1, Math.round(aim.x)))
      const y = Math.max(0, Math.min(H - 1, Math.round(aim.y)))
      pendingRef.current.push([x, y])
    }

    function handleEvents(time) {
      renderer.handleEvents(state, time)
      for (const e of state.events) {
        if (e.type === 'hit') audio.play(e.zone === 'centre' ? 'bullseye' : KIND_SOUND[e.kind])
        else if (e.type === 'wound') audio.play('wound')
        else if (e.type === 'protected') {
          audio.play('protected')
          showToast('🛡️ Ne tire pas sur les animaux protégés !')
          navigator.vibrate?.(60)
        } else if (e.type === 'attack') {
          audio.play('attack')
          showToast(e.kind === 'monstre' ? '👹 Le monstre t’a griffé !' : '💥 Un braconnier t’a tiré dessus !')
          navigator.vibrate?.(120)
        } else if (e.type === 'reload') audio.play('reload')
        else if (e.type === 'loaded') audio.play('loaded')
      }
    }

    function frame(now) {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(now - last, 250)
      last = now
      if (pausedRef.current) pausedFor += dt
      const running = now >= startAt + pausedFor && !pausedRef.current
      const time = now / 1000

      if (running && !state.over) {
        acc += dt
        while (acc >= SIM_MS && !state.over) {
          const actions = pendingRef.current.splice(0)
          for (const a of actions) inputs.push([state.tick, ...a])
          const shotsBefore = state.shots
          step(state, actions)
          if (state.shots > shotsBefore) {
            renderer.fired()
            recoil = 1
            audio.play(state.rifle === 'precision' ? 'heavyShot' : state.rifle === 'assaut' ? 'burstShot' : 'shot')
            if (state.rifle !== 'assaut' && state.ammo > 0) setTimeout(() => audio.play('bolt'), 320)
          } else if (actions.some((a) => a[0] !== 'R') && state.reload > 0) {
            audio.play('empty')
          }
          handleEvents(time)
          acc -= SIM_MS
        }
      } else if (!running) {
        acc = 0
        pendingRef.current = pendingRef.current.filter((a) => a[0] === 'R')
      }

      // The scope: where the player points, plus sway (less when holding
      // the breath) and the recoil of the last shot.
      const holding = breathRef.current && stamina > 0
      stamina = holding ? Math.max(0, stamina - dt / 3000) : Math.min(1, stamina + dt / 4000)
      const amp = gun.sway * (holding ? 0.15 : 1)
      recoil = Math.max(0, recoil * 0.9 - 0.005)
      aim.x = pointerRef.current.x + amp * (Math.sin(time * 1.1) + 0.5 * Math.sin(time * 2.7))
      aim.y = pointerRef.current.y + amp * (0.8 * Math.sin(time * 1.5 + 1) + 0.4 * Math.sin(time * 3.3)) - recoil * 16
      renderer.render(state, aim, time)

      if (state.over && !endedAt) {
        endedAt = now
        audio.stopMusic()
        audio.play(state.lives > 0 ? 'victory' : 'defeat')
      }
      if (endedAt && now - endedAt > 1800) finish()

      if (now - lastHud > 90) {
        lastHud = now
        setHud({
          lives: Math.max(0, state.lives),
          score: state.score,
          combo: state.combo,
          seconds: Math.max(0, Math.ceil((GAME_TICKS - state.tick) / TICK_RATE)),
          ammo: state.ammo,
          reload: state.reload > 0 ? 1 - state.reload / gun.reload : null,
          stamina,
          over: state.over,
          survived: state.lives > 0,
        })
      }
    }
    raf = requestAnimationFrame(frame)
    audio.startMusic()
    const introTimer = setTimeout(() => setIntro(false), INTRO_MS)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      clearTimeout(toastTimer)
      clearTimeout(introTimer)
      audio.stopMusic()
    }
  }, [seed, options, audio])

  // Keyboard: R reload, space / Shift hold the breath, Échap / P pause.
  useEffect(() => {
    function down(e) {
      if (e.repeat) return
      if (e.key === 'r' || e.key === 'R') pendingRef.current.push(['R'])
      else if (BREATH_KEYS.has(e.key)) breathRef.current = true
      else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') pauseRef.current?.()
      else return
      e.preventDefault()
      audio.unlock()
    }
    function up(e) {
      if (BREATH_KEYS.has(e.key)) breathRef.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [audio])

  function togglePause() {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
    if (pausedRef.current) audio.stopMusic()
    else audio.startMusic()
  }

  useEffect(() => {
    pauseRef.current = togglePause
  })

  function clamp(p) {
    return { x: Math.max(0, Math.min(W - 1, p.x)), y: Math.max(0, Math.min(H - 1, p.y)) }
  }

  function localPoint(e) {
    const rect = wrapRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function worldOf(e) {
    const p = localPoint(e)
    return rendererRef.current.toWorld(p.x, p.y)
  }

  // Mouse: the scope follows it, left click fires, right click reloads.
  // Touch: dragging anywhere moves the scope; the buttons fire and reload.
  function handlePointerDown(e) {
    audio.unlock()
    if (e.pointerType === 'mouse') {
      pointerRef.current = clamp(worldOf(e))
      if (e.button === 0) fireRef.current?.()
      else if (e.button === 2) pendingRef.current.push(['R'])
      return
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragRef.current = { id: e.pointerId, ...localPoint(e) }
  }
  function handlePointerMove(e) {
    if (e.pointerType === 'mouse') {
      pointerRef.current = clamp(worldOf(e))
      return
    }
    const drag = dragRef.current
    if (!drag || drag.id !== e.pointerId) return
    const p = localPoint(e)
    const a = rendererRef.current.toWorld(drag.x, drag.y)
    const b = rendererRef.current.toWorld(p.x, p.y)
    pointerRef.current = clamp({ x: pointerRef.current.x + (b.x - a.x) * TOUCH_SPEED, y: pointerRef.current.y + (b.y - a.y) * TOUCH_SPEED })
    dragRef.current = { id: e.pointerId, ...p }
  }
  function handlePointerUp(e) {
    if (dragRef.current?.id === e.pointerId) dragRef.current = null
  }

  return (
    <div className="fixed inset-0 z-[95] select-none bg-black" style={{ touchAction: 'none' }}>
      <div
        ref={wrapRef}
        className={`absolute inset-0 ${HAS_MOUSE ? 'cursor-none' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>

      {/* HUD */}
      {hud && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] font-mono text-white">
          <div className="space-y-1">
            <div className="flex gap-0.5">
              {Array.from({ length: LIVES }).map((_, i) => (
                <Heart key={i} size={15} fill={i < hud.lives ? '#e74c3c' : 'transparent'} className={i < hud.lives ? 'text-red-400' : 'text-white/40'} />
              ))}
            </div>
            <div className="flex items-center gap-1 text-[11px] [text-shadow:0_1px_2px_#000]">
              {hud.reload !== null ? (
                <span className="flex items-center gap-1">
                  Rechargement
                  <span className="inline-block h-1.5 w-14 overflow-hidden rounded-full bg-white/25">
                    <span className="block h-full bg-amber-300" style={{ width: `${hud.reload * 100}%` }} />
                  </span>
                </span>
              ) : (
                <span className="flex flex-wrap gap-[2px]" aria-label={`${hud.ammo} balles`}>
                  {Array.from({ length: rifle.mag }).map((_, i) => (
                    <span key={i} className={`inline-block h-3 w-1 rounded-t-full ${i < hud.ammo ? 'bg-amber-300' : 'bg-white/20'}`} />
                  ))}
                </span>
              )}
            </div>
            <div className="h-1 w-20 overflow-hidden rounded-full bg-white/20" title="Souffle">
              <div className="h-full bg-sky-300" style={{ width: `${hud.stamina * 100}%` }} />
            </div>
          </div>
          <div className="text-center [text-shadow:0_1px_2px_#000]">
            <p className="text-sm font-bold">{String(hud.score).padStart(5, '0')}</p>
            <p className={`text-[11px] ${hud.seconds <= 10 ? 'text-red-300' : 'text-white/80'}`}>⏱ {hud.seconds}s</p>
            {hud.combo >= 5 && <p className="text-[11px] font-bold text-amber-300">COMBO ×{1 + Math.min(3, Math.floor(hud.combo / 5))}</p>}
          </div>
          <div className="pointer-events-auto flex gap-1.5">
            <button type="button" onClick={onToggleMute} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40" aria-label={muted ? 'Activer le son' : 'Couper le son'}>
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <button type="button" onClick={togglePause} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40" aria-label={paused ? 'Reprendre' : 'Pause'}>
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
          </div>
        </div>
      )}

      {/* Intro */}
      <AnimatePresence>
        {intro && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/60 px-4 text-center font-mono text-white"
          >
            <p className="text-xs tracking-[0.3em] text-amber-300">ŒIL DE PANTHÈRE · LOPÉ</p>
            <p className="mt-2 font-display text-3xl font-bold">{rifle.name}</p>
            <p className="mt-1 text-sm text-white/80">90 secondes. Abats les menaces, épargne les animaux.</p>
            <div className="mt-5 w-[min(92%,26rem)] rounded-2xl bg-black/50 p-4 text-left">
              <PantherHelp variant={HAS_MOUSE ? 'keyboard' : 'touch'} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.p
            key={toast.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 top-[22%] px-4 text-center font-mono text-base font-bold text-amber-200 [text-shadow:0_2px_4px_#000]"
          >
            {toast.text}
          </motion.p>
        )}
      </AnimatePresence>

      {hud?.over && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className={`font-display text-4xl font-bold [text-shadow:0_3px_8px_#000] ${hud.survived ? 'text-amber-300' : 'text-red-400'}`}>
            {hud.survived ? 'FIN DE LA CHASSE' : 'TU ES TOUCHÉ'}
          </p>
        </div>
      )}

      {paused && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-4 font-mono text-white">
          <p className="font-display text-2xl font-bold">PAUSE</p>
          <button type="button" onClick={togglePause} className="rounded-full bg-amber-400 px-6 py-2.5 text-sm font-bold text-black">
            Reprendre
          </button>
          <button type="button" onClick={() => quitRef.current?.()} className="flex items-center gap-1.5 rounded-full border border-white/40 px-5 py-2 text-sm">
            <X size={14} /> Abandonner la partie
          </button>
          <div className="mt-3 max-h-[50svh] w-[min(92%,26rem)] overflow-y-auto rounded-2xl bg-black/40 p-4 text-left">
            <PantherHelp variant={HAS_MOUSE ? 'keyboard' : 'touch'} />
          </div>
        </div>
      )}

      {/* Touch controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-4 pb-[max(1rem,env(safe-area-inset-bottom))] [@media(pointer:fine)]:hidden">
        <div className="pointer-events-auto flex flex-col gap-2">
          <TouchButton
            label="Retenir son souffle"
            onDown={() => (breathRef.current = true)}
            onUp={() => (breathRef.current = false)}
            className="h-12 w-12 border-sky-300/60 text-[9px]"
          >
            SOUFFLE
          </TouchButton>
          <TouchButton label="Recharger" onDown={() => pendingRef.current.push(['R'])} className="h-12 w-12 text-[9px]">
            RECH.
          </TouchButton>
        </div>
        <TouchButton
          label="Tirer"
          onDown={() => {
            audio.unlock()
            fireRef.current?.()
          }}
          className="h-20 w-20 border-red-300/60 bg-red-500/35 text-sm"
        >
          TIR
        </TouchButton>
      </div>
    </div>
  )
}

export default PantherScreen
