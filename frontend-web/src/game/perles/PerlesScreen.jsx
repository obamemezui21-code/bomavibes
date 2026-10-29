import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Pause, Play, Volume2, VolumeX, X } from 'lucide-react'
import { H, LEVELS, LIVES, SHOOTER, TICK_RATE, W, aimHit, createGame, progressOf, step } from '../../../../shared/perles-punu/engine.mjs'
import { createPerlesRenderer } from './renderer.js'
import PerlesHelp from './PerlesHelp.jsx'

const SIM_MS = 1000 / TICK_RATE
const HAS_MOUSE = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches
const INTRO_MS = 4000
const MASK_RADIUS = 34 // a tap on the mask swaps the beads
const KEY_TURN = Math.PI / 60 // arrows turn the aim by 3°
const BURST_SOUNDS = { ralenti: 'ralenti', recul: 'recul', bombe: 'bombe' }

// A point on the line from the mask through p, kept inside the playfield
// (the throw's direction doesn't change, the server only takes points in it).
function onField(p) {
  const dx = p.x - SHOOTER.x
  const dy = p.y - SHOOTER.y
  let t = 1
  if (p.x < 0) t = Math.min(t, -SHOOTER.x / dx)
  if (p.x > W) t = Math.min(t, (W - SHOOTER.x) / dx)
  if (p.y < 0) t = Math.min(t, -SHOOTER.y / dy)
  if (p.y > H) t = Math.min(t, (H - SHOOTER.y) / dy)
  return { x: Math.round(SHOOTER.x + dx * t), y: Math.round(SHOOTER.y + dy * t) }
}

