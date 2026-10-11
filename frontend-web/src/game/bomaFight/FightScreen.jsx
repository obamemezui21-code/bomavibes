import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Pause, Play, Shield, Volume2, VolumeX, Zap } from 'lucide-react'
import { FIGHTERS, MAX_ENERGY, ROUND_TICKS, TICK_RATE, createFight, step } from '../../../../shared/boma-fight/engine.mjs'
import { LOOKS, createFightRenderer } from './renderer.js'
import { SPRITES } from './portraits.js'

const SIM_MS = 1000 / TICK_RATE
const CONTROLS_H = 190 // px kept under the floor for the buttons
const MOVE_KEYS = { ArrowLeft: -1, q: -1, a: -1, ArrowRight: 1, d: 1 }
const ATTACK_KEYS = { j: 'P', k: 'K', i: 'X', ' ': 'X' }
const GUARD_KEYS = new Set(['l', 'Shift', 'ArrowDown', 's'])

// The fighter's face, zoomed in on their cut-out.
function FaceBadge({ fighter, className = '' }) {
  const look = LOOKS[fighter]
  const zoom = 3.3
  const y = Math.max(0, Math.min(1, (look.face - 0.5 / zoom) / (1 - 1 / zoom)))
  return (
    <span
      className={`block shrink-0 bg-gradient-to-b from-amber-200/40 to-violet-900/60 bg-no-repeat ring-2 ring-white/70 ${className}`}
      style={{ backgroundImage: `url(${SPRITES[fighter]})`, backgroundSize: `auto ${zoom * 100}%`, backgroundPosition: `${look.cx * 100}% ${y * 100}%` }}
    />
  )
}

function HealthBar({ fighter, hp, maxHp, energy, wins, side }) {
  const right = side === 'right'
  const share = Math.max(0, hp / maxHp)
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${right ? 'flex-row-reverse' : ''}`}>
      <FaceBadge fighter={fighter} className="h-11 w-11 rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className={`flex items-center gap-1.5 ${right ? 'flex-row-reverse' : ''}`}>
          <p className="truncate font-display text-sm font-bold uppercase leading-none">{FIGHTERS[fighter].name}</p>
          <span className="flex gap-0.5">
            {[0, 1].map((i) => (
              <span key={i} className={`h-2 w-2 rounded-full ${i < wins ? 'bg-amber-300' : 'bg-white/25'}`} />
            ))}
          </span>
        </div>
        <div className="mt-1 h-3 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/30">
          <div
            className={`h-full transition-[width] duration-150 ${share > 0.5 ? 'bg-emerald-400' : share > 0.25 ? 'bg-amber-400' : 'bg-rose-500'} ${right ? 'ml-auto' : ''}`}
            style={{ width: `${share * 100}%` }}
          />
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/50">
          <div
            className={`h-full ${energy >= MAX_ENERGY ? 'animate-pulse bg-cyan-300' : 'bg-cyan-500/80'} ${right ? 'ml-auto' : ''}`}
            style={{ width: `${(energy / MAX_ENERGY) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function HoldButton({ onDown, onUp, className, children, label }) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture?.(e.pointerId)
        onDown()
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
      className={`flex select-none items-center justify-center rounded-full font-display font-black shadow-lg transition active:scale-95 ${className}`}
    >
      {children}
    </button>
  )
}

const BANNERS = {
  fight: 'COMBATTEZ !',
  ko: 'K.O. !',
  time: 'TEMPS !',
  draw: 'ÉGALITÉ',
  perfect: 'PARFAIT !',
}

