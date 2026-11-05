import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Pause, Play, Volume2, VolumeX, X } from 'lucide-react'
import { GAME_TICKS, LIVES, NOCK_TICKS, PULL_MAX, PULL_MIN, TICK_RATE, createGame, step } from '../../../../shared/fleche-ebene/engine.mjs'
import { createFlecheRenderer, preloadArt } from './renderer.js'
import FlecheHelp from './FlecheHelp.jsx'

const SIM_MS = 1000 / TICK_RATE
const INTRO_MS = 4000
const RESUME_MS = 3000 // "3, 2, 1" before the game moves again after a pause
const MAX_ART_WAIT_MS = 6000 // a slow connection starts without the pictures rather than wait
const PULL_PX = 150 // a finger drawn back this far is a full draw, on any screen

const KIND_SOUND = { cible: 'ding', potamochere: 'thunk', pintade: 'bird', braconnier: 'thunk', monstre: 'monster', or: 'gold' }

// A drawn gesture as the arrow's direction: the opposite of the finger's, in
// the engine's units. null when it isn't a shot (not drawn back).
function drawFrom(start, x, y) {
  const k = PULL_MAX / PULL_PX
  const ax = (start.x - x) * k
  const ay = (start.y - y) * k
  const len = Math.hypot(ax, ay)
  if (ax < 1 || len < PULL_MIN) return null
  const cut = len > PULL_MAX ? PULL_MAX / len : 1
  return { ax: Math.round(ax * cut), ay: Math.round(ay * cut) }
}