// One game of PERLES PUNU, full screen. Runs the shared simulation at a
// fixed 60 ticks/s and records the throws ([tick, x, y]) and the swaps
// ([tick, 'S']); onEnd gets { inputs, endTick, claimed } for the server to
// replay.
function PerlesScreen({ seed, audio, muted, onToggleMute, onEnd }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const pausedRef = useRef(false)
  const onEndRef = useRef(onEnd)
  const quitRef = useRef(null)
  const pauseRef = useRef(null)
  const aimRef = useRef(null) // where the player aims, in world units
  const aimingRef = useRef(false) // a finger is down (touch shows the guide only then)
  const throwRef = useRef(null) // a throw waiting for the next tick
  const swapRef = useRef(false)
  const rendererRef = useRef(null)
  const stateRef = useRef(null)
  const [hud, setHud] = useState(null)
  const [paused, setPaused] = useState(false)
  const [banner, setBanner] = useState(null)
  const [intro, setIntro] = useState(true)

  useEffect(() => {
    onEndRef.current = onEnd
  }, [onEnd])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const renderer = createPerlesRenderer(canvas)
    rendererRef.current = renderer
    const state = createGame(seed)
    stateRef.current = state
    const inputs = []
    let acc = 0
    let last = performance.now()
    const startAt = last + INTRO_MS
    let pausedFor = 0
    let raf = 0
    let lastHud = 0
    let endedAt = 0
    let finished = false
    let bannerTimer = null
    let hit = null
    let hitAt = 0

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

    function showBanner(title, subtitle, tone, ms = 2600) {
      setBanner({ title, subtitle, tone, key: performance.now() })
      clearTimeout(bannerTimer)
      bannerTimer = setTimeout(() => setBanner(null), ms)
    }

    function handleEvents() {
      renderer.handleEvents(state)
      for (const e of state.events) {
        if (e.type === 'throw') audio.play('throw')
        else if (e.type === 'insert') audio.play('insert')
        else if (e.type === 'swap') audio.play('swap')
        else if (e.type === 'burst') {
          audio.play('burst', e.combo)
          for (const sp of e.specials) audio.play(BURST_SOUNDS[sp])
          if (e.combo > 1) navigator.vibrate?.(30)
        } else if (e.type === 'streak') audio.play('streak')
        else if (e.type === 'coin') audio.play('coin')
        else if (e.type === 'coinUp') audio.play('coinUp')
        else if (e.type === 'level') {
          const lv = LEVELS[e.level]
          audio.play('level')
          showBanner(lv.name, `Niveau ${e.level + 1}/${LEVELS.length} · ${lv.subtitle}`, 'gold', 3000)
        } else if (e.type === 'clear') {
          audio.play('clear')
          showBanner('Niveau réussi !', `+${e.bonus.toLocaleString('fr-FR')} pts${e.timeBonus ? ' (dont bonus de vitesse)' : ''}`, 'gold')
        } else if (e.type === 'lost') {
          audio.play('lost')
          navigator.vibrate?.([60, 40, 120])
          showBanner(
            'Dans la chute !',
            e.lives > 0 ? `Il te reste ${e.lives} vie${e.lives > 1 ? 's' : ''} : on recommence le niveau.` : 'Plus de vies…',
            'red',
            3000,
          )
        }
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
          const actions = []
          if (swapRef.current) {
            swapRef.current = false
            actions.push(['S'])
          }
          if (throwRef.current && state.cooldown === 0) {
            const p = throwRef.current
            throwRef.current = null
            actions.push([p.x, p.y])
          }
          for (const a of actions) inputs.push([state.tick, ...a])
          step(state, actions)
          handleEvents()
          acc -= SIM_MS
        }
      } else if (!running) {
        acc = 0
        throwRef.current = null
        swapRef.current = false
      }

      // The aiming guide: shown with a mouse, or while a finger is down.
      const aim = aimRef.current
      const showGuide = aim && (HAS_MOUSE || aimingRef.current !== false)
      if (showGuide && now - hitAt > 50) {
        const p = onField(aim)
        hit = aimHit(state, p.x, p.y)
        hitAt = now
      }
      renderer.render(state, time, aim, showGuide ? hit : null)

      if (running && progressOf(state) > 0.82 && (state.phase === 'play' || state.phase === 'rush')) audio.play('danger')

      if (state.over && !endedAt) {
        endedAt = now
        audio.stopMusic()
        audio.play(state.won ? 'victory' : 'defeat')
      }
      if (endedAt && now - endedAt > 2600) finish()

      if (now - lastHud > 120) {
        lastHud = now
        const lv = LEVELS[state.level]
        setHud({
          level: state.level,
          lives: Math.max(0, state.lives),
          score: state.score,
          left: lv.beads - state.spawned + state.chain.length,
          total: lv.beads,
          slow: state.slow > 0,
          reverse: state.reverse > 0,
          streak: state.streak,
          over: state.over,
          won: state.won,
        })
      }
    }
    raf = requestAnimationFrame(frame)
    audio.startMusic()
    const introTimer = setTimeout(() => setIntro(false), INTRO_MS)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      clearTimeout(bannerTimer)
      clearTimeout(introTimer)
      audio.stopMusic()
    }
  }, [seed, audio])

  // Keyboard: space swaps, arrows turn the aim, ↑ or Entrée throws, Échap / P pause.
  useEffect(() => {
    function turn(by) {
      const a = aimRef.current || { x: SHOOTER.x, y: SHOOTER.y - 100 }
      const angle = Math.atan2(a.y - SHOOTER.y, a.x - SHOOTER.x) + by
      aimRef.current = { x: SHOOTER.x + Math.cos(angle) * 140, y: SHOOTER.y + Math.sin(angle) * 140 }
    }
    function down(e) {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (key === ' ' || key === 's') {
        if (!e.repeat) swapRef.current = true
      } else if (key === 'ArrowLeft') turn(-KEY_TURN)
      else if (key === 'ArrowRight') turn(KEY_TURN)
      else if (key === 'ArrowUp' || key === 'Enter') {
        if (!e.repeat) {
          if (!aimRef.current) turn(0)
          throwRef.current = onField(aimRef.current)
        }
      } else if (key === 'Escape' || key === 'p') {
        if (!e.repeat) pauseRef.current?.()
      } else return
      e.preventDefault()
      audio.unlock()
    }
    // Leaving the app (call, notification, other tab) pauses the game.
    function hidden() {
      if (document.hidden && !pausedRef.current && !stateRef.current?.over) pauseRef.current?.()
    }
    window.addEventListener('keydown', down)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('keydown', down)
      document.removeEventListener('visibilitychange', hidden)
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

  function worldPoint(e) {
    const rect = wrapRef.current.getBoundingClientRect()
    return rendererRef.current.toWorld(e.clientX - rect.left, e.clientY - rect.top)
  }

  function onMask(p) {
    return (p.x - SHOOTER.x) ** 2 + (p.y - SHOOTER.y) ** 2 < MASK_RADIUS ** 2
  }

  // Mouse: aim with the pointer, click to throw, right click (or a click on
  // the mask) to swap. Touch: put a finger down to aim, lift it to throw;
  // a tap on the mask swaps.
  function handlePointerDown(e) {
    audio.unlock()
    const p = worldPoint(e)
    if (e.pointerType === 'mouse') {
      aimRef.current = p
      if (e.button === 2 || onMask(p)) swapRef.current = true
      else if (e.button === 0) throwRef.current = onField(p)
      return
    }
    if (onMask(p)) {
      swapRef.current = true
      return
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    aimingRef.current = e.pointerId
    aimRef.current = p
  }
  function handlePointerMove(e) {
    if (e.pointerType === 'mouse') {
      aimRef.current = worldPoint(e)
      return
    }
    if (aimingRef.current === e.pointerId) aimRef.current = worldPoint(e)
  }
  function handlePointerUp(e) {
    if (e.pointerType === 'mouse' || aimingRef.current !== e.pointerId) return
    aimingRef.current = false
    if (e.type === 'pointerup' && aimRef.current && !onMask(aimRef.current)) throwRef.current = onField(aimRef.current)
  }

  const lv = hud ? LEVELS[hud.level] : LEVELS[0]

  return (
    <div className="fixed inset-0 z-[95] select-none bg-black" style={{ touchAction: 'none' }}>
      <div
        ref={wrapRef}
        className={`absolute inset-0 ${HAS_MOUSE ? 'cursor-crosshair' : ''}`}
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
        <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto max-w-md px-3 pt-[max(0.5rem,env(safe-area-inset-top))] text-white">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 [text-shadow:0_1px_2px_#000]">
              <div className="flex gap-0.5" aria-label={`${hud.lives} vie${hud.lives > 1 ? 's' : ''} sur ${LIVES}`}>
                {Array.from({ length: LIVES }).map((_, i) => (
                  <Heart key={i} size={15} fill={i < hud.lives ? '#e74c3c' : 'transparent'} className={i < hud.lives ? 'text-red-400' : 'text-white/40'} />
                ))}
              </div>
              <p className="text-[11px] font-semibold text-amber-200">
                {hud.level + 1}/{LEVELS.length} · {lv.name}
              </p>
            </div>
            <div className="text-center font-mono [text-shadow:0_1px_2px_#000]">
              <p className="text-sm font-bold">{String(hud.score).padStart(6, '0')}</p>
              {hud.streak >= 3 && <p className="text-[11px] font-bold text-amber-300">SÉRIE ×{hud.streak}</p>}
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
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/45 ring-1 ring-white/15">
              <div className="h-full bg-gradient-to-r from-amber-300 to-orange-400 transition-[width]" style={{ width: `${(1 - hud.left / hud.total) * 100}%` }} />
            </div>
            <span className="text-[10px] text-white/80 [text-shadow:0_1px_2px_#000]">{hud.left} perles</span>
          </div>
          {(hud.slow || hud.reverse) && (
            <p className="mt-1 text-center text-[11px] font-bold text-sky-200 [text-shadow:0_1px_2px_#000]">{hud.reverse ? '⏪ La rivière recule !' : '🐢 Rivière ralentie'}</p>
          )}
        </div>
      )}

      {/* Intro */}
      <AnimatePresence>
        {intro && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/65 px-4 text-center text-white"
          >
            <p className="font-mono text-xs tracking-[0.3em] text-amber-300">PERLES PUNU</p>
            <p className="mt-2 font-display text-3xl font-bold">{LEVELS[0].name}</p>
            <p className="mt-1 text-sm text-white/80">Fais éclater les perles avant qu’elles n’atteignent la chute.</p>
            <div className="mt-5 w-[min(92%,26rem)] rounded-2xl bg-black/50 p-4 text-left">
              <PerlesHelp variant={HAS_MOUSE ? 'keyboard' : 'touch'} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {banner && !intro && (
          <motion.div
            key={banner.key}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 top-[18%] px-4 text-center [text-shadow:0_2px_6px_#000]"
          >
            <p className={`font-display text-3xl font-bold ${banner.tone === 'red' ? 'text-red-400' : 'text-amber-300'}`}>{banner.title}</p>
            <p className="mt-1 text-sm text-white/90">{banner.subtitle}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {hud?.over && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <p className={`font-display text-4xl font-bold [text-shadow:0_3px_8px_#000] ${hud.won ? 'text-amber-300' : 'text-red-400'}`}>
            {hud.won ? 'LE FLEUVE EST LIBRE !' : 'PARTIE TERMINÉE'}
          </p>
          {hud.won && <p className="mt-2 text-sm text-white/85 [text-shadow:0_2px_4px_#000]">Tu as traversé le Gabon, de la Lopé aux chutes de Kongou.</p>}
        </div>
      )}

      {paused && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-4 text-white">
          <p className="font-display text-2xl font-bold">PAUSE</p>
          <button type="button" onClick={togglePause} className="rounded-full bg-amber-400 px-6 py-2.5 text-sm font-bold text-black">
            Reprendre
          </button>
          <button type="button" onClick={() => quitRef.current?.()} className="flex items-center gap-1.5 rounded-full border border-white/40 px-5 py-2 text-sm">
            <X size={14} /> Abandonner la partie
          </button>
          <div className="mt-3 max-h-[50svh] w-[min(92%,26rem)] overflow-y-auto rounded-2xl bg-black/40 p-4 text-left">
            <PerlesHelp variant={HAS_MOUSE ? 'keyboard' : 'touch'} />
          </div>
        </div>
      )}
    </div>
  )
}

export default PerlesScreen