// One BOMA FIGHT match, full screen. Runs the shared simulation at a fixed
// 60 ticks/s and records every gesture with its tick; onEnd gets
// { inputs, endTick, claimed } for the server to replay.
//
// Controls: ◀ ▶ to move, POING, PIED, GARDE (held) and SPÉCIAL when the
// energy bar is full. Keyboard: ← →, J punch, K kick, L guard, I / space special.
function FightScreen({ seed, fighter, level, stage, audio, muted, onToggleMute, onEnd }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const pendingRef = useRef([])
  const pausedRef = useRef(false)
  const onEndRef = useRef(onEnd)
  const endRef = useRef(null)
  const moveRef = useRef({ keys: [], buttons: [], current: 0 })
  const guardRef = useRef({ key: false, button: false, current: false })
  const [hud, setHud] = useState(() => {
    const s = createFight(seed, fighter, level)
    return { fighters: s.fighters.map((f) => ({ id: f.id, hp: f.hp, maxHp: f.maxHp, energy: 0 })), wins: [0, 0], clock: ROUND_TICKS, round: 1 }
  })
  const [banner, setBanner] = useState(null)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    onEndRef.current = onEnd
  }, [onEnd])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const renderer = createFightRenderer(canvas, { stage })
    const state = createFight(seed, fighter, level)
    const inputs = []
    let prev = state.fighters.map((f) => f.x)
    let acc = 0
    let last = performance.now()
    let raf = 0
    let lastHud = 0
    let ended = false
    let endTimer = null
    let bannerTimer = null

    function resize() {
      renderer.resize(wrap.clientWidth, wrap.clientHeight, CONTROLS_H)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)

    function showBanner(text, ms = 1100) {
      setBanner({ text, key: performance.now() })
      clearTimeout(bannerTimer)
      bannerTimer = setTimeout(() => setBanner(null), ms)
    }

    function finish() {
      if (ended) return
      ended = true
      audio.stopMusic()
      onEndRef.current({ inputs, endTick: state.tick, claimed: { winner: state.winner, wins: [...state.wins] } })
    }
    endRef.current = () => {
      state.over = true
      finish()
    }

    function handleEvents() {
      for (const e of state.events) {
        if (e.type === 'hit') {
          renderer.hit(e, 1 - e.who)
          audio.play(e.guarded ? 'shield' : e.move === 'special' ? 'crash' : e.move === 'kick' ? 'slide' : 'lane')
          if (!e.guarded && e.who === 1 && navigator.vibrate) navigator.vibrate(e.move === 'special' ? 120 : 40)
        } else if (e.type === 'special') {
          audio.play('powerup')
          showBanner(FIGHTERS[state.fighters[e.who].id].special.toUpperCase(), 900)
        } else if (e.type === 'fight') {
          showBanner(BANNERS.fight, 800)
          audio.say('Combattez !')
        } else if (e.type === 'round') {
          showBanner(`ROUND ${e.round}`, 1400)
          audio.play('district')
        } else if (e.type === 'round-end') {
          const text = e.winner === -1 ? BANNERS.draw : e.perfect ? BANNERS.perfect : e.ko ? BANNERS.ko : BANNERS.time
          showBanner(text, 1600)
          audio.play(e.winner === 0 ? 'bonus' : 'crash')
          if (e.ko) audio.say(e.perfect ? 'Parfait !' : 'K.O. !')
        } else if (e.type === 'over') {
          showBanner(e.winner === 0 ? 'VICTOIRE !' : e.winner === 1 ? 'DÉFAITE' : 'MATCH NUL', 2000)
        }
      }
    }

    function frame(now) {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(now - last, 250)
      last = now
      if (!pausedRef.current && !state.over) {
        acc += dt
        while (acc >= SIM_MS && !state.over) {
          prev = state.fighters.map((f) => f.x)
          const actions = pendingRef.current.splice(0)
          for (const a of actions) inputs.push([state.tick, a])
          step(state, actions)
          handleEvents()
          acc -= SIM_MS
        }
      } else {
        pendingRef.current.length = 0
      }
      renderer.render(state, { alpha: state.over ? 1 : acc / SIM_MS, prev, time: now / 1000 })

      if (now - lastHud > 80) {
        lastHud = now
        setHud({
          fighters: state.fighters.map((f) => ({ id: f.id, hp: f.hp, maxHp: f.maxHp, energy: f.energy })),
          wins: [...state.wins],
          clock: state.clock,
          round: state.round,
        })
      }
      if (state.over && !ended && !endTimer) {
        // Let "VICTOIRE !" show for a moment.
        endTimer = setTimeout(finish, 1600)
      }
    }
    showBanner('ROUND 1', 1400)
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
      clearTimeout(bannerTimer)
      clearTimeout(endTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      audio.stopMusic()
      renderer.dispose()
    }
  }, [seed, fighter, level, stage, audio])

  // Moving is held: the latest key or button pressed wins; a gesture is
  // recorded only when the direction actually changes.
  function updateMove() {
    const m = moveRef.current
    const want = m.keys.length ? m.keys[m.keys.length - 1] : m.buttons.length ? m.buttons[m.buttons.length - 1] : 0
    if (want === m.current || pausedRef.current) return
    m.current = want
    pendingRef.current.push(want === 0 ? 'S' : want < 0 ? 'L' : 'R')
  }
  function updateGuard() {
    const g = guardRef.current
    const want = g.key || g.button
    if (want === g.current || pausedRef.current) return
    g.current = want
    pendingRef.current.push(want ? 'B' : 'U')
  }
  function moveButton(dir, down) {
    const m = moveRef.current
    m.buttons = m.buttons.filter((d) => d !== dir)
    if (down) m.buttons.push(dir)
    updateMove()
  }
  function attack(action) {
    if (!pausedRef.current) pendingRef.current.push(action)
  }

  function togglePause() {
    const next = !pausedRef.current
    pausedRef.current = next
    setPaused(next)
    if (next) {
      moveRef.current = { keys: [], buttons: [], current: 0 }
      guardRef.current = { key: false, button: false, current: false }
      pendingRef.current.push('S', 'U')
      audio.stopMusic()
    } else {
      audio.startMusic()
    }
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape' || e.key === 'p') return togglePause()
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (ATTACK_KEYS[key]) {
        e.preventDefault()
        if (!e.repeat) attack(ATTACK_KEYS[key])
      } else if (GUARD_KEYS.has(key)) {
        e.preventDefault()
        guardRef.current.key = true
        updateGuard()
      } else if (MOVE_KEYS[key]) {
        e.preventDefault()
        const keys = moveRef.current.keys
        if (!keys.includes(MOVE_KEYS[key])) keys.push(MOVE_KEYS[key])
        updateMove()
      }
    }
    function onKeyUp(e) {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (GUARD_KEYS.has(key)) {
        guardRef.current.key = false
        updateGuard()
      } else if (MOVE_KEYS[key]) {
        moveRef.current.keys = moveRef.current.keys.filter((k) => k !== MOVE_KEYS[key])
        updateMove()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [me, cpu] = hud.fighters
  const specialReady = me.energy >= MAX_ENERGY
  const seconds = Math.max(0, Math.ceil(hud.clock / TICK_RATE))

  return (
    <div className="fixed inset-0 z-[90] select-none overflow-hidden bg-black text-white" style={{ touchAction: 'none' }}>
      <div ref={wrapRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 px-3 pt-[max(0.6rem,env(safe-area-inset-top))]">
        <div className="flex items-start gap-2">
          <HealthBar fighter={me.id} hp={me.hp} maxHp={me.maxHp} energy={me.energy} wins={hud.wins[0]} side="left" />
          <div className="mt-0.5 flex w-14 shrink-0 flex-col items-center rounded-2xl bg-black/45 py-1 backdrop-blur-md">
            <span className="font-display text-2xl font-black leading-none tabular-nums">{seconds}</span>
            <span className="mt-0.5 text-[10px] font-bold uppercase text-white/70">Round {hud.round}</span>
          </div>
          <HealthBar fighter={cpu.id} hp={cpu.hp} maxHp={cpu.maxHp} energy={cpu.energy} wins={hud.wins[1]} side="right" />
        </div>
      </div>

      <div className="absolute left-1/2 top-[calc(max(0.6rem,env(safe-area-inset-top))+4.2rem)] flex -translate-x-1/2 gap-2">
        <button
          type="button"
          onClick={togglePause}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"
          aria-label={paused ? 'Reprendre' : 'Pause'}
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <button
          type="button"
          onClick={onToggleMute}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"
          aria-label={muted ? 'Activer le son' : 'Couper le son'}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>

      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner.key}
            initial={{ opacity: 0, scale: 1.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
            className="pointer-events-none absolute inset-x-0 top-[30%] px-4 text-center"
          >
            <span className="font-display text-5xl font-black italic tracking-tight text-amber-200 drop-shadow-[0_6px_18px_rgba(236,72,153,0.8)]">
              {banner.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div
        className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6"
        style={{ height: CONTROLS_H }}
      >
        <div className="flex gap-3 pb-6">
          <HoldButton label="Reculer / avancer à gauche" onDown={() => moveButton(-1, true)} onUp={() => moveButton(-1, false)} className="h-16 w-16 bg-white/20 backdrop-blur-md">
            <ChevronLeft size={34} />
          </HoldButton>
          <HoldButton label="Avancer / reculer à droite" onDown={() => moveButton(1, true)} onUp={() => moveButton(1, false)} className="h-16 w-16 bg-white/20 backdrop-blur-md">
            <ChevronRight size={34} />
          </HoldButton>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <HoldButton
            label="Spécial"
            onDown={() => attack('X')}
            onUp={() => {}}
            className={`col-span-2 h-12 text-sm tracking-wide ${specialReady ? 'animate-pulse bg-gradient-to-r from-amber-300 to-pink-500 text-violet-950' : 'bg-white/10 text-white/40'}`}
          >
            <Zap size={16} className="mr-1" fill="currentColor" /> SPÉCIAL
          </HoldButton>
          <HoldButton label="Poing" onDown={() => attack('P')} onUp={() => {}} className="h-16 w-16 bg-gradient-to-br from-pink-500 to-rose-600 text-2xl">
            👊
          </HoldButton>
          <HoldButton label="Pied" onDown={() => attack('K')} onUp={() => {}} className="h-16 w-16 bg-gradient-to-br from-violet-500 to-indigo-600 text-2xl">
            🦶
          </HoldButton>
          <HoldButton
            label="Garde"
            onDown={() => {
              guardRef.current.button = true
              updateGuard()
            }}
            onUp={() => {
              guardRef.current.button = false
              updateGuard()
            }}
            className="col-span-2 h-11 bg-sky-500/80 text-sm"
          >
            <Shield size={16} className="mr-1" /> GARDE
          </HoldButton>
        </div>
      </div>

      {paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-[28px] bg-violet-950 p-6 text-center">
            <p className="font-display text-2xl font-bold">Pause</p>
            <p className="mt-1 text-sm text-white/70">
              Round {hud.round} · {hud.wins[0]} – {hud.wins[1]}
            </p>
            <button type="button" onClick={togglePause} className="mt-5 w-full rounded-full bg-white py-3 text-sm font-semibold text-violet-950">
              Reprendre
            </button>
            <button type="button" onClick={() => endRef.current?.()} className="mt-2 w-full py-2 text-sm text-white/70 hover:text-white">
              Abandonner le combat
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default FightScreen
