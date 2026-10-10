import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Flag, Play, Trophy, Volume2, VolumeX } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { finishMotoRace, getMotoLeaderboard, getMyMotoStats, startMotoRace } from '../firebase/motoBoma.js'
import { COURSES, DEFAULT_COURSE, MEDAL_BONUS } from '../../../shared/moto-boma/engine.mjs'
import { fallbackToFullPhoto, photoVariant } from '../lib/photoVariants.js'
import { createGameAudio, loadMuted, saveMuted } from '../game/ngoriRun/audio.js'
import { loadRenderer3d, webglSupported } from '../game/ngoriRun/graphics.js'
import MotoScreen from '../game/motoBoma/MotoScreen.jsx'
import { MEDAL_EMOJI, MEDAL_LABEL, formatTicks } from '../game/motoBoma/format.js'
import NgoriCoin from '../components/NgoriCoin.jsx'
import motoKevin from '../assets/game/moto-kevin.webp'
import motoAicha from '../assets/game/moto-aicha.webp'

// Shared with NGORI RUN: the hero and the 3D setting are chosen once.
const RUNNER_KEY = 'ngoriRun.runner'
const GRAPHICS_3D_KEY = 'ngoriRun.3d'
const HEROES = [
  { id: 'man', name: 'Kévin', picture: motoKevin },
  { id: 'woman', name: 'Aïcha', picture: motoAicha },
]

function readRunner() {
  try {
    return localStorage.getItem(RUNNER_KEY) === 'woman' ? 'woman' : 'man'
  } catch {
    return 'man'
  }
}

function read3d() {
  try {
    const saved = localStorage.getItem(GRAPHICS_3D_KEY)
    return saved === null ? !!webglSupported() : saved === '1'
  } catch {
    return !!webglSupported()
  }
}

