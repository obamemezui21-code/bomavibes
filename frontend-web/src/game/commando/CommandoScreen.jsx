import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, ChevronUp, CircleHelp, Heart, Pause, Play, Volume2, VolumeX, X } from 'lucide-react'
import {
  CHARACTERS,
  MISSIONS,
  TICK_RATE,
  WEAPONS,
  createGame,
  step,
} from '../../../../shared/commando-okoume/engine.mjs'
import { ENEMY_SHEET, createCommandoRenderer, preloadBackdrop, preloadSprites } from './renderer.js'
import ControlsHelp from './ControlsHelp.jsx'

const SIM_MS = 1000 / TICK_RATE
// With a keyboard, the intro stays longer: it shows the keys.
const HAS_MOUSE = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches
const INTRO_MS = HAS_MOUSE ? 4500 : 2600
const LEFT_KEYS = new Set(['ArrowLeft', 'q', 'a', 'Q', 'A'])
const RIGHT_KEYS = new Set(['ArrowRight', 'd', 'D'])
const UP_KEYS = new Set(['ArrowUp', 'z', 'w', 'Z', 'W'])
const FIRE_KEYS = new Set(['j', 'x', 'J', 'X', 'Enter'])
const JUMP_KEYS = new Set([' ', 'k', 'K'])
const SPECIAL_KEYS = new Set(['l', 'c', 'L', 'C'])

const ITEM_TOASTS = {
  T: '🔫 Tir triple !',
  G: '💣 Lance-grenades !',
  M: '❤️ Trousse de soin',
  H: '🙌 Otage libéré ! +500',
  I: '🐘 Ivoire saisi ! +300',
}

// A touch button that sends `on` when pressed and `off` when let go.
function HoldButton({ on, off, label, className, children, onAction }) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId)
        onAction(on)
      }}
      onPointerUp={() => off && onAction(off)}
      onPointerCancel={() => off && onAction(off)}
      onContextMenu={(e) => e.preventDefault()}
      className={`flex select-none items-center justify-center rounded-full border-2 border-white/30 bg-black/35 font-display text-xs font-bold text-white backdrop-blur-sm active:bg-white/25 ${className}`}
      style={{ touchAction: 'none', WebkitUserSelect: 'none' }}
    >
      {children}
    </button>
  )
}

