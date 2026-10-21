import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Plane, Star, Trophy, Volume2, VolumeX } from 'lucide-react'
import { DEFAULT_JET, JETS, STAR_SCORES } from '../../../shared/escadrille-ogooue/engine.mjs'
import { finishEscadrilleGame, getEscadrille, startEscadrilleGame } from '../firebase/escadrille.js'
import { createEscadrilleAudio, loadMuted, saveMuted } from '../game/escadrille/audio.js'
import { drawJetPreview } from '../game/escadrille/renderer.js'
import EscadrilleScreen from '../game/escadrille/EscadrilleScreen.jsx'
import EscadrilleHelp from '../game/escadrille/EscadrilleHelp.jsx'
import NgoriCoin from '../components/NgoriCoin.jsx'
import { useToast } from '../context/ToastContext.jsx'

const JET_KEY = 'escadrille.jet'
const ESCADRILLE_COVER = '/escadrille/cover.svg'

function readJet() {
  try {
    const j = localStorage.getItem(JET_KEY)
    return JETS[j] ? j : DEFAULT_JET
  } catch {
    return DEFAULT_JET
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

// The jets' strengths, on a 1–5 scale, for the choice cards.
function jetStats(j) {
  return [
    ['Vitesse', j.speed - 1],
    ['Blindage', j.hp],
    ['Puissance', Math.round((j.damage * 60) / j.fire / 3.5)],
    ['Bombes', j.bombs + 1],
  ]
}

function JetPicture({ id }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    c.width = 64 * dpr
    c.height = 64 * dpr
    drawJetPreview(c, id)
  }, [id])
  return <canvas ref={ref} className="h-16 w-16" aria-hidden="true" />
}

