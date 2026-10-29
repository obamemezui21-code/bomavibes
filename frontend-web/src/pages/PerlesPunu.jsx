import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, Play, Star, Trophy, Volume2, VolumeX } from 'lucide-react'
import { LEVELS, STAR_SCORES } from '../../../shared/perles-punu/engine.mjs'
import { finishPerlesGame, getPerles, startPerlesGame } from '../firebase/perles.js'
import { createPerlesAudio, loadMuted, saveMuted } from '../game/perles/audio.js'
import PerlesScreen from '../game/perles/PerlesScreen.jsx'
import PerlesHelp from '../game/perles/PerlesHelp.jsx'
import NgoriCoin from '../components/NgoriCoin.jsx'
import { useToast } from '../context/ToastContext.jsx'

const PERLES_COVER = '/perles/cover.svg'

function Stars({ count, size = 14 }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${count} étoile${count > 1 ? 's' : ''} sur 3`}>
      {[0, 1, 2].map((i) => (
        <Star key={i} size={size} className={i < count ? 'text-amber-400' : 'text-ink/20'} fill={i < count ? 'currentColor' : 'none'} />
      ))}
    </span>
  )
}

// PERLES PUNU: the lobby (record, stages, ranking), the game itself
// (PerlesScreen) and the result.
function PerlesPunu() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [audio] = useState(() => createPerlesAudio(loadMuted()))
  const [muted, setMuted] = useState(loadMuted)
  const [data, setData] = useState(null) // GET /api/perles
  const [phase, setPhase] = useState('lobby') // lobby | starting | playing | result
  const [run, setRun] = useState(null) // { runId, seed }
  const [outcome, setOutcome] = useState(null)
  const [saveError, setSaveError] = useState(null)

  const load = useCallback(() => {
    getPerles()
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

  async function start() {
    audio.unlock() // inside the tap, or the browser keeps the sound off
    setOutcome(null)
    setSaveError(null)
    setPhase('starting')
    try {
      const r = await startPerlesGame()
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
        const res = await finishPerlesGame(run.runId, payload)
        setOutcome(res)
        load()
      } catch (err) {
        setSaveError(err.status === 409 ? err.message : 'Impossible d’enregistrer la partie. Vérifie ta connexion.')
      }
    },
    [run, load],
  )

  const r = outcome?.result
  const reached = data?.bestLevels || 0

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
        <h1 className="flex-1 font-display text-lg font-semibold text-ink">Perles Punu</h1>
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
        <div className="relative overflow-hidden rounded-[28px] bg-[#1f2a14] p-5 text-white shadow-xl">
          <img src={PERLES_COVER} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/5" />
          <div className="relative pt-16">
            <p className="font-mono text-[11px] tracking-[0.25em] text-amber-300">TIR DE PERLES · GABON</p>
            <p className="mt-1 font-display text-2xl font-bold">Perles Punu</p>
            <p className="mt-1 text-sm text-white/80">
              Le masque Punu protège le fleuve : lance tes perles, fais-en éclater 3 de la même couleur, et ne laisse aucune perle tomber
              dans la chute.
            </p>
            <a href="#comment-jouer" className="mt-2 inline-block text-xs font-semibold text-amber-300 underline underline-offset-2">
              ❓ Comment jouer
            </a>
            {!data ? (
              <div className="mt-4 h-10 animate-pulse rounded-xl bg-white/10" />
            ) : data.failed ? (
              <p className="mt-4 text-sm text-red-200">Impossible de charger ton record. Réessaie plus tard.</p>
            ) : (
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-black/35 p-3 text-sm">
                <span className="flex items-center gap-1.5">
                  <Trophy size={16} className="text-amber-300" />
                  Record : <b className="font-mono">{data.best.toLocaleString('fr-FR')}</b>
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
          <h2 className="mb-2 text-sm font-semibold text-ink">Les 5 niveaux</h2>
          <ol className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8 dark:bg-surface-tint">
            {LEVELS.map((lv, i) => (
              <li key={lv.id} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${i ? 'border-t border-ink/6' : ''}`}>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    i < reached ? 'bg-amber-400 text-black' : 'bg-ink/8 text-ink-soft'
                  }`}
                >
                  {i < reached ? <Check size={14} strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink">{lv.name}</span>
                  <span className="block text-[11px] text-ink-soft/70">
                    {lv.subtitle} · {lv.beads} perles · {lv.colors} couleurs
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[11px] text-ink-soft/60">
            3 vies pour tout traverser. ⭐ {STAR_SCORES[0].toLocaleString('fr-FR')} pts · ⭐⭐ {STAR_SCORES[1].toLocaleString('fr-FR')} pts ·
            ⭐⭐⭐ {STAR_SCORES[2].toLocaleString('fr-FR')} pts. Chaque étoile vaut 1 Ngori ({data?.dailyCap ?? 5} par jour).
          </p>
        </section>

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          disabled={phase === 'starting' || !data || data.failed}
          onClick={start}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#8a4b12] to-[#d98e1f] py-3.5 font-display text-base font-bold tracking-wide text-white shadow-lg disabled:opacity-60"
        >
          <Play size={18} fill="currentColor" />
          {phase === 'starting' ? 'PRÉPARATION…' : 'JOUER'}
        </motion.button>

        <section id="comment-jouer" className="rounded-2xl bg-[#1f2a14] p-4 text-white">
          <h2 className="mb-3 font-display text-base font-semibold">🎮 Comment jouer</h2>
          <PerlesHelp variant="full" />
        </section>

        {data?.leaderboard?.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-ink">Les meilleurs joueurs</h2>
            <ol className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8 dark:bg-surface-tint">
              {data.leaderboard.map((p, i) => (
                <li key={i} className={`flex items-center gap-3 px-3 py-2 text-sm ${p.me ? 'bg-amber-400/15' : ''} ${i ? 'border-t border-ink/6' : ''}`}>
                  <span className="w-5 text-center font-mono text-xs font-bold text-ink-soft">{i + 1}</span>
                  {p.photo ? <img src={p.photo} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="h-7 w-7 rounded-full bg-ink/10" />}
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{p.firstName}</span>
                  <span className="font-mono text-xs font-semibold text-ink">{p.best.toLocaleString('fr-FR')}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {phase === 'playing' && run && <PerlesScreen seed={run.seed} audio={audio} muted={muted} onToggleMute={toggleMute} onEnd={handleEnd} />}

      <AnimatePresence>
        {phase === 'result' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[96] flex items-center justify-center bg-black/80 p-4"
          >
            <motion.div initial={{ y: 20, scale: 0.96 }} animate={{ y: 0, scale: 1 }} className="w-full max-w-sm rounded-3xl bg-[#1f2a14] p-5 text-center text-white">
              {!outcome && !saveError && <p className="py-8 text-sm text-white/70">Vérification de ta partie…</p>}
              {saveError && (
                <>
                  <p className="py-4 text-sm text-red-200">{saveError}</p>
                  <button type="button" onClick={() => setPhase('lobby')} className="rounded-full bg-white px-6 py-2 text-sm font-bold text-black">
                    Retour
                  </button>
                </>
              )}
              {r && (
                <>
                  <p className={`font-display text-2xl font-bold ${r.won ? 'text-amber-300' : 'text-white'}`}>{r.won ? 'Le fleuve est libre !' : 'Partie terminée'}</p>
                  <p className="mt-1 text-xs text-white/70">
                    {r.won ? 'Les 5 niveaux réussis !' : `Niveau atteint : ${LEVELS[r.level].name} (${r.levelsCleared} réussi${r.levelsCleared > 1 ? 's' : ''})`}
                  </p>
                  <div className="mt-3 flex justify-center">
                    <Stars count={r.stars} size={26} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-xs">
                    <div className="rounded-xl bg-white/10 p-2">
                      <p className="text-base font-bold">{r.score.toLocaleString('fr-FR')}</p>
                      <p className="text-white/60">score</p>
                    </div>
                    <div className="rounded-xl bg-white/10 p-2">
                      <p className="text-base font-bold">{r.matched}</p>
                      <p className="text-white/60">perles éclatées</p>
                    </div>
                    <div className="rounded-xl bg-white/10 p-2">
                      <p className="text-base font-bold">×{Math.max(1, r.bestCombo)}</p>
                      <p className="text-white/60">meilleur combo</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-white/70">
                    🎯 Meilleure série : {r.bestStreak} · 🪙 {r.coins} pièce{r.coins > 1 ? 's' : ''} Ngori attrapée{r.coins > 1 ? 's' : ''}
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

export default PerlesPunu
