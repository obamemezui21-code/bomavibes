import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Crosshair, Star, Trophy, Volume2, VolumeX } from 'lucide-react'
import { DEFAULT_RIFLE, RIFLES, STAR_SCORES } from '../../../shared/oeil-de-panthere/engine.mjs'
import { finishPantherGame, getPanther, startPantherGame } from '../firebase/panthere.js'
import { createPantherAudio, loadMuted, saveMuted } from '../game/panthere/audio.js'
import PantherScreen from '../game/panthere/PantherScreen.jsx'
import PantherHelp from '../game/panthere/PantherHelp.jsx'
import NgoriCoin from '../components/NgoriCoin.jsx'
import { useToast } from '../context/ToastContext.jsx'

const RIFLE_KEY = 'panthere.rifle'

function readRifle() {
  try {
    const r = localStorage.getItem(RIFLE_KEY)
    return RIFLES[r] ? r : DEFAULT_RIFLE
  } catch {
    return DEFAULT_RIFLE
  }
}

function Stars({ count, size = 14 }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${count} étoile${count > 1 ? 's' : ''} sur 3`}>
      {[0, 1, 2].map((i) => (
        <Star key={i} size={size} className={i < count ? 'text-amber-400' : 'text-ink/20'} fill={i < count ? 'currentColor' : 'none'} />
      ))}
    </span>
  )
}

// The rifles' strengths, on a 1–5 scale, for the choice cards.
function rifleStats(r) {
  return [
    ['Zoom', Math.round(r.zoom * 1.3)],
    ['Cadence', Math.max(1, Math.round(6 - r.cooldown / 7))],
    ['Chargeur', Math.min(5, Math.round(r.mag / 3))],
    ['Puissance', r.damage * 2 + 1],
  ]
}

function RifleChoice({ value, onChange, dark = false }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {Object.entries(RIFLES).map(([id, r]) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`rounded-2xl p-2.5 text-left transition ${
              active
                ? `ring-2 ring-amber-400 ${dark ? 'bg-white/15' : 'bg-white dark:bg-surface-tint'}`
                : `${dark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white/70 ring-1 ring-ink/8 dark:bg-surface-tint/60'}`
            }`}
          >
            <p className={`text-[12px] font-semibold leading-tight ${dark ? 'text-white' : 'text-ink'}`}>{r.name}</p>
            <ul className="mt-1.5 space-y-1">
              {rifleStats(r).map(([label, v]) => (
                <li key={label} className={`text-[9px] ${dark ? 'text-white/70' : 'text-ink-soft/70'}`}>
                  {label}
                  <span className="mt-0.5 flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={`h-1 flex-1 rounded-full ${n <= v ? 'bg-amber-400' : dark ? 'bg-white/15' : 'bg-ink/10'}`} />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </button>
        )
      })}
    </div>
  )
}

// ŒIL DE PANTHÈRE: the lobby (rifle, record, ranking), the game itself
// (PantherScreen) and the result.
function OeilDePanthere() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [audio] = useState(() => createPantherAudio(loadMuted()))
  const [muted, setMuted] = useState(loadMuted)
  const [data, setData] = useState(null) // GET /api/panthere
  const [rifle, setRifle] = useState(readRifle)
  const [phase, setPhase] = useState('lobby') // lobby | starting | playing | result
  const [run, setRun] = useState(null) // { runId, seed, options }
  const [outcome, setOutcome] = useState(null)
  const [saveError, setSaveError] = useState(null)

  const load = useCallback(() => {
    getPanther()
      .then(setData)
      .catch(() => setData({ failed: true }))
  }, [])

  useEffect(() => {
    load()
    return () => audio.dispose()
  }, [load, audio])

  function toggleMute() {
    const next = !muted
    setMuted(next)
    saveMuted(next)
    audio.setMuted(next)
  }

  function chooseRifle(id) {
    setRifle(id)
    try {
      localStorage.setItem(RIFLE_KEY, id)
    } catch {
      // not remembered in private mode
    }
  }

  async function start() {
    audio.unlock() // inside the tap, or the browser keeps the sound off
    setOutcome(null)
    setSaveError(null)
    setPhase('starting')
    try {
      const r = await startPantherGame(rifle)
      setRun(r)
      setPhase('playing')
    } catch (err) {
      showToast(err.message === 'request failed' ? 'Impossible de lancer la partie, réessaie.' : err.message, 'error')
      setPhase('lobby')
    }
  }

  const handleEnd = useCallback(
    async (payload) => {
      setPhase('result')
      try {
        const res = await finishPantherGame(run.runId, payload)
        setOutcome(res)
        load()
      } catch (err) {
        setSaveError(err.status === 409 ? err.message : 'Impossible d’enregistrer la partie. Vérifie ta connexion.')
      }
    },
    [run, load],
  )

  return (
    <div className="min-h-svh bg-surface-soft pb-24 desktop:min-h-full desktop:pb-6">
      <div className="flex items-center gap-3 border-b border-ink/8 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5"
          aria-label="Retour"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <h1 className="flex-1 font-display text-lg font-semibold text-ink">Œil de Panthère</h1>
        <button
          type="button"
          onClick={toggleMute}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5"
          aria-label={muted ? 'Activer le son' : 'Couper le son'}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      <div className="mx-auto max-w-lg space-y-5 px-4 pt-5">
        <div className="relative overflow-hidden rounded-[28px] bg-[#1a1208] p-5 text-white shadow-xl">
          <img src="/commando/bg-lope.webp" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/25" />
          <div className="relative">
            <p className="font-mono text-[11px] tracking-[0.25em] text-amber-300">TIR DE PRÉCISION · LOPÉ</p>
            <p className="mt-1 font-display text-2xl font-bold">Œil de Panthère</p>
            <p className="mt-1 text-sm text-white/80">
              Le soir tombe sur la Lopé. Fusil à lunette en main, abats les braconniers et les monstres de la forêt… et épargne les animaux protégés.
            </p>
            <a href="#comment-jouer" className="mt-2 inline-block text-xs font-semibold text-amber-300 underline underline-offset-2">
              ❓ Comment jouer
            </a>
            {!data ? (
              <div className="mt-4 h-10 animate-pulse rounded-xl bg-white/10" />
            ) : data.failed ? (
              <p className="mt-4 text-sm text-red-200">Impossible de charger ton record. Réessaie plus tard.</p>
            ) : (
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-black/30 p-3 text-sm">
                <span className="flex items-center gap-1.5">
                  <Trophy size={16} className="text-amber-300" />
                  Record : <b className="font-mono">{data.best}</b>
                  <Stars count={data.bestStars} size={12} />
                </span>
                <span className="flex items-center gap-1 text-xs text-white/80">
                  <NgoriCoin size={14} /> {data.earnedToday}/{data.dailyCap} aujourd’hui
                </span>
              </div>
            )}
          </div>
        </div>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">Ton fusil</h2>
          <RifleChoice value={rifle} onChange={chooseRifle} />
          <p className="mt-2 text-[11px] text-ink-soft/60">
            ⭐ {STAR_SCORES[0]} pts · ⭐⭐ {STAR_SCORES[1]} pts · ⭐⭐⭐ {STAR_SCORES[2]} pts. Chaque étoile vaut 1 Ngori ({data?.dailyCap ?? 5} par jour).
          </p>
        </section>

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          disabled={phase === 'starting' || !data || data.failed}
          onClick={start}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#3b2a12] to-[#7a3a12] py-3.5 font-display text-base font-bold tracking-wide text-white shadow-lg disabled:opacity-60"
        >
          <Crosshair size={18} />
          {phase === 'starting' ? 'PRÉPARATION…' : 'EN POSITION'}
        </motion.button>

        <section id="comment-jouer" className="rounded-2xl bg-[#1a1208] p-4 text-white">
          <h2 className="mb-3 font-display text-base font-semibold">🎮 Comment jouer</h2>
          <PantherHelp variant="full" />
        </section>

        {data?.leaderboard?.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-ink">Les meilleurs tireurs</h2>
            <ol className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8 dark:bg-surface-tint">
              {data.leaderboard.map((p, i) => (
                <li key={i} className={`flex items-center gap-3 px-3 py-2 text-sm ${p.me ? 'bg-amber-400/15' : ''} ${i ? 'border-t border-ink/6' : ''}`}>
                  <span className="w-5 text-center font-mono text-xs font-bold text-ink-soft">{i + 1}</span>
                  {p.photo ? <img src={p.photo} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="h-7 w-7 rounded-full bg-ink/10" />}
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{p.firstName}</span>
                  <span className="font-mono text-xs font-semibold text-ink">{p.best}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {phase === 'playing' && run && (
        <PantherScreen seed={run.seed} options={run.options} audio={audio} muted={muted} onToggleMute={toggleMute} onEnd={handleEnd} />
      )}

      <AnimatePresence>
        {phase === 'result' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[96] flex items-center justify-center bg-black/80 p-4"
          >
            <motion.div initial={{ y: 20, scale: 0.96 }} animate={{ y: 0, scale: 1 }} className="w-full max-w-sm rounded-3xl bg-[#1a1208] p-5 text-center text-white">
              {!outcome && !saveError && <p className="py-8 text-sm text-white/70">Vérification de tes tirs…</p>}
              {saveError && (
                <>
                  <p className="py-4 text-sm text-red-200">{saveError}</p>
                  <button type="button" onClick={() => setPhase('lobby')} className="rounded-full bg-white px-6 py-2 text-sm font-bold text-black">
                    Retour
                  </button>
                </>
              )}
              {outcome && (
                <>
                  <p className={`font-display text-2xl font-bold ${outcome.result.completed ? 'text-amber-300' : 'text-red-300'}`}>
                    {outcome.result.completed ? 'Fin de la chasse' : 'Tu as été touché'}
                  </p>
                  <div className="mt-3 flex justify-center">
                    <Stars count={outcome.result.stars} size={26} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-xs">
                    <div className="rounded-xl bg-white/10 p-2">
                      <p className="text-base font-bold">{outcome.result.score}</p>
                      <p className="text-white/60">score</p>
                    </div>
                    <div className="rounded-xl bg-white/10 p-2">
                      <p className="text-base font-bold">{outcome.result.accuracy}%</p>
                      <p className="text-white/60">précision</p>
                    </div>
                    <div className="rounded-xl bg-white/10 p-2">
                      <p className="text-base font-bold">{outcome.result.headshots}</p>
                      <p className="text-white/60">tirs parfaits</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-white/70">
                    🥷 {outcome.result.kills.braconnier} · 👹 {outcome.result.kills.monstre} · 🎯 {outcome.result.kills.cible} · 🪙 {outcome.result.kills.or}
                    {outcome.result.kills.animal > 0 && <span className="text-red-300"> · 🦍 {outcome.result.kills.animal} touché(s)</span>}
                  </p>
                  {outcome.credited > 0 && (
                    <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-amber-300">
                      +{outcome.credited} <NgoriCoin size={14} />
                    </p>
                  )}
                  {outcome.newBest && <p className="mt-1 text-xs text-amber-200">🏆 Nouveau record !</p>}
                  {outcome.anomaly && <p className="mt-2 text-[11px] text-red-200">Cette partie n’a pas pu être validée : rien n’a été compté.</p>}
                  <button type="button" onClick={() => setPhase('lobby')} className="mt-5 w-full rounded-2xl bg-amber-400 py-3 font-display font-bold text-black">
                    Continuer
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default OeilDePanthere