function JetChoice({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {Object.entries(JETS).map(([id, j]) => {
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`rounded-2xl p-2.5 text-left transition ${
              active ? 'bg-white ring-2 ring-sky-400 dark:bg-surface-tint' : 'bg-white/70 ring-1 ring-ink/8 dark:bg-surface-tint/60'
            }`}
          >
            <div className="flex justify-center rounded-xl bg-gradient-to-b from-[#2b5223] to-[#16607f] py-1">
              <JetPicture id={id} />
            </div>
            <p className="mt-1.5 text-[13px] font-semibold leading-tight text-ink">{j.name}</p>
            <p className="text-[10px] text-ink-soft/70">{j.role}</p>
            <ul className="mt-1.5 space-y-1">
              {jetStats(j).map(([label, v]) => (
                <li key={label} className="text-[9px] text-ink-soft/70">
                  {label}
                  <span className="mt-0.5 flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={`h-1 flex-1 rounded-full ${n <= v ? 'bg-sky-500' : 'bg-ink/10'}`} />
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

// ESCADRILLE OGOUÉ: the lobby (jet, record, ranking), the sortie itself
// (EscadrilleScreen) and the debriefing.
function EscadrilleOgooue() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [audio] = useState(() => createEscadrilleAudio(loadMuted()))
  const [muted, setMuted] = useState(loadMuted)
  const [data, setData] = useState(null) // GET /api/escadrille
  const [jet, setJet] = useState(readJet)
  const [phase, setPhase] = useState('lobby') // lobby | starting | playing | result
  const [run, setRun] = useState(null) // { runId, seed, options }
  const [outcome, setOutcome] = useState(null)
  const [saveError, setSaveError] = useState(null)

  const load = useCallback(() => {
    getEscadrille()
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

  function chooseJet(id) {
    setJet(id)
    try {
      localStorage.setItem(JET_KEY, id)
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
      const r = await startEscadrilleGame(jet)
      setRun(r)
      setPhase('playing')
    } catch (err) {
      showToast(err.message === 'request failed' ? 'Impossible de lancer la mission, réessaie.' : err.message, 'error')
      setPhase('lobby')
    }
  }

  const handleEnd = useCallback(
    async (payload) => {
      setPhase('result')
      try {
        const res = await finishEscadrilleGame(run.runId, payload)
        setOutcome(res)
        load()
      } catch (err) {
        setSaveError(err.status === 409 ? err.message : 'Impossible d’enregistrer la mission. Vérifie ta connexion.')
      }
    },
    [run, load],
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
        <h1 className="flex-1 font-display text-lg font-semibold text-ink">Escadrille Ogooué</h1>
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
        <div className="relative overflow-hidden rounded-[28px] bg-[#0b2233] p-5 text-white shadow-xl">
          <img src={ESCADRILLE_COVER} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/10" />
          <div className="relative">
            <p className="font-mono text-[11px] tracking-[0.25em] text-sky-300">COMBAT AÉRIEN · GABON</p>
            <p className="mt-1 font-display text-2xl font-bold">Escadrille Ogooué</p>
            <p className="mt-1 text-sm text-white/80">
              Aux commandes de ton chasseur, survole la côte, l’Ogooué et les Monts de Cristal, et abats la flotte du Serpent Noir jusqu’à sa
              forteresse volante, le Condor Noir.
            </p>
            <a href="#comment-jouer" className="mt-2 inline-block text-xs font-semibold text-sky-300 underline underline-offset-2">
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
          <h2 className="mb-2 text-sm font-semibold text-ink">Ton chasseur</h2>
          <JetChoice value={jet} onChange={chooseJet} />
          <p className="mt-2 text-[11px] text-ink-soft/60">
            ⭐ {STAR_SCORES[0].toLocaleString('fr-FR')} pts · ⭐⭐ {STAR_SCORES[1].toLocaleString('fr-FR')} pts · ⭐⭐⭐{' '}
            {STAR_SCORES[2].toLocaleString('fr-FR')} pts. Chaque étoile vaut 1 Ngori ({data?.dailyCap ?? 5} par jour).
          </p>
        </section>

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          disabled={phase === 'starting' || !data || data.failed}
          onClick={start}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0e4d6e] to-[#1d8fb8] py-3.5 font-display text-base font-bold tracking-wide text-white shadow-lg disabled:opacity-60"
        >
          <Plane size={18} />
          {phase === 'starting' ? 'PRÉPARATION…' : 'DÉCOLLAGE'}
        </motion.button>

        <section id="comment-jouer" className="rounded-2xl bg-[#0b2233] p-4 text-white">
          <h2 className="mb-3 font-display text-base font-semibold">🎮 Comment jouer</h2>
          <EscadrilleHelp variant="full" />
        </section>

        {data?.leaderboard?.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-ink">Les meilleurs pilotes</h2>
            <ol className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8 dark:bg-surface-tint">
              {data.leaderboard.map((p, i) => (
                <li key={i} className={`flex items-center gap-3 px-3 py-2 text-sm ${p.me ? 'bg-sky-400/15' : ''} ${i ? 'border-t border-ink/6' : ''}`}>
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

      {phase === 'playing' && run && (
        <EscadrilleScreen seed={run.seed} options={run.options} audio={audio} muted={muted} onToggleMute={toggleMute} onEnd={handleEnd} />
      )}

      <AnimatePresence>
        {phase === 'result' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[96] flex items-center justify-center bg-black/80 p-4"
          >
            <motion.div initial={{ y: 20, scale: 0.96 }} animate={{ y: 0, scale: 1 }} className="w-full max-w-sm rounded-3xl bg-[#0b2233] p-5 text-center text-white">
              {!outcome && !saveError && <p className="py-8 text-sm text-white/70">Analyse de ta mission…</p>}
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
                  <p className={`font-display text-2xl font-bold ${r.won ? 'text-amber-300' : 'text-red-300'}`}>{r.won ? 'Mission accomplie !' : 'Abattu !'}</p>
                  <div className="mt-3 flex justify-center">
                    <Stars count={r.stars} size={26} />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-xs">
                    <div className="rounded-xl bg-white/10 p-2">
                      <p className="text-base font-bold">{r.score.toLocaleString('fr-FR')}</p>
                      <p className="text-white/60">score</p>
                    </div>
                    <div className="rounded-xl bg-white/10 p-2">
                      <p className="text-base font-bold">{r.totalKills}</p>
                      <p className="text-white/60">abattus</p>
                    </div>
                    <div className="rounded-xl bg-white/10 p-2">
                      <p className="text-base font-bold">{r.bestCombo}</p>
                      <p className="text-white/60">meilleur combo</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-white/70">
                    🛸 {r.kills.drone} · ✈️ {r.kills.avion} · 🚁 {r.kills.helico} · 🚤 {r.kills.vedette} · 🗼 {r.kills.tourelle}
                    {r.kills.boss > 0 && ' · 🦅 Condor Noir'}
                  </p>
                  {r.crews > 0 && <p className="mt-1 text-[11px] text-white/60">🪂 {r.crews} pilote{r.crews > 1 ? 's' : ''} ennemi{r.crews > 1 ? 's' : ''} éjecté{r.crews > 1 ? 's' : ''}, arrêté{r.crews > 1 ? 's' : ''} au sol.</p>}
                  {outcome.credited > 0 && (
                    <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-amber-300">
                      +{outcome.credited} <NgoriCoin size={14} />
                    </p>
                  )}
                  {outcome.newBest && <p className="mt-1 text-xs text-amber-200">🏆 Nouveau record !</p>}
                  {outcome.anomaly && <p className="mt-2 text-[11px] text-red-200">Cette mission n’a pas pu être validée : rien n’a été compté.</p>}
                  <button type="button" onClick={() => setPhase('lobby')} className="mt-5 w-full rounded-2xl bg-sky-400 py-3 font-display font-bold text-black">
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

export default EscadrilleOgooue
