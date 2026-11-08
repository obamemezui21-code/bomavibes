import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Dumbbell, Star, Target, Trophy, Volume2, VolumeX } from 'lucide-react'
import { STAR_SCORES, simulateGame } from '../../../shared/fleche-ebene/engine.mjs'
import { finishFlecheGame, getFleche, startFlecheGame } from '../firebase/fleche.js'
import { createFlecheAudio, loadMuted, saveMuted } from '../game/fleche/audio.js'
import FlecheScreen from '../game/fleche/FlecheScreen.jsx'
import FlecheHelp from '../game/fleche/FlecheHelp.jsx'
import { preloadArt } from '../game/fleche/renderer.js'
import { practiceSeed } from '../game/practice.js'
import NgoriCoin from '../components/NgoriCoin.jsx'
import { useToast } from '../context/ToastContext.jsx'

function Stars({ count, size = 14 }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${count} étoile${count > 1 ? 's' : ''} sur 3`}>
      {[0, 1, 2].map((i) => (
        <Star key={i} size={size} className={i < count ? 'text-amber-400' : 'text-ink/20'} fill={i < count ? 'currentColor' : 'none'} />
      ))}
    </span>
  )
}

// FLÈCHE D'ÉBÈNE: the lobby (record, ranking), the game itself (FlecheScreen)
// and the result.
function FlecheEbene() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [audio] = useState(() => createFlecheAudio(loadMuted()))
  const [muted, setMuted] = useState(loadMuted)
  const [data, setData] = useState(null) // GET /api/fleche
  const [phase, setPhase] = useState('lobby') // lobby | starting | playing | result
  const [run, setRun] = useState(null) // { runId, seed } or { seed, practice: true }
  const [gameKey, setGameKey] = useState(0)
  const [payload, setPayload] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const [saveError, setSaveError] = useState(null)

  const load = useCallback(() => {
    getFleche()
      .then(setData)
      .catch(() => setData({ failed: true }))
  }, [])

  useEffect(() => {
    load()
    preloadArt()
    return () => audio.dispose()
  }, [load, audio])

  function toggleMute() {
    const next = !muted
    setMuted(next)
    saveMuted(next)
    audio.setMuted(next)
  }

  function play(next) {
    setRun(next)
    setGameKey((k) => k + 1)
    setPhase('playing')
  }

  async function start(practice = false) {
    audio.unlock() // inside the tap, or the browser keeps the sound off
    setOutcome(null)
    setSaveError(null)
    setPayload(null)
    if (practice) {
      // Training: nothing goes through the server (see game/practice.js).
      play({ seed: practiceSeed(), practice: true })
      return
    }
    setPhase('starting')
    try {
      play(await startFlecheGame())
    } catch (err) {
      showToast(err.message === 'request failed' ? 'Impossible de lancer la partie, réessaie.' : err.message, 'error')
      setPhase('lobby')
    }
  }

  const save = useCallback(
    async (data) => {
      setSaveError(null)
      try {
        setOutcome(await finishFlecheGame(run.runId, data))
        load()
      } catch (err) {
        setSaveError(err.status === 409 ? err.message : 'Impossible d’enregistrer la partie. Vérifie ta connexion.')
      }
    },
    [run, load],
  )

  const handleEnd = useCallback(
    (data) => {
      if (data.endTick < 1) {
        // Quit before the first arrow: nothing was played.
        setPhase('lobby')
        return
      }
      setPayload(data)
      setPhase('result')
      if (run.practice) setOutcome({ practice: true, result: simulateGame(run.seed, data.inputs, data.endTick) })
      else save(data)
    },
    [run, save],
  )

  const r = outcome?.result

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
        <h1 className="flex-1 font-display text-lg font-semibold text-ink">Flèche d’Ébène</h1>
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
        <div className="relative overflow-hidden rounded-[28px] bg-[#16200e] p-5 text-white shadow-xl">
          <img src="/fleche/cover.webp" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/15" />
          <div className="relative">
            <p className="font-mono text-[11px] tracking-[0.25em] text-amber-300">CHASSE À L’ARC · IVINDO</p>
            <p className="mt-1 font-display text-2xl font-bold">Flèche d’Ébène</p>
            <p className="mt-1 text-sm text-white/80">
              Arc d’ébène en main, défends la forêt de l’Ivindo. Tes flèches retombent et le vent les pousse : à toi de viser juste.
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

        <div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            disabled={phase === 'starting' || !data || data.failed}
            onClick={() => start()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2f4a17] to-[#7a3a12] py-3.5 font-display text-base font-bold tracking-wide text-white shadow-lg disabled:opacity-60"
          >
            <Target size={18} />
            {phase === 'starting' ? 'PRÉPARATION…' : 'BANDER L’ARC'}
          </motion.button>
          <button
            type="button"
            onClick={() => start(true)}
            disabled={phase === 'starting'}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-semibold text-ink-soft ring-1 ring-ink/10 transition hover:bg-ink/5 disabled:opacity-60"
          >
            <Dumbbell size={15} /> S’entraîner <span className="font-normal text-ink-soft/60">· sans Ngori</span>
          </button>
          <p className="mt-2 text-[11px] text-ink-soft/60">
            ⭐ {STAR_SCORES[0]} pts · ⭐⭐ {STAR_SCORES[1]} pts · ⭐⭐⭐ {STAR_SCORES[2]} pts. Chaque étoile vaut 1 Ngori ({data?.dailyCap ?? 5} par jour).
          </p>
        </div>

        <section id="comment-jouer" className="rounded-2xl bg-[#16200e] p-4 text-white">
          <h2 className="mb-3 font-display text-base font-semibold">🎮 Comment jouer</h2>
          <FlecheHelp variant="full" />
        </section>

        {data?.leaderboard?.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-ink">Les meilleurs archers</h2>
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

      {phase === 'playing' && run && <FlecheScreen key={gameKey} seed={run.seed} audio={audio} muted={muted} onToggleMute={toggleMute} onEnd={handleEnd} />}

      <AnimatePresence>
        {phase === 'result' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[96] flex items-center justify-center bg-black/80 p-4"
          >
            <motion.div initial={{ y: 20, scale: 0.96 }} animate={{ y: 0, scale: 1 }} className="w-full max-w-sm rounded-3xl bg-[#16200e] p-5 text-center text-white">
              {!outcome && !saveError && <p className="py-8 text-sm text-white/70">Vérification de tes flèches…</p>}
              {saveError && (
                <>
                  <p className="py-4 text-sm text-red-200">{saveError}</p>
                  <div className="flex justify-center gap-2">
                    <button type="button" onClick={() => save(payload)} className="rounded-full bg-amber-400 px-5 py-2 text-sm font-bold text-black">
                      Réessayer
                    </button>
                    <button type="button" onClick={() => setPhase('lobby')} className="rounded-full bg-white/15 px-5 py-2 text-sm font-bold">
                      Retour
                    </button>
                  </div>
                </>
              )}
              {r && (
                <>
                  <p className={`font-display text-2xl font-bold ${r.completed ? 'text-amber-300' : 'text-red-300'}`}>{r.completed ? 'Belle chasse !' : 'Tu as été touché'}</p>
                  <div className="mt-3 flex justify-center">
                    <Stars count={r.stars} size={26} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-xs">
                    <div className="rounded-xl bg-white/10 p-2">
                      <p className="text-base font-bold">{r.score}</p>
                      <p className="text-white/60">score</p>
                    </div>
                    <div className="rounded-xl bg-white/10 p-2">
                      <p className="text-base font-bold">{r.accuracy}%</p>
                      <p className="text-white/60">précision</p>
                    </div>
                    <div className="rounded-xl bg-white/10 p-2">
                      <p className="text-base font-bold">{r.longShots}</p>
                      <p className="text-white/60">tirs lointains</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-white/70">
                    👹 {r.kills.monstre} · 🥷 {r.kills.braconnier} · 🐗 {r.kills.potamochere} · 🐦 {r.kills.pintade} · 🪙 {r.kills.or}
                    {r.kills.animal > 0 && <span className="text-red-300"> · 🦍 {r.kills.animal} effrayé(s)</span>}
                  </p>
                  {outcome.practice && <p className="mt-2 text-xs text-white/70">Entraînement : aucun Ngori, rien ne compte au classement.</p>}
                  {outcome.credited > 0 && (
                    <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-amber-300">
                      +{outcome.credited} <NgoriCoin size={14} />
                    </p>
                  )}
                  {outcome.newBest && <p className="mt-1 text-xs text-amber-200">🏆 Nouveau record !</p>}
                  {outcome.anomaly && <p className="mt-2 text-[11px] text-red-200">Cette partie n’a pas pu être validée : rien n’a été compté.</p>}
                  <button type="button" onClick={() => start(!!outcome.practice)} className="mt-5 w-full rounded-2xl bg-amber-400 py-3 font-display font-bold text-black">
                    Rejouer
                  </button>
                  <button type="button" onClick={() => setPhase('lobby')} className="mt-2 w-full py-2 text-sm font-semibold text-white/75">
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

export default FlecheEbene