function Leaderboard({ course, refreshKey }) {
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    getMotoLeaderboard(course)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [course, refreshKey])

  if (failed) return <p className="py-8 text-center text-sm text-ink-soft/60">Classement indisponible pour le moment.</p>
  if (!data) return <div className="mx-auto my-8 h-7 w-7 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
  if (!data.top.length) {
    return <p className="py-8 text-center text-sm text-ink-soft/60">Personne n’a encore fini ce parcours cette semaine. À toi la pole ! 🏁</p>
  }
  const rows = data.me && !data.top.some((e) => e.isMe) ? [...data.top, null, data.me] : data.top
  return (
    <div>
      <p className="mb-3 text-xs text-ink-soft/60">Cette semaine · meilleur temps de chaque pilote · remis à zéro chaque lundi</p>
      <ol className="space-y-2">
        {rows.map((e, i) =>
          e === null ? (
            <li key="sep" className="text-center text-ink-soft/40">⋯</li>
          ) : (
            <li
              key={`${e.rank}-${i}`}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${e.isMe ? 'bg-violet-500/12 ring-1 ring-violet-500/30' : 'bg-surface'}`}
            >
              <span className="w-7 text-center font-display text-base font-bold text-ink">{['🥇', '🥈', '🥉'][e.rank - 1] || e.rank}</span>
              {e.photo ? (
                <img src={photoVariant(e.photo, 'thumb')} onError={fallbackToFullPhoto(e.photo)} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/15 text-sm font-bold text-violet-600">
                  {e.firstName?.[0] || '?'}
                </span>
              )}
              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                {e.firstName}
                {e.isMe ? ' (toi)' : ''}
              </p>
              <span className="font-display text-sm font-bold tabular-nums text-ink">
                {e.medal ? `${MEDAL_EMOJI[e.medal]} ` : ''}
                {formatTicks(e.bestTicks)}
              </span>
            </li>
          ),
        )}
      </ol>
    </div>
  )
}

function ResultScreen({ outcome, local, error, onRetrySave, onReplay, onClose, hero }) {
  const r = outcome?.result || local
  const medal = r.medal
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[95] flex items-center justify-center overflow-y-auto bg-black/75 p-5 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: 30, scale: 0.95, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="w-full max-w-sm rounded-[28px] bg-violet-950 p-6 text-center text-white shadow-2xl"
      >
        <img src={hero.picture} alt="" className="mx-auto h-28 object-contain drop-shadow-[0_8px_20px_rgba(236,72,153,0.45)]" />
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-pink-300">{r.finished ? 'Arrivée' : 'Course abandonnée'}</p>
        <h2 className="mt-1 font-display text-4xl font-black tabular-nums">{r.finished ? formatTicks(r.finishTick) : '—'}</h2>
        <p className="mt-1 text-sm text-white/75">
          {medal
            ? `${MEDAL_EMOJI[medal]} Médaille ${MEDAL_LABEL[medal].toLowerCase()}, bravo ${hero.name} !`
            : r.finished
              ? 'Pas de médaille cette fois : vise la nitro et évite les taxis !'
              : `${r.distance.toLocaleString('fr-FR')} m parcourus`}
        </p>
        {outcome?.newBest && (
          <p className="mt-2">
            <span className="rounded-full bg-gold/20 px-3 py-1 text-xs font-bold text-amber-200">🏆 Nouveau record perso !</span>
          </p>
        )}

        <dl className="mt-5 space-y-2 text-left text-sm">
          {[
            ['Ngori ramassés', r.coins],
            ['Bonus médaille', `+${r.bonus}`],
            ['Accrochages', r.bumps],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-white/10 pb-2">
              <dt className="text-white/70">{label}</dt>
              <dd className="font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 rounded-2xl bg-white/8 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Crédités</p>
          <p className="mt-1 flex items-center justify-center gap-2 font-display text-3xl font-bold">
            {outcome ? outcome.credited : '…'} <NgoriCoin size={30} />
          </p>
          {outcome && (
            <p className="mt-1 text-xs text-white/70">
              {outcome.anomaly
                ? 'Course non validée : aucun Ngori crédité.'
                : `${outcome.earnedToday}/${outcome.dailyCap} gagnés en moto aujourd’hui`}
            </p>
          )}
          {error && (
            <div className="mt-2">
              <p className="text-xs text-coral-400">{error}</p>
              {onRetrySave && (
                <button type="button" onClick={onRetrySave} className="mt-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold">
                  Réessayer d’enregistrer
                </button>
              )}
            </div>
          )}
          {!outcome && !error && <p className="mt-1 text-xs text-white/60">Vérification de la course…</p>}
        </div>

        <button
          type="button"
          onClick={onReplay}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-bold text-violet-950"
        >
          <Play size={16} fill="currentColor" /> Nouvelle course
        </button>
        <button type="button" onClick={onClose} className="mt-2 w-full rounded-full border border-white/25 py-2.5 text-sm font-semibold">
          Fermer
        </button>
      </motion.div>
    </motion.div>
  )
}

// MOTO BOMA — lobby, the race and the result. Ngori are paid by the server
// after replaying the race (see firebase/motoBoma.js).
function MotoBoma() {
  const navigate = useNavigate()
  const { profile: account } = useAuth()
  const { showToast } = useToast()
  const [audio] = useState(() => createGameAudio(loadMuted()))
  const [muted, setMuted] = useState(loadMuted)
  const [runner, setRunner] = useState(readRunner)
  const [can3d] = useState(() => webglSupported())
  const [use3d] = useState(read3d)
  const [course] = useState(DEFAULT_COURSE)
  const [phase, setPhase] = useState('lobby') // lobby | starting | racing | result
  const [race, setRace] = useState(null) // { raceId, seed, course }
  const [payload, setPayload] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [stats, setStats] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const balance = account?.ngori || 0
  const hero = HEROES.find((h) => h.id === runner) || HEROES[0]
  const info = COURSES[course]
  const best = stats?.stats.bestTicks?.[course]

  useEffect(() => () => audio.close(), [audio])
  useEffect(() => {
    if (can3d && use3d) loadRenderer3d().catch(() => {})
  }, [can3d, use3d])
  useEffect(() => {
    getMyMotoStats()
      .then(setStats)
      .catch(() => {})
  }, [refreshKey])

  function toggleMute() {
    const next = !muted
    setMuted(next)
    saveMuted(next)
    audio.setMuted(next)
  }

  function chooseHero(id) {
    setRunner(id)
    try {
      localStorage.setItem(RUNNER_KEY, id)
    } catch {
      // not remembered in private mode
    }
  }

  async function start() {
    audio.unlock() // must happen inside the tap
    setPhase('starting')
    setOutcome(null)
    setSaveError(null)
    setPayload(null)
    try {
      const r = await startMotoRace(course)
      setRace({ raceId: r.raceId, seed: r.seed, course: r.course })
      setPhase('racing')
    } catch (err) {
      showToast(err.message === 'request failed' ? 'Impossible de lancer la course, réessaie.' : err.message, 'error')
      setPhase('lobby')
    }
  }

  const save = useCallback(
    async (data) => {
      setSaveError(null)
      try {
        const res = await finishMotoRace(race.raceId, data)
        setOutcome(res)
        if (res.credited > 0) audio.play('reward')
        setRefreshKey((k) => k + 1)
      } catch (err) {
        setSaveError(err.status === 409 ? err.message : 'Impossible d’enregistrer la course. Vérifie ta connexion.')
      }
    },
    [race, audio],
  )

  function handleEnd(data) {
    if (data.endTick < 1) {
      setPhase('lobby')
      return
    }
    setPayload(data)
    setPhase('result')
    save(data)
  }

  // Shown while the server replays the race; its own figures replace these.
  const local = payload && {
    finished: payload.claimed.finishTick != null,
    finishTick: payload.claimed.finishTick,
    coins: payload.claimed.coins,
    medal: null,
    bonus: 0,
    bumps: '…',
    distance: 0,
  }

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
        <h1 className="flex-1 font-display text-lg font-semibold text-ink">Moto Boma</h1>
        <button
          type="button"
          onClick={toggleMute}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5"
          aria-label={muted ? 'Activer le son' : 'Couper le son'}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-5">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#12081f] via-[#3b0f5c] to-[#e9467d] p-5 text-white shadow-xl shadow-violet-900/20">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-cyan-400/25 blur-2xl" />
          <p className="relative text-xs font-bold uppercase tracking-[0.25em] text-white/70">BomaVibes présente</p>
          <h2 className="relative mt-1 font-display text-4xl font-black italic tracking-tight">
            MOTO <span className="text-cyan-300">BOMA</span>
          </h2>
          <p className="relative mt-1 text-sm text-white/80">Faufile-toi entre les taxis de Libreville, nitro à fond, et bats le chrono.</p>

          <div className="relative mt-4 grid grid-cols-2 gap-2">
            {HEROES.map((h) => {
              const active = runner === h.id
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => chooseHero(h.id)}
                  aria-pressed={active}
                  className={`relative flex h-40 flex-col items-center justify-end overflow-hidden rounded-2xl pb-2 transition ${
                    active ? 'bg-white/20 ring-2 ring-cyan-300' : 'bg-white/8 hover:bg-white/15'
                  }`}
                >
                  <img src={h.picture} alt="" className="absolute inset-x-0 top-2 mx-auto h-28 object-contain" />
                  <span className="relative font-display text-base font-bold">{h.name}</span>
                </button>
              )
            })}
          </div>

          <div className="relative mt-4 rounded-2xl bg-black/25 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Flag size={15} /> {info.name} · {(info.length / 100000).toLocaleString('fr-FR')} km
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-xs">
              {['gold', 'silver', 'bronze'].map((m) => (
                <div key={m} className="rounded-xl bg-white/10 px-2 py-1.5">
                  <p className="font-display text-sm font-bold tabular-nums">
                    {MEDAL_EMOJI[m]} {formatTicks(info.medals[m])}
                  </p>
                  <p className="text-white/60">+{MEDAL_BONUS[m]} Ngori</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-white/70">
              {best ? `Ton record : ${formatTicks(best)}` : 'Pas encore de temps sur ce parcours.'}
              {stats ? ` · Gagnés en moto aujourd’hui : ${stats.earnedToday}/${stats.dailyCap}` : ''}
            </p>
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={start}
            disabled={phase === 'starting'}
            className="relative mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white py-4 font-display text-base font-black tracking-wide text-violet-950 shadow-lg disabled:opacity-70"
          >
            <Play size={18} fill="currentColor" />
            {phase === 'starting' ? 'PRÉPARATION…' : 'LANCER LA COURSE'}
          </motion.button>
          <p className="relative mt-3 flex items-center justify-center gap-1.5 text-xs text-white/70">
            <NgoriCoin size={16} /> Solde : {balance} Ngori
          </p>
        </div>

        <div className="mt-6 rounded-2xl bg-surface p-4">
          <p className="flex items-center gap-2 font-display text-base font-semibold text-ink">
            <Trophy size={17} className="text-amber-500" /> Les plus rapides de la semaine
          </p>
          <div className="mt-3">
            <Leaderboard course={course} refreshKey={refreshKey} />
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {[
            ['👆 Piloter', 'Maintiens le doigt sur la moitié gauche ou droite de l’écran pour te déplacer (← → au clavier). Tu peux rouler entre les voies.'],
            ['🔥 Nitro', 'Le bouton NITRO (↑ ou espace) donne une pointe à 125 km/h pendant 2,5 s. Tu en as une au départ ; ramasse les bidons 🔥 pour en avoir jusqu’à 3.'],
            ['🚕 Circulation', 'Taxis et voitures roulent moins vite que toi : double-les. Un accrochage te ralentit fort, un nid-de-poule un peu.'],
            ['🪙 Gains', `Chaque Ngori ramassé compte, plus un bonus selon ta médaille. Jusqu’à ${stats?.dailyCap ?? 5} Ngori par jour en moto.`],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl bg-surface p-3.5">
              <p className="text-sm font-semibold text-ink">{title}</p>
              <p className="mt-1 text-sm text-ink-soft/70">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {phase === 'racing' && race && (
        <MotoScreen
          key={race.raceId}
          seed={race.seed}
          course={race.course}
          runner={runner}
          graphics={can3d && use3d ? '3d' : '2d'}
          audio={audio}
          muted={muted}
          onToggleMute={toggleMute}
          onEnd={handleEnd}
        />
      )}
      <AnimatePresence>
        {phase === 'result' && (
          <ResultScreen
            outcome={outcome}
            local={local}
            error={saveError}
            onRetrySave={saveError && payload ? () => save(payload) : null}
            onReplay={start}
            onClose={() => setPhase('lobby')}
            hero={hero}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default MotoBoma
