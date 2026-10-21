import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Pause, Play, Volume2, VolumeX, X } from 'lucide-react'
import { FP, H, JETS, KINDS, TICK_RATE, W, ZONES, bossOf, createGame, step, zoneAt } from '../../../../shared/escadrille-ogooue/engine.mjs'
import { createEscadrilleRenderer, preloadArt } from './renderer.js'
import EscadrilleHelp from './EscadrilleHelp.jsx'

const SIM_MS = 1000 / TICK_RATE
const HAS_MOUSE = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches
const INTRO_MS = HAS_MOUSE ? 4000 : 3500
const TOUCH_SPEED = 1.3 // a finger's drag moves the jet a little more than the finger
const SEND_EVERY = 2 // the jet's target point is recorded at most every 2 ticks (see validateInputs)
const KEY_DIRS = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  z: [0, -1],
  w: [0, -1],
  s: [0, 1],
  q: [-1, 0],
  a: [-1, 0],
  d: [1, 0],
}
const BOMB_KEYS = new Set([' ', 'b', 'B', 'x', 'X'])
const KILL_SOUND = { drone: 'smallBoom', avion: 'boom', helico: 'boom', vedette: 'boom', tourelle: 'boom', boss: 'bigBoom' }

// One sortie of ESCADRILLE OGOUÉ, full screen. Runs the shared simulation at
// a fixed 60 ticks/s and records where the jet heads ([tick, x, y], at most
// every SEND_EVERY ticks) and the bombs ([tick, 'B']); onEnd gets
// { inputs, endTick, claimed } for the server to replay.
function EscadrilleScreen({ seed, options, audio, muted, onToggleMute, onEnd }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const bombRef = useRef(false)
  const pausedRef = useRef(false)
  const onEndRef = useRef(onEnd)
  const quitRef = useRef(null)
  const pauseRef = useRef(null)
  const targetRef = useRef(null) // where the player wants the jet, in world units
  const keysRef = useRef(new Set())
  const dragRef = useRef(null)
  const rendererRef = useRef(null)
  const stateRef = useRef(null)
  const [hud, setHud] = useState(null)
  const [paused, setPaused] = useState(false)
  const [banner, setBanner] = useState(null)
  const [intro, setIntro] = useState(true)
  const jet = JETS[options.jet] || JETS.aigle

  useEffect(() => {
    onEndRef.current = onEnd
  }, [onEnd])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const renderer = createEscadrilleRenderer(canvas)
    preloadArt()
    rendererRef.current = renderer
    const state = createGame(seed, options)
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
    let sent = { tick: -SEND_EVERY, x: -1, y: -1 }
    let zone = -1

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

    // Where the jet should head this tick: the keys push it, else the mouse
    // or the finger's point.
    function desired() {
      let dx = 0
      let dy = 0
      for (const key of keysRef.current) {
        const dir = KEY_DIRS[key]
        if (dir) {
          dx += dir[0]
          dy += dir[1]
        }
      }
      if (dx || dy) {
        const p = state.player
        targetRef.current = null
        return { x: p.x / FP + Math.sign(dx) * 40, y: p.y / FP + Math.sign(dy) * 40 }
      }
      return targetRef.current
    }

    function handleEvents() {
      renderer.handleEvents(state)
      for (const e of state.events) {
        if (e.type === 'kill') audio.play(KILL_SOUND[e.kind])
        else if (e.type === 'bonus') audio.play(e.kind === 'power' ? 'power' : e.kind === 'ngori' ? 'coin' : 'bonus')
        else if (e.type === 'hurt') {
          audio.play('hurt')
          navigator.vibrate?.(90)
        } else if (e.type === 'down') audio.play('bigBoom')
        else if (e.type === 'bomb') {
          audio.play('bomb')
          navigator.vibrate?.([40, 30, 80])
        } else if (e.type === 'boss') {
          audio.play('alarm')
          showBanner('⚠️ ALERTE', 'Le Condor Noir, forteresse volante du Serpent Noir !', 'red', 3200)
        } else if (e.type === 'bossStage') audio.play('stage')
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
          const want = desired()
          if (want && state.tick - sent.tick >= SEND_EVERY) {
            const x = Math.max(0, Math.min(W, Math.round(want.x)))
            const y = Math.max(0, Math.min(H, Math.round(want.y)))
            if (x !== sent.x || y !== sent.y) {
              sent = { tick: state.tick, x, y }
              actions.push([x, y])
            }
          }
          if (bombRef.current) {
            bombRef.current = false
            if (state.bombs > 0 && state.bombing === 0) actions.push(['B'])
          }
          for (const a of actions) inputs.push([state.tick, ...a])
          const shots = state.shots.length
          step(state, actions)
          if (state.shots.length > shots) audio.play('shot')
          handleEvents()
          const z = zoneAt(state.tick)
          if (z !== zone && !state.bossSpawned) {
            zone = z
            showBanner(ZONES[z].name, z ? 'Nouvelle zone' : 'Décollage ! Protège le ciel du Gabon.', 'sky')
          }
          acc -= SIM_MS
        }
      } else if (!running) {
        acc = 0
        bombRef.current = false
      }

      renderer.render(state, time)

      if (state.over && !endedAt) {
        endedAt = now
        audio.stopMusic()
        audio.play(state.won ? 'victory' : 'defeat')
      }
      if (endedAt && now - endedAt > 2600) finish()

      if (now - lastHud > 90) {
        lastHud = now
        const boss = bossOf(state)
        setHud({
          hp: Math.max(0, state.hp),
          bombs: state.bombs,
          power: state.power,
          score: state.score,
          combo: state.combo,
          boss: boss ? boss.hp / KINDS.boss.hp : null,
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
  }, [seed, options, audio])

  // Keyboard: arrows / ZQSD / WASD fly, space / B / X bomb, Échap / P pause.
  useEffect(() => {
    function down(e) {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (KEY_DIRS[key]) keysRef.current.add(key)
      else if (BOMB_KEYS.has(e.key)) {
        if (!e.repeat) bombRef.current = true
      } else if (e.key === 'Escape' || key === 'p') {
        if (!e.repeat) pauseRef.current?.()
      } else return
      e.preventDefault()
      audio.unlock()
    }
    function up(e) {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      keysRef.current.delete(key)
    }
    function blur() {
      keysRef.current.clear()
    }
    // Leaving the app (call, notification, other tab) pauses the sortie.
    function hidden() {
      if (document.hidden && !pausedRef.current && !stateRef.current?.over) pauseRef.current?.()
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
    return { x: Math.max(0, Math.min(W, p.x)), y: Math.max(0, Math.min(H, p.y)) }
  }

  function localPoint(e) {
    const rect = wrapRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  // Mouse: the jet follows the pointer, right click drops a bomb.
  // Touch: dragging anywhere moves the jet by as much as the finger moves.
  function handlePointerDown(e) {
    audio.unlock()
    if (e.pointerType === 'mouse') {
      const p = localPoint(e)
      targetRef.current = clamp(rendererRef.current.toWorld(p.x, p.y))
      if (e.button === 2) bombRef.current = true
      return
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const jetAt = stateRef.current.player
    dragRef.current = { id: e.pointerId, ...localPoint(e), base: { x: jetAt.x / FP, y: jetAt.y / FP } }
  }
  function handlePointerMove(e) {
    if (e.pointerType === 'mouse') {
      const p = localPoint(e)
      targetRef.current = clamp(rendererRef.current.toWorld(p.x, p.y))
      return
    }
    const drag = dragRef.current
    if (!drag || drag.id !== e.pointerId) return
    const p = localPoint(e)
    const sc = rendererRef.current.scale()
    targetRef.current = clamp({ x: drag.base.x + ((p.x - drag.x) / sc) * TOUCH_SPEED, y: drag.base.y + ((p.y - drag.y) / sc) * TOUCH_SPEED })
  }
  function handlePointerUp(e) {
    if (dragRef.current?.id === e.pointerId) dragRef.current = null
  }

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
        <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto max-w-md px-3 pt-[max(0.5rem,env(safe-area-inset-top))] font-mono text-white">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <div className="flex gap-0.5">
                {Array.from({ length: jet.hp }).map((_, i) => (
                  <Heart key={i} size={15} fill={i < hud.hp ? '#e74c3c' : 'transparent'} className={i < hud.hp ? 'text-red-400' : 'text-white/40'} />
                ))}
              </div>
              <div className="flex items-center gap-1 text-[11px] [text-shadow:0_1px_2px_#000]">
                <span className="text-white/70">CANONS</span>
                {[1, 2, 3, 4].map((n) => (
                  <span key={n} className={`inline-block h-2 w-2.5 rounded-sm ${n <= hud.power ? 'bg-red-400' : 'bg-white/20'}`} />
                ))}
              </div>
            </div>
            <div className="text-center [text-shadow:0_1px_2px_#000]">
              <p className="text-sm font-bold">{String(hud.score).padStart(6, '0')}</p>
              {hud.combo >= 10 && <p className="text-[11px] font-bold text-amber-300">COMBO ×{1 + Math.min(4, Math.floor(hud.combo / 10))}</p>}
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
          {hud.boss !== null && (
            <div className="mt-2">
              <p className="text-center text-[10px] font-bold tracking-[0.2em] text-red-300 [text-shadow:0_1px_2px_#000]">CONDOR NOIR</p>
              <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-black/50 ring-1 ring-red-400/40">
                <div className="h-full bg-gradient-to-r from-red-600 to-orange-400 transition-[width]" style={{ width: `${Math.max(0, hud.boss) * 100}%` }} />
              </div>
            </div>
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
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/60 px-4 text-center font-mono text-white"
          >
            <p className="text-xs tracking-[0.3em] text-sky-300">ESCADRILLE OGOUÉ</p>
            <p className="mt-2 font-display text-3xl font-bold">Chasseur {jet.name}</p>
            <p className="mt-1 text-sm text-white/80">Traverse le Gabon et abats le Condor Noir.</p>
            <div className="mt-5 w-[min(92%,26rem)] rounded-2xl bg-black/50 p-4 text-left">
              <EscadrilleHelp variant={HAS_MOUSE ? 'keyboard' : 'touch'} />
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
            className="pointer-events-none absolute inset-x-0 top-[30%] px-4 text-center font-mono [text-shadow:0_2px_6px_#000]"
          >
            <p className={`font-display text-3xl font-bold ${banner.tone === 'red' ? 'text-red-400' : 'text-sky-200'}`}>{banner.title}</p>
            <p className="mt-1 text-sm text-white/90">{banner.subtitle}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {hud?.over && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <p className={`font-display text-4xl font-bold [text-shadow:0_3px_8px_#000] ${hud.won ? 'text-amber-300' : 'text-red-400'}`}>
            {hud.won ? 'MISSION ACCOMPLIE' : 'ABATTU !'}
          </p>
          {!hud.won && <p className="mt-2 text-sm text-white/85 [text-shadow:0_2px_4px_#000]">Ton pilote s’est éjecté, il est sain et sauf.</p>}
        </div>
      )}

      {paused && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-4 font-mono text-white">
          <p className="font-display text-2xl font-bold">PAUSE</p>
          <button type="button" onClick={togglePause} className="rounded-full bg-sky-400 px-6 py-2.5 text-sm font-bold text-black">
            Reprendre
          </button>
          <button type="button" onClick={() => quitRef.current?.()} className="flex items-center gap-1.5 rounded-full border border-white/40 px-5 py-2 text-sm">
            <X size={14} /> Abandonner la mission
          </button>
          <div className="mt-3 max-h-[50svh] w-[min(92%,26rem)] overflow-y-auto rounded-2xl bg-black/40 p-4 text-left">
            <EscadrilleHelp variant={HAS_MOUSE ? 'keyboard' : 'touch'} />
          </div>
        </div>
      )}

      {/* Touch: the bomb button */}
      {hud && (
        <div className="pointer-events-none absolute bottom-0 right-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] [@media(pointer:fine)]:hidden">
          <button
            type="button"
            aria-label="Lâcher une bombe"
            onPointerDown={(e) => {
              e.stopPropagation()
              audio.unlock()
              bombRef.current = true
            }}
            onContextMenu={(e) => e.preventDefault()}
            disabled={hud.bombs === 0}
            className="pointer-events-auto flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 border-orange-300/70 bg-orange-500/35 font-display text-[10px] font-bold text-white backdrop-blur-sm active:bg-orange-400/60 disabled:opacity-40"
            style={{ touchAction: 'none' }}
          >
            <span className="text-lg leading-none">💣</span>
            BOMBE ×{hud.bombs}
          </button>
        </div>
      )}
      {hud && (
        <p className="pointer-events-none absolute bottom-3 right-4 hidden font-mono text-xs text-white/80 [text-shadow:0_1px_2px_#000] [@media(pointer:fine)]:block">
          💣 ×{hud.bombs} <span className="text-white/50">(Espace)</span>
        </p>
      )}
    </div>
  )
}

export default EscadrilleScreen
