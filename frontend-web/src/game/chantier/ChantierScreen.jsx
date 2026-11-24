import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowBigDownDash, ArrowLeft, ArrowRight, Pause, Play, RotateCw, Volume2, VolumeX, X } from 'lucide-react'
import { BARROWS, LEVELS, MAX_SOLIDITY, TICK_RATE, bricksOf, createGame, multiplier, step } from '../../../../shared/chantier-boma/engine.mjs'
import { createChantierRenderer } from './renderer.js'
import { BarrowIcon, LoadIcon } from './BrickIcon.jsx'
import ChantierHelp from './ChantierHelp.jsx'

const SIM_MS = 1000 / TICK_RATE
const HAS_MOUSE = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches
const INTRO_MS = 5000
const RESUME_MS = 2000 // "2, 1" before the bricks move again after a pause
const HOLD_MS = 190 // a held key or button repeats after this…
const REPEAT_MS = 55 // …and then this often
const TAP_MS = 280
const TAP_PX = 12
const FLICK_MS = 320
const FLICK_PX = 55
const KEYS = { ArrowLeft: 'L', ArrowRight: 'R', ArrowDown: 'S', ArrowUp: 'T', q: 'L', a: 'L', d: 'R', s: 'S', z: 'T', w: 'T', x: 'T', ' ': 'D', b: 'B' }
const REPEATS = ['L', 'R', 'S']