// One game of FLÈCHE D'ÉBÈNE, full screen. Runs the shared simulation at a
// fixed 60 ticks/s and records every arrow ([tick, ax, ay]); onEnd gets
// { inputs, endTick, claimed } for the server to replay.
function FlecheScreen({ seed, audio, muted, onToggleMute, onEnd }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const pendingRef = useRef([])
  const pausedRef = useRef(false)
  const resumeRef = useRef(false)
  const onEndRef = useRef(onEnd)
  const quitRef = useRef(null)
  const pauseRef = useRef(null)
  const dragRef = useRef(null)
  const aimRef = useRef(null)
  const [hud, setHud] = useState(null)
  const [paused, setPaused] = useState(false)
  const [toast, setToast] = useState(null)
  const [intro, setIntro] = useState(true)

  useEffect(() => {
    onEndRef.current = onEnd
  }, [onEnd])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const renderer = createFlecheRenderer(canvas)
    const state = createGame(seed)
    const inputs = []
    let cancelled = false
    let startAt = Infinity // set once the pictures are in
    let introOn = true
    let acc = 0
    let last = performance.now()
    let raf = 0
    let lastHud = 0
    let endedAt = 0
    let finished = false
    let toastTimer = null

    const artWait = setTimeout(() => go(), MAX_ART_WAIT_MS)
    function go() {
      clearTimeout(artWait)
      if (!cancelled && startAt === Infinity) startAt = performance.now() + INTRO_MS
    }
    preloadArt().then(go)

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

    function handleEvents() {
      renderer.handleEvents(state)
      for (const e of state.events) {
        if (e.type === 'shot') {
          audio.play('release')
          renderer.fired()
        } else if (e.type === 'nocked') audio.play('nocked')
        else if (e.type === 'hit') audio.play(e.zone === 'body' ? KIND_SOUND[e.kind] : 'bullseye')
        else if (e.type === 'wound') audio.play('wound')
        else if (e.type === 'miss' && e.grounded) audio.play('ground')
        else if (e.type === 'protected') {
          audio.play('protected')
          showToast('🛡️ Épargne les animaux protégés !')
          navigator.vibrate?.(60)
        } else if (e.type === 'attack') {
          audio.play('attack')
          showToast(e.kind === 'monstre' ? '👹 Le monstre t’a griffé !' : '💥 Le braconnier t’a touché !')
          navigator.vibrate?.(120)
        } else if (e.type === 'wind') {
          audio.play('wind')
          if (e.wind) showToast(`🌬️ Le vent tourne : il pousse ${e.wind > 0 ? 'vers l’avant' : 'vers toi'}`)
        }
      }
    }

    function frame(now) {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(now - last, 250)
      last = now

      if (resumeRef.current) {
        resumeRef.current = false
        if (!state.over) startAt = Math.max(startAt, now + RESUME_MS)
      }
      if (pausedRef.current) startAt += dt
      else if (introOn && now >= startAt) {
        introOn = false
        setIntro(false)
      }

      const running = now >= startAt && !pausedRef.current
      if (running && !state.over) {
        acc += dt
        while (acc >= SIM_MS && !state.over) {
          const actions = pendingRef.current.splice(0).filter(() => {
            if (state.nock === 0) return true
            audio.play('empty') // no arrow on the string yet
            return false
          })
          for (const a of actions) inputs.push([state.tick, ...a])
          step(state, actions)
          handleEvents()
          acc -= SIM_MS
        }
      } else if (!running) {
        acc = 0
        pendingRef.current.length = 0
      }

      renderer.render(state, aimRef.current, now / 1000, dt / 1000)

      if (state.over && !endedAt) {
        endedAt = now
        audio.stopMusic()
        audio.play(state.lives > 0 ? 'victory' : 'defeat')
      }
      if (endedAt && now - endedAt > 1800) finish()

      if (now - lastHud > 90) {
        lastHud = now
        const left = Math.ceil((startAt - now) / 1000)
        setHud({
          lives: Math.max(0, state.lives),
          score: state.score,
          combo: state.combo,
          seconds: Math.max(0, Math.ceil((GAME_TICKS - state.tick) / TICK_RATE)),
          wind: state.wind,
          nock: 1 - state.nock / NOCK_TICKS,
          countdown: !introOn && left > 0 && left < 10 ? left : 0,
          over: state.over,
          survived: state.lives > 0,
        })
      }
    }
    raf = requestAnimationFrame(frame)
    audio.startMusic()

    // Leaving the tab pauses the game.
    function onVisibility() {
      if (document.hidden && !state.over && !pausedRef.current) pauseRef.current?.()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      observer.disconnect()
      clearTimeout(toastTimer)
      clearTimeout(artWait)
      document.removeEventListener('visibilitychange', onVisibility)
      audio.stopMusic()
    }
  }, [seed, audio])

  function togglePause() {
    const next = !pausedRef.current
    pausedRef.current = next
    setPaused(next)
    dragRef.current = null
    aimRef.current = null
    if (next) {
      audio.stopMusic()
    } else {
      resumeRef.current = true
      audio.startMusic()
    }
  }

  useEffect(() => {
    pauseRef.current = togglePause
  })

  // Échap or P pause the game.
  useEffect(() => {
    function down(e) {
      if (e.repeat) return
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        pauseRef.current?.()
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])

  // Press anywhere, draw back, let go: the same with a finger or the mouse.
  function handlePointerDown(e) {
    audio.unlock()
    if (pausedRef.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, sounded: false }
    aimRef.current = null
  }
  function handlePointerMove(e) {
    const drag = dragRef.current
    if (!drag || drag.id !== e.pointerId) return
    aimRef.current = drawFrom(drag, e.clientX, e.clientY)
    if (aimRef.current && !drag.sounded) {
      drag.sounded = true
      audio.play('draw')
    }
  }
  function handlePointerUp(e) {
    if (dragRef.current?.id !== e.pointerId) return
    if (aimRef.current) pendingRef.current.push([aimRef.current.ax, aimRef.current.ay])
    dragRef.current = null
    aimRef.current = null
  }
  function handlePointerCancel(e) {
    if (dragRef.current?.id !== e.pointerId) return
    dragRef.current = null
    aimRef.current = null
  }

  const windArrows = hud ? '➤'.repeat(Math.min(3, Math.ceil(Math.abs(hud.wind) / 2))) : ''

  return (
    <div className="fixed inset-0 z-[95] select-none bg-black" style={{ touchAction: 'none' }}>
      <div
        ref={wrapRef}
        className="absolute inset-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
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
                <Heart key={i} size={16} fill={i < hud.lives ? '#e74c3c' : 'transparent'} className={i < hud.lives ? 'text-red-400' : 'text-white/40'} />
              ))}
            </div>
            <div className="h-1 w-20 overflow-hidden rounded-full bg-white/20" title="Flèche suivante">
              <div className={`h-full ${hud.nock >= 1 ? 'bg-emerald-300' : 'bg-amber-300'}`} style={{ width: `${hud.nock * 100}%` }} />
            </div>
          </div>
          <div className="text-center [text-shadow:0_1px_2px_#000]">
            <p className="text-sm font-bold">{String(hud.score).padStart(5, '0')}</p>
            <p className={`text-[11px] ${hud.seconds <= 10 ? 'text-red-300' : 'text-white/80'}`}>⏱ {hud.seconds}s</p>
            <p className="text-[11px] text-white/85">
              🌬️{' '}
              {hud.wind === 0 ? (
                'Pas de vent'
              ) : (
                <span className={`inline-block text-sky-200 ${hud.wind < 0 ? 'rotate-180' : ''}`} aria-label={hud.wind > 0 ? 'Vent vers l’avant' : 'Vent vers toi'}>
                  {windArrows}
                </span>
              )}
            </p>
            {hud.combo >= 4 && <p className="text-[11px] font-bold text-amber-300">COMBO ×{1 + Math.min(3, Math.floor(hud.combo / 4))}</p>}
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
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/65 px-4 text-center font-mono text-white"
          >
            <p className="text-xs tracking-[0.3em] text-amber-300">FORÊT DE L’IVINDO</p>
            <p className="mt-2 font-display text-3xl font-bold">Flèche d’Ébène</p>
            <p className="mt-1 text-sm text-white/80">90 secondes. Arrête les menaces, épargne les animaux.</p>
            <div className="mt-5 w-[min(92%,26rem)] rounded-2xl bg-black/50 p-4 text-left">
              <FlecheHelp variant="short" />
            </div>
            <p className="mt-4 hidden rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-black portrait:block">📱 Tourne ton téléphone : tu verras mieux la forêt</p>
          </motion.div>
        )}
      </AnimatePresence>

      {hud?.countdown > 0 && !paused && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <motion.span key={hud.countdown} initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-8xl font-black text-white drop-shadow-[0_6px_20px_rgba(0,0,0,0.8)]">
            {hud.countdown}
          </motion.span>
        </div>
      )}

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
            {hud.survived ? 'BELLE CHASSE' : 'TU ES TOUCHÉ'}
          </p>
        </div>
      )}

      {paused && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-4 font-mono text-white">
          <p className="font-display text-2xl font-bold">PAUSE</p>
          <p className="hidden text-center text-xs text-amber-300 portrait:block">📱 Tourne ton téléphone pour mieux viser</p>
          <button type="button" onClick={togglePause} className="rounded-full bg-amber-400 px-6 py-2.5 text-sm font-bold text-black">
            Reprendre
          </button>
          <button type="button" onClick={() => quitRef.current?.()} className="flex items-center gap-1.5 rounded-full border border-white/40 px-5 py-2 text-sm">
            <X size={14} /> Abandonner la partie
          </button>
          <div className="mt-3 max-h-[50svh] w-[min(92%,26rem)] overflow-y-auto rounded-2xl bg-black/40 p-4 text-left">
            <FlecheHelp variant="short" />
          </div>
        </div>
      )}
    </div>
  )
}

export default FlecheScreen