// One COMMANDO OKOUMÉ mission, full screen. Runs the shared simulation at a
// fixed 60 ticks/s and records every gesture with its tick; onEnd gets
// { inputs, endTick, claimed } for the server to replay.
function CommandoScreen({ seed, mission, options, audio, muted, onToggleMute, onEnd }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const pendingRef = useRef([])
  const pausedRef = useRef(false)
  const onEndRef = useRef(onEnd)
  const quitRef = useRef(null)
  const pauseRef = useRef(null)
  const [hud, setHud] = useState(null)
  const [paused, setPaused] = useState(false)
  const [toast, setToast] = useState(null)
  const [intro, setIntro] = useState(true)
  const info = MISSIONS[mission]
  const character = CHARACTERS[options.character]

  useEffect(() => {
    onEndRef.current = onEnd
  }, [onEnd])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const renderer = createCommandoRenderer(canvas)
    preloadBackdrop(MISSIONS[mission].theme) // ready by the end of the mission intro
    preloadSprites(options.character)
    preloadSprites(ENEMY_SHEET)
    const state = createGame(seed, mission, options)
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

    const resize = () => renderer.resize(wrap.clientWidth, wrap.clientHeight)
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)

    function finish() {
      if (finished) return
      finished = true
      audio.stopMusic()
      onEndRef.current({ inputs, endTick: state.tick, claimed: { score: state.score, completed: state.completed } })
    }
    quitRef.current = () => {
      state.over = true
      finish()
    }

    function showToast(text) {
      setToast({ text, key: performance.now() })
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => setToast(null), 1400)
    }

    function handleEvents() {
      renderer.handleEvents(state)
      for (const e of state.events) {
        if (e.type === 'shot') audio.play(e.weapon === 'grenade' ? 'grenade' : 'shot')
        else if (e.type === 'hit') audio.play('hit')
        else if (e.type === 'kill') audio.play('kill')
        else if (e.type === 'explosion') audio.play('explosion')
        else if (e.type === 'hurt') {
          audio.play('hurt')
          navigator.vibrate?.(80)
        } else if (e.type === 'jump') audio.play('jump')
        else if (e.type === 'item') {
          audio.play('pickup')
          showToast(ITEM_TOASTS[e.kind])
        } else if (e.type === 'special') {
          audio.play('special')
          showToast(e.character === 'mboumba' ? '💥 Charge commando !' : '🎯 Tir d’élite !')
        } else if (e.type === 'fall') showToast('Attention au vide !')
        else if (e.type === 'boss') {
          audio.play('boss')
          showToast(`⚠️ ${e.name.toUpperCase()}`)
        } else if (e.type === 'bossDown') {
          audio.play('explosion')
          showToast(`${e.name} est hors de combat !`)
        } else if (e.type === 'victory') audio.play('victory')
        else if (e.type === 'defeat') audio.play('defeat')
      }
    }

    function frame(now) {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(now - last, 250)
      last = now
      if (pausedRef.current) pausedFor += dt
      const running = now >= startAt + pausedFor && !pausedRef.current
      if (running && !state.over) {
        acc += dt
        while (acc >= SIM_MS && !state.over) {
          const actions = pendingRef.current.splice(0)
          for (const a of actions) inputs.push([state.tick, a])
          step(state, actions)
          handleEvents()
          acc -= SIM_MS
        }
      } else if (!running) {
        // Gestures made during the countdown or a pause still count once it resumes.
        acc = 0
      }
      renderer.render(state, now / 1000, dt / 1000)

      if (state.over && !endedAt) {
        endedAt = now
        audio.stopMusic()
      }
      if (endedAt && now - endedAt > 1600) finish()

      if (now - lastHud > 90) {
        lastHud = now
        const p = state.player
        setHud({
          hp: p.hp,
          maxHp: p.maxHp,
          weapon: WEAPONS[p.weapon].name,
          score: state.score,
          hostages: `${state.hostagesFreed}/${state.hostagesTotal}`,
          special: p.specialCooldown > 0 ? 1 - p.specialCooldown / CHARACTERS[state.character].cooldown : 1,
          boss: state.boss ? { name: state.boss.name, hp: state.boss.hp, max: state.boss.maxHp } : null,
          over: state.over,
          completed: state.completed,
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
  }, [seed, mission, options, audio])

  // Keyboard: ← → move, ↑ aim up, space jump, J fire, L special.
  useEffect(() => {
    const held = { left: false, right: false }
    const push = (a) => pendingRef.current.push(a)
    const moveFromHeld = () => push(held.left && !held.right ? 'L' : held.right && !held.left ? 'R' : 'S')
    function down(e) {
      if (e.repeat) return
      if (LEFT_KEYS.has(e.key)) {
        held.left = true
        moveFromHeld()
      } else if (RIGHT_KEYS.has(e.key)) {
        held.right = true
        moveFromHeld()
      } else if (UP_KEYS.has(e.key)) push('U')
      else if (FIRE_KEYS.has(e.key)) push('F')
      else if (JUMP_KEYS.has(e.key)) push('J')
      else if (SPECIAL_KEYS.has(e.key)) push('P')
      else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') pauseRef.current?.()
      else return
      e.preventDefault()
      audio.unlock()
    }
    function up(e) {
      if (LEFT_KEYS.has(e.key)) {
        held.left = false
        moveFromHeld()
      } else if (RIGHT_KEYS.has(e.key)) {
        held.right = false
        moveFromHeld()
      } else if (UP_KEYS.has(e.key)) push('u')
      else if (FIRE_KEYS.has(e.key)) push('f')
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

  // The keyboard handler (Échap / P) reaches the latest pause toggle through this ref.
  useEffect(() => {
    pauseRef.current = togglePause
  })

  // Mouse: hold the left button anywhere on the game to fire.
  function handleMouseDown(e) {
    if (e.pointerType !== 'mouse' || e.button !== 0 || paused) return
    audio.unlock()
    pendingRef.current.push('F')
  }
  function handleMouseUp(e) {
    if (e.pointerType === 'mouse' && e.button === 0) pendingRef.current.push('f')
  }

  function press(action) {
    audio.unlock()
    pendingRef.current.push(action)
  }

  return (
    <div className="fixed inset-0 z-[95] select-none bg-black" style={{ touchAction: 'none' }}>
      <div ref={wrapRef} className="absolute inset-0" onPointerDown={handleMouseDown} onPointerUp={handleMouseUp} onContextMenu={(e) => e.preventDefault()}>
        <canvas ref={canvasRef} className="h-full w-full" style={{ imageRendering: 'pixelated' }} />
      </div>

      {/* HUD */}
      {hud && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] font-mono text-white">
          <div className="space-y-1">
            <div className="flex gap-0.5">
              {Array.from({ length: hud.maxHp }).map((_, i) => (
                <Heart key={i} size={15} fill={i < hud.hp ? '#e74c3c' : 'transparent'} className={i < hud.hp ? 'text-red-400' : 'text-white/40'} />
              ))}
            </div>
            <p className="text-[11px] [text-shadow:0_1px_2px_#000]">
              {hud.weapon} · Otages {hud.hostages}
            </p>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/20" title={character.special}>
              <div className={`h-full ${hud.special >= 1 ? 'bg-cyan-300' : 'bg-white/60'}`} style={{ width: `${hud.special * 100}%` }} />
            </div>
          </div>
          <p className="text-sm font-bold [text-shadow:0_1px_2px_#000]">{String(hud.score).padStart(6, '0')}</p>
          <div className="pointer-events-auto flex gap-1.5">
            <button type="button" onClick={onToggleMute} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40" aria-label={muted ? 'Activer le son' : 'Couper le son'}>
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <button
              type="button"
              onClick={() => !paused && togglePause()}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40"
              aria-label="Comment jouer"
            >
              <CircleHelp size={15} />
            </button>
            <button type="button" onClick={togglePause} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40" aria-label={paused ? 'Reprendre' : 'Pause'}>
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
          </div>
        </div>
      )}
      {hud?.boss && hud.boss.hp > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-[max(3.25rem,calc(env(safe-area-inset-top)+2.75rem))] mx-auto w-[min(70%,22rem)] text-center font-mono text-white">
          <p className="text-[11px] font-bold tracking-widest text-red-300 [text-shadow:0_1px_2px_#000]">{hud.boss.name.toUpperCase()}</p>
          <div className="mt-1 h-2 overflow-hidden rounded-full border border-white/40 bg-black/50">
            <div className="h-full bg-gradient-to-r from-red-600 to-orange-400" style={{ width: `${(hud.boss.hp / hud.boss.max) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Mission intro */}
      <AnimatePresence>
        {intro && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/55 text-center font-mono text-white"
          >
            <p className="text-xs tracking-[0.3em] text-amber-300">MISSION {info.id} · {info.place.toUpperCase()}</p>
            <p className="mt-2 font-display text-3xl font-bold">{info.name}</p>
            <p className="mt-1 text-sm text-white/80">{info.goal}</p>
            <p className="mt-4 text-xs text-white/60">{character.name} · {character.corps}</p>
            {HAS_MOUSE && (
              <div className="mt-5 w-[min(92%,26rem)] rounded-2xl bg-black/50 p-4 text-left">
                <ControlsHelp variant="keyboard" character={options.character} />
              </div>
            )}
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
            className="pointer-events-none absolute inset-x-0 top-1/4 text-center font-mono text-lg font-bold text-amber-200 [text-shadow:0_2px_4px_#000]"
          >
            {toast.text}
          </motion.p>
        )}
      </AnimatePresence>

      {hud?.over && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className={`font-display text-4xl font-bold [text-shadow:0_3px_8px_#000] ${hud.completed ? 'text-amber-300' : 'text-red-400'}`}>
            {hud.completed ? 'MISSION ACCOMPLIE' : 'MISSION ÉCHOUÉE'}
          </p>
        </div>
      )}

      {paused && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 font-mono text-white">
          <p className="font-display text-2xl font-bold">PAUSE</p>
          <button type="button" onClick={togglePause} className="rounded-full bg-amber-400 px-6 py-2.5 text-sm font-bold text-black">
            Reprendre
          </button>
          <button type="button" onClick={() => quitRef.current?.()} className="flex items-center gap-1.5 rounded-full border border-white/40 px-5 py-2 text-sm">
            <X size={14} /> Abandonner la mission
          </button>
          <div className="mt-3 max-h-[50svh] w-[min(92%,26rem)] overflow-y-auto rounded-2xl bg-black/40 p-4 text-left">
            {HAS_MOUSE ? (
              <ControlsHelp variant="keyboard" character={options.character} />
            ) : (
              <p className="text-xs text-white/80">
                Croix à gauche pour bouger et viser en haut, <b>TIR</b> (garder appuyé), <b>SAUT</b> et <b>SPÉ</b> pour le pouvoir spécial.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Touch controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-4 pb-[max(1rem,env(safe-area-inset-bottom))] [@media(pointer:fine)]:hidden">
        <div className="pointer-events-auto grid grid-cols-3 grid-rows-2 gap-1.5">
          <span />
          <HoldButton onAction={press} on="U" off="u" label="Viser en haut" className="h-12 w-12">
            <ChevronUp size={22} />
          </HoldButton>
          <span />
          <HoldButton onAction={press} on="L" off="S" label="Gauche" className="h-12 w-12">
            <ChevronLeft size={22} />
          </HoldButton>
          <span />
          <HoldButton onAction={press} on="R" off="S" label="Droite" className="h-12 w-12">
            <ChevronRight size={22} />
          </HoldButton>
        </div>
        <div className="pointer-events-auto flex items-end gap-2">
          <HoldButton onAction={press} on="P" label={character.special} className="mb-14 h-11 w-11 border-cyan-300/60 text-[9px]">
            SPÉ
          </HoldButton>
          <HoldButton onAction={press} on="F" off="f" label="Tirer" className="h-16 w-16 border-red-300/60 bg-red-500/30">
            TIR
          </HoldButton>
          <HoldButton onAction={press} on="J" label="Sauter" className="mb-10 h-14 w-14 border-amber-300/60 bg-amber-500/25">
            SAUT
          </HoldButton>
        </div>
      </div>
    </div>
  )
}

export default CommandoScreen