// One game of CHANTIER BOMA, full screen. Runs the shared simulation at a fixed
// 60 ticks/s and records the gestures that did something ([tick, action]);
// onEnd gets { inputs, endTick, claimed } for the server to replay.
function ChantierScreen({ seed, audio, muted, onToggleMute, onEnd }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const rendererRef = useRef(null)
  const stateRef = useRef(null)
  const queueRef = useRef([])
  const heldRef = useRef(null) // { action, source, at, loadId }: a key or a button kept down
  const dragRef = useRef(null)
  const pausedRef = useRef(false)
  const resumeRef = useRef(false)
  const onEndRef = useRef(onEnd)
  const quitRef = useRef(null)
  const pauseRef = useRef(null)
  const skipRef = useRef(null)
  const [hud, setHud] = useState(null)
  const [paused, setPaused] = useState(false)
  const [banner, setBanner] = useState(null)
  const [intro, setIntro] = useState(true)

  useEffect(() => {
    onEndRef.current = onEnd
  }, [onEnd])

  useEffect(() => {
    const wrap = wrapRef.current
    const renderer = createChantierRenderer(canvasRef.current)
    rendererRef.current = renderer
    const state = createGame(seed)
    stateRef.current = state
    const inputs = []
    let acc = 0
    let last = performance.now()
    let startAt = last + INTRO_MS
    let introOn = true
    let raf = 0
    let lastHud = 0
    let endedAt = 0
    let finished = false
    let bannerTimer = null

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
    skipRef.current = () => {
      if (introOn) startAt = performance.now()
    }

    function showBanner(title, subtitle, tone, ms) {
      setBanner({ title, subtitle, tone, key: performance.now() })
      clearTimeout(bannerTimer)
      bannerTimer = setTimeout(() => setBanner(null), ms)
    }

    function handleEvents() {
      renderer.handleEvents(state)
      for (const e of state.events) {
        if (e.type === 'turn') audio.play('turn')
        else if (e.type === 'drop') audio.play('drop')
        else if (e.type === 'landed') {
          const results = e.landed.map((s) => s.result)
          if (results.includes('broken')) {
            audio.play('broken')
            navigator.vibrate?.(90)
          } else if (results.includes('cracked')) {
            audio.play('crack')
            navigator.vibrate?.(40)
          } else audio.play('perfect', e.streak)
        } else if (e.type === 'barrow') audio.play('barrow')
        else if (e.type === 'barrowBack') audio.play('barrowBack')
        else if (e.type === 'level') {
          const lv = LEVELS[e.level]
          audio.play('level')
          showBanner(lv.name, `Bâtiment ${e.level + 1}/${LEVELS.length} · ${lv.subtitle}`, 'gold', 1700)
        } else if (e.type === 'clear') {
          audio.play('clear')
          const extra = e.masterpiece ? ' · 🏆 Chef-d’œuvre !' : e.timeBonus ? ' · bonus de vitesse' : ''
          showBanner('Bâtiment terminé !', `+${e.bonus.toLocaleString('fr-FR')} pts${extra}`, 'gold', 3200)
        } else if (e.type === 'collapse') {
          audio.play('collapse')
          navigator.vibrate?.([60, 40, 160])
          showBanner('Tout s’écroule !', 'Le bâtiment n’était plus assez solide.', 'red', 3000)
        }
      }
    }

    // The gestures for this tick. While a load settles, they wait for the next
    // one, except those that would push it down.
    function takeActions() {
      if (state.phase === 'build') return queueRef.current.splice(0, 8)
      queueRef.current = state.phase === 'settle' ? queueRef.current.filter((a) => a !== 'D' && a !== 'S').slice(0, 6) : []
      return []
    }

    // What a key or a button kept down asks for now.
    function heldAction(now) {
      const held = heldRef.current
      if (!held || now < held.at || !state.load) return null
      if (held.action === 'S' && held.loadId !== state.load?.id) return null // never pushes the next load down
      held.at = now + REPEAT_MS
      return held.action
    }

    function frame(now) {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(now - last, 250)
      last = now

      if (resumeRef.current) {
        resumeRef.current = false
        if (!introOn) startAt = now + RESUME_MS
      }
      if (pausedRef.current) startAt += dt
      else if (introOn && now >= startAt) {
        introOn = false
        setIntro(false)
        const lv = LEVELS[0]
        showBanner(lv.name, `Bâtiment 1/${LEVELS.length} · ${lv.subtitle}`, 'gold', 1700)
      }

      const running = now >= startAt && !pausedRef.current
      if (running && !state.over) {
        const repeat = heldAction(now)
        if (repeat) queueRef.current.push(repeat)
        acc += dt
        while (acc >= SIM_MS && !state.over) {
          const actions = takeActions()
          const { tick } = state
          step(state, actions)
          for (const a of state.applied) inputs.push([tick, a])
          if (state.applied.some((a) => a === 'L' || a === 'R')) audio.play('move')
          handleEvents()
          acc -= SIM_MS
        }
      } else if (!running) {
        acc = 0
        queueRef.current.length = 0
      }

      renderer.render(state, now / 1000, dt / 1000, !introOn)

      if (state.over && !endedAt) {
        endedAt = now
        audio.stopMusic()
        audio.play(state.won ? 'victory' : 'defeat')
      }
      if (endedAt && now - endedAt > 2400) finish()

      if (now - lastHud > 90) {
        lastHud = now
        const left = Math.ceil((startAt - now) / 1000)
        setHud({
          level: state.level,
          score: state.score,
          solidity: Math.max(0, state.solidity),
          barrows: state.barrows,
          streak: state.streak,
          done: state.bricks.length,
          total: bricksOf(state.level),
          next: state.next,
          countdown: !introOn && left > 0 ? left : 0,
          over: state.over,
          won: state.won,
        })
      }
    }
    raf = requestAnimationFrame(frame)
    audio.startMusic()

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      clearTimeout(bannerTimer)
      audio.stopMusic()
    }
  }, [seed, audio])

  function press(action, source) {
    audio.unlock()
    if (pausedRef.current) return
    queueRef.current.push(action)
    if (REPEATS.includes(action)) heldRef.current = { action, source, at: performance.now() + HOLD_MS, loadId: stateRef.current?.load?.id }
  }

  function release(source) {
    if (heldRef.current?.source === source) heldRef.current = null
  }

  function togglePause() {
    const next = !pausedRef.current
    pausedRef.current = next
    setPaused(next)
    heldRef.current = null
    dragRef.current = null
    if (next) audio.stopMusic()
    else {
      resumeRef.current = true
      audio.startMusic()
    }
  }

  useEffect(() => {
    pauseRef.current = { toggle: togglePause, press, release }
  })

  useEffect(() => {
    function down(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (key === 'Escape' || key === 'p') {
        if (!e.repeat) pauseRef.current?.toggle()
      } else if (KEYS[key]) {
        // Space on a focused button must not press it too.
        if (pausedRef.current) return
        if (!e.repeat) pauseRef.current?.press(KEYS[key], `key:${key}`)
      } else if (key === 'Enter' && !pausedRef.current) skipRef.current?.()
      else return
      e.preventDefault()
    }
    function up(e) {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      pauseRef.current?.release(`key:${key}`)
    }
    // Leaving the app (call, notification, other tab) pauses the game.
    function hidden() {
      if (document.hidden && !pausedRef.current && !stateRef.current?.over) pauseRef.current?.toggle()
    }
    function blur() {
      heldRef.current = null
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [])

  // On the site, a finger (or the mouse): slide sideways to move the bricks,
  // down to lower them, flick down to drop them, tap to turn them.
  function handlePointerDown(e) {
    audio.unlock()
    skipRef.current?.()
    if (pausedRef.current || intro || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, at: performance.now(), moved: false, loadId: stateRef.current?.load?.id }
  }
  function handlePointerMove(e) {
    const drag = dragRef.current
    if (!drag || drag.id !== e.pointerId || pausedRef.current) return
    const cell = Math.max(18, rendererRef.current.cellSize())
    while (Math.abs(e.clientX - drag.x) >= cell * 0.8) {
      const right = e.clientX > drag.x
      queueRef.current.push(right ? 'R' : 'L')
      drag.x += (right ? 1 : -1) * cell * 0.8
      drag.moved = true
    }
    // Downwards: only once it's clearly not a flick, and only this load.
    if (performance.now() - drag.at > FLICK_MS && drag.loadId === stateRef.current?.load?.id) {
      while (e.clientY - drag.y >= cell) {
        queueRef.current.push('S')
        drag.y += cell
        drag.moved = true
      }
    }
  }
  function handlePointerUp(e) {
    const drag = dragRef.current
    if (!drag || drag.id !== e.pointerId) return
    dragRef.current = null
    if (e.type !== 'pointerup' || pausedRef.current || drag.moved) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    const ms = performance.now() - drag.at
    if (dy > FLICK_PX && dy > Math.abs(dx) * 1.5 && ms < FLICK_MS) {
      if (drag.loadId === stateRef.current?.load?.id) queueRef.current.push('D')
    } else if (Math.hypot(dx, dy) < TAP_PX && ms < TAP_MS) queueRef.current.push('T')
  }

  const lv = hud ? LEVELS[hud.level] : LEVELS[0]
  const solidColor = !hud || hud.solidity > 55 ? 'bg-emerald-400' : hud.solidity > 25 ? 'bg-amber-400' : 'bg-red-500'

  function padButton(action, label, icon, className = 'bg-white/12') {
    const source = `pad:${action}`
    return (
      <button
        type="button"
        tabIndex={-1}
        aria-label={label}
        onPointerDown={(e) => {
          e.preventDefault()
          e.currentTarget.setPointerCapture?.(e.pointerId)
          press(action, source)
        }}
        onPointerUp={() => release(source)}
        onPointerCancel={() => release(source)}
        onContextMenu={(e) => e.preventDefault()}
        className={`flex h-14 flex-1 items-center justify-center rounded-2xl text-white ring-1 ring-white/15 transition active:brightness-150 ${className}`}
      >
        {icon}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[95] flex select-none flex-col bg-[#10182a] text-white" style={{ touchAction: 'none' }}>
      {/* HUD */}
      <div className="mx-auto flex w-full max-w-md shrink-0 items-center gap-2.5 px-3 pb-1.5 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-amber-200">
            {(hud?.level ?? 0) + 1}/{LEVELS.length} · {lv.name}
          </p>
          <p className="font-mono text-base font-bold leading-tight">
            {String(hud?.score ?? 0).padStart(5, '0')}
            {hud && multiplier(hud.streak) > 1 && <span className="ml-1.5 text-xs text-emerald-300">×{multiplier(hud.streak)}</span>}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="text-[10px] text-white/70">Solidité</span>
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-white/15"
              role="progressbar"
              aria-label="Solidité"
              aria-valuenow={hud?.solidity ?? MAX_SOLIDITY}
              aria-valuemin={0}
              aria-valuemax={MAX_SOLIDITY}
            >
              <div className={`h-full rounded-full transition-[width] duration-300 ${solidColor}`} style={{ width: `${hud?.solidity ?? 100}%` }} />
            </div>
            <span className="w-14 shrink-0 whitespace-nowrap text-right font-mono text-[10px] text-white/70">
              🧱 {hud?.done ?? 0}/{hud?.total ?? 0}
            </span>
          </div>
        </div>
        <div className="flex h-14 w-16 shrink-0 flex-col items-center rounded-xl bg-white/8 pt-0.5">
          <span className="text-[9px] uppercase tracking-wide text-white/60">Après</span>
          <span className="flex flex-1 items-center justify-center pb-1">{hud?.next ? <LoadIcon load={hud.next} size={12} /> : <span className="text-white/40">–</span>}</span>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button type="button" tabIndex={-1} onClick={onToggleMute} className="flex h-7 w-8 items-center justify-center rounded-full bg-white/12" aria-label={muted ? 'Activer le son' : 'Couper le son'}>
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <button type="button" tabIndex={-1} onClick={togglePause} className="flex h-7 w-8 items-center justify-center rounded-full bg-white/12" aria-label={paused ? 'Reprendre' : 'Pause'}>
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
        </div>
      </div>

      {/* The site */}
      <div
        ref={wrapRef}
        className="relative min-h-0 flex-1"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        <AnimatePresence>
          {banner && !intro && (
            <motion.div
              key={banner.key}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-x-0 top-[16%] px-4 text-center"
            >
              <div className="mx-auto inline-block rounded-2xl bg-black/65 px-5 py-2.5">
                <p className={`font-display text-2xl font-black ${banner.tone === 'red' ? 'text-red-300' : 'text-amber-300'}`}>{banner.title}</p>
                <p className="text-xs text-white/90">{banner.subtitle}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {hud?.countdown > 0 && !paused && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <motion.span key={hud.countdown} initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-8xl font-black drop-shadow-[0_6px_20px_rgba(0,0,0,0.8)]">
              {hud.countdown}
            </motion.span>
          </div>
        )}
      </div>

      {/* The controls */}
      <div className="mx-auto flex w-full max-w-md shrink-0 gap-2 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 [@media(max-height:480px)]:hidden">
        {padButton('L', 'À gauche', <ArrowLeft size={24} />)}
        {padButton('R', 'À droite', <ArrowRight size={24} />)}
        {padButton('T', 'Tourner', <RotateCw size={22} />, 'bg-sky-600/60')}
        {padButton('D', 'Lâcher', <ArrowBigDownDash size={24} />, 'bg-amber-600/75')}
        {padButton(
          'B',
          `Brouette : renvoyer ces briques, il en reste ${hud?.barrows ?? BARROWS}`,
          <span className="flex flex-col items-center leading-none">
            <BarrowIcon size={24} />
            <span className="mt-0.5 font-mono text-[10px]">
              {hud?.barrows ?? BARROWS}/{BARROWS}
            </span>
          </span>,
          hud && hud.barrows === 0 ? 'bg-white/12 opacity-40' : 'bg-white/12',
        )}
      </div>

      {/* Intro */}
      <AnimatePresence>
        {intro && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onPointerDown={() => skipRef.current?.()}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 px-4 text-center"
          >
            <p className="text-xs tracking-[0.3em] text-amber-300">CHANTIER BOMA</p>
            <p className="mt-2 font-display text-3xl font-black">Suis le plan !</p>
            <div className="mt-5 w-[min(94%,26rem)] rounded-2xl bg-black/50 p-4 text-left">
              <ChantierHelp variant={HAS_MOUSE ? 'keyboard' : 'touch'} />
            </div>
            <p className="mt-4 text-xs text-white/70">{HAS_MOUSE ? 'Entrée ou clic pour commencer' : 'Touche l’écran pour commencer'}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {paused && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-4">
          <p className="font-display text-2xl font-bold">PAUSE</p>
          <button type="button" onClick={togglePause} className="rounded-full bg-amber-400 px-6 py-2.5 text-sm font-bold text-black">
            Reprendre
          </button>
          <button type="button" onClick={() => quitRef.current?.()} className="flex items-center gap-1.5 rounded-full border border-white/40 px-5 py-2 text-sm">
            <X size={14} /> Abandonner la partie
          </button>
          <div className="mt-3 max-h-[50svh] w-[min(94%,26rem)] overflow-y-auto rounded-2xl bg-black/40 p-4 text-left" style={{ touchAction: 'pan-y' }}>
            <ChantierHelp variant="full" />
          </div>
        </div>
      )}
    </div>
  )
}

export default ChantierScreen
