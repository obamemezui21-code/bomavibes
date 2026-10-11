import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Play, Swords, Trophy, Volume2, VolumeX } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { finishFight, getFightLeaderboard, getMyFightStats, startFight } from '../firebase/bomaFight.js'
import { DEFAULT_LEVEL, FIGHTERS, FIGHTER_IDS, LEVELS, PERFECT_BONUS } from '../../../shared/boma-fight/engine.mjs'
import { fallbackToFullPhoto, photoVariant } from '../lib/photoVariants.js'
import { createGameAudio, loadMuted, saveMuted } from '../game/ngoriRun/audio.js'
import FightScreen from '../game/bomaFight/FightScreen.jsx'
import { PORTRAITS, STAGES } from '../game/bomaFight/portraits.js'
import NgoriCoin from '../components/NgoriCoin.jsx'

const FIGHTER_KEY = 'bomaFight.fighter'
const LEVEL_KEY = 'bomaFight.level'
const STAGE_KEY = 'bomaFight.stage'

function readSaved(key, valid, fallback) {
  try {
    const saved = localStorage.getItem(key)
    return valid(saved) ? saved : fallback
  } catch {
    return fallback
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // not remembered in private mode
  }
}

// 1–5 dots, for the fighter card.
function Stat({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-white/70">{label}</span>
      <span className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={`h-1.5 w-3 rounded-full ${i < value ? 'bg-amber-300' : 'bg-white/20'}`} />
        ))}
      </span>
    </div>
  )
}

function ratings(id) {
  const f = FIGHTERS[id]
  const scale = (v, lo, hi) => Math.max(1, Math.min(5, Math.round(1 + ((v - lo) / (hi - lo)) * 4)))
  return {
    power: scale(f.power, 95, 120),
    speed: scale(f.walk + f.quick, 3, 9),
    reach: scale(f.reach, 0, 28),
    defense: scale(f.hp / 10 + f.guard, 165, 200),
  }
}

function Leaderboard({ refreshKey }) {
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    getFightLeaderboard()
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  if (failed) return <p className="py-8 text-center text-sm text-ink-soft/60">Classement indisponible pour le moment.</p>
  if (!data) return <div className="mx-auto my-8 h-7 w-7 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
  if (!data.top.length) {
    return <p className="py-8 text-center text-sm text-ink-soft/60">Personne n’a encore gagné de combat cette semaine. À toi la ceinture ! 🥊</p>
  }
  const rows = data.me && !data.top.some((e) => e.isMe) ? [...data.top, null, data.me] : data.top
  return (
    <div>
      <p className="mb-3 text-xs text-ink-soft/60">Cette semaine · une victoire vaut 1, 2 ou 3 points selon le niveau · remis à zéro chaque lundi</p>
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
                {e.fighter && FIGHTERS[e.fighter] && <span className="font-normal text-ink-soft/60"> · {FIGHTERS[e.fighter].name}</span>}
              </p>
              <span className="font-display text-sm font-bold tabular-nums text-ink">
                {e.points} pt{e.points > 1 ? 's' : ''}
              </span>
            </li>
          ),
        )}
      </ol>
    </div>
  )
}

const OUTCOME = {
  me: { title: 'VICTOIRE !', text: (f, o) => `${f} a battu ${o}.`, color: 'text-amber-300' },
  cpu: { title: 'DÉFAITE', text: (f, o) => `${o} l’emporte cette fois… revanche ?`, color: 'text-rose-300' },
  draw: { title: 'MATCH NUL', text: () => 'Personne ne cède !', color: 'text-sky-200' },
}

function ResultScreen({ outcome, local, error, onRetrySave, onReplay, onClose, fighter, opponent, level }) {
  const r = outcome?.result || local
  const o = OUTCOME[r.winner] || { title: 'COMBAT ABANDONNÉ', text: () => 'Reviens quand tu veux.', color: 'text-white' }
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
        <div className="flex items-end justify-center gap-3">
          <img src={PORTRAITS[fighter]} alt="" className={`h-28 w-20 rounded-2xl object-cover object-top ring-2 ${r.winner === 'me' ? 'ring-amber-300' : 'ring-white/20'}`} />
          <span className="pb-10 font-display text-lg font-black text-white/60">VS</span>
          <img src={PORTRAITS[opponent]} alt="" className={`h-28 w-20 rounded-2xl object-cover object-top ring-2 ${r.winner === 'cpu' ? 'ring-amber-300' : 'ring-white/20'} ${r.winner === 'me' ? 'grayscale' : ''}`} />
        </div>
        <h2 className={`mt-3 font-display text-4xl font-black italic ${o.color}`}>{o.title}</h2>
        <p className="mt-1 text-sm text-white/75">{o.text(FIGHTERS[fighter].name, FIGHTERS[opponent].name)}</p>

        <dl className="mt-5 space-y-2 text-left text-sm">
          {[
            ['Rounds', r.wins ? `${r.wins[0]} – ${r.wins[1]}` : '—'],
            ['Niveau', LEVELS[level].name],
            ['Rounds parfaits', r.perfects ?? '…'],
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
              {outcome.anomaly ? 'Combat non validé : aucun Ngori crédité.' : `${outcome.earnedToday}/${outcome.dailyCap} gagnés au combat aujourd’hui`}
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
          {!outcome && !error && <p className="mt-1 text-xs text-white/60">Vérification du combat…</p>}
        </div>

        <button
          type="button"
          onClick={onReplay}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-bold text-violet-950"
        >
          <Swords size={16} /> Nouveau combat
        </button>
        <button type="button" onClick={onClose} className="mt-2 w-full rounded-full border border-white/25 py-2.5 text-sm font-semibold">
          Changer de combattant
        </button>
      </motion.div>
    </motion.div>
  )
}

// BOMA FIGHT — pick a fighter, a level and a stage, fight the computer.
// Ngori are paid by the server after replaying the fight (see firebase/bomaFight.js).
function BomaFight() {
  const navigate = useNavigate()
  const { profile: account } = useAuth()
  const { showToast } = useToast()
  const [audio] = useState(() => createGameAudio(loadMuted()))
  const [muted, setMuted] = useState(loadMuted)
  const [fighter, setFighter] = useState(() => readSaved(FIGHTER_KEY, (v) => !!FIGHTERS[v], 'nzame'))
  const [level, setLevel] = useState(() => readSaved(LEVEL_KEY, (v) => !!LEVELS[v], DEFAULT_LEVEL))
  const [stageId, setStageId] = useState(() => readSaved(STAGE_KEY, (v) => STAGES.some((s) => s.id === v), STAGES[0].id))
  const [phase, setPhase] = useState('lobby') // lobby | starting | fighting | result
  const [fight, setFight] = useState(null) // { fightId, seed, fighter, level, opponent }
  const [payload, setPayload] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [stats, setStats] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const balance = account?.ngori || 0
  const info = FIGHTERS[fighter]
  const r = ratings(fighter)
  const stage = STAGES.find((s) => s.id === stageId) || STAGES[0]

  useEffect(() => () => audio.close(), [audio])
  useEffect(() => {
    getMyFightStats()
      .then(setStats)
      .catch(() => {})
  }, [refreshKey])

  function toggleMute() {
    const next = !muted
    setMuted(next)
    saveMuted(next)
    audio.setMuted(next)
  }

  function choose(setter, key) {
    return (value) => {
      setter(value)
      save(key, value)
    }
  }
  const chooseFighter = choose(setFighter, FIGHTER_KEY)
  const chooseLevel = choose(setLevel, LEVEL_KEY)
  const chooseStage = choose(setStageId, STAGE_KEY)

  async function start() {
    audio.unlock() // must happen inside the tap
    setPhase('starting')
    setOutcome(null)
    setSaveError(null)
    setPayload(null)
    try {
      const f = await startFight(fighter, level)
      setFight(f)
      setPhase('fighting')
    } catch (err) {
      showToast(err.message === 'request failed' ? 'Impossible de lancer le combat, réessaie.' : err.message, 'error')
      setPhase('lobby')
    }
  }

  const saveFight = useCallback(
    async (data) => {
      setSaveError(null)
      try {
        const res = await finishFight(fight.fightId, data)
        setOutcome(res)
        if (res.credited > 0) audio.play('reward')
        setRefreshKey((k) => k + 1)
      } catch (err) {
        setSaveError(err.status === 409 ? err.message : 'Impossible d’enregistrer le combat. Vérifie ta connexion.')
      }
    },
    [fight, audio],
  )

  function handleEnd(data) {
    if (data.endTick < 1) {
      setPhase('lobby')
      return
    }
    setPayload(data)
    setPhase('result')
    saveFight(data)
  }

  // Shown while the server replays the fight; its own figures replace these.
  const local = payload && {
    winner: payload.claimed.winner === 0 ? 'me' : payload.claimed.winner === 1 ? 'cpu' : payload.claimed.winner === -1 ? 'draw' : null,
    wins: payload.claimed.wins,
    perfects: null,
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
        <h1 className="flex-1 font-display text-lg font-semibold text-ink">Boma Fight</h1>
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
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1a0b07] via-[#5a1d12] to-[#e2733a] p-5 text-white shadow-xl shadow-orange-900/20">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-amber-300/25 blur-2xl" />
          <p className="relative text-xs font-bold uppercase tracking-[0.25em] text-white/70">BomaVibes présente</p>
          <h2 className="relative mt-1 font-display text-4xl font-black italic tracking-tight">
            BOMA <span className="text-amber-300">FIGHT</span>
          </h2>
          <p className="relative mt-1 text-sm text-white/80">12 combattants du Gabon, un seul champion. Choisis ton guerrier.</p>

          {/* The chosen fighter */}
          <div className="relative mt-4 flex gap-3 rounded-2xl bg-black/25 p-3">
            <img src={PORTRAITS[fighter]} alt="" className="h-40 w-24 shrink-0 rounded-xl object-cover object-top" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl font-black uppercase leading-none">{info.name}</p>
              <p className="mt-0.5 text-xs font-semibold text-amber-200">{info.title}</p>
              <p className="mt-1 text-xs text-white/70">
                {info.weapon} · Spécial : <span className="font-semibold text-white">{info.special}</span>
              </p>
              <div className="mt-2 space-y-1">
                <Stat label="Puissance" value={r.power} />
                <Stat label="Vitesse" value={r.speed} />
                <Stat label="Allonge" value={r.reach} />
                <Stat label="Défense" value={r.defense} />
              </div>
            </div>
          </div>

          {/* Roster */}
          <div className="relative mt-3 grid grid-cols-6 gap-1.5">
            {FIGHTER_IDS.map((id) => {
              const active = id === fighter
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => chooseFighter(id)}
                  aria-pressed={active}
                  aria-label={FIGHTERS[id].name}
                  className={`relative overflow-hidden rounded-xl transition ${active ? 'ring-2 ring-amber-300' : 'opacity-75 ring-1 ring-white/15 hover:opacity-100'}`}
                >
                  <img src={PORTRAITS[id]} alt="" className="aspect-[3/4] w-full object-cover object-top" />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-0.5 py-0.5 text-center text-[9px] font-bold uppercase">
                    {FIGHTERS[id].name}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Level */}
          <p className="relative mt-4 text-xs font-bold uppercase tracking-wide text-white/70">Niveau de l’adversaire</p>
          <div className="relative mt-1.5 grid grid-cols-3 gap-1.5">
            {Object.entries(LEVELS).map(([id, l]) => (
              <button
                key={id}
                type="button"
                onClick={() => chooseLevel(id)}
                aria-pressed={level === id}
                className={`rounded-xl px-2 py-2 text-center transition ${level === id ? 'bg-white text-violet-950' : 'bg-white/10 hover:bg-white/15'}`}
              >
                <p className="font-display text-sm font-bold">{l.name}</p>
                <p className={`text-[11px] ${level === id ? 'text-violet-950/70' : 'text-white/60'}`}>+{l.reward} Ngori</p>
              </button>
            ))}
          </div>

          {/* Stage */}
          <p className="relative mt-4 text-xs font-bold uppercase tracking-wide text-white/70">Arène</p>
          <div className="relative mt-1.5 grid grid-cols-2 gap-1.5">
            {STAGES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => chooseStage(s.id)}
                aria-pressed={stageId === s.id}
                className={`relative h-16 overflow-hidden rounded-xl text-left transition ${stageId === s.id ? 'ring-2 ring-amber-300' : 'opacity-75 hover:opacity-100'}`}
              >
                <img src={s.picture} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-black/50 px-2 py-1 text-[11px] font-semibold">{s.name}</span>
              </button>
            ))}
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={start}
            disabled={phase === 'starting'}
            className="relative mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white py-4 font-display text-base font-black tracking-wide text-violet-950 shadow-lg disabled:opacity-70"
          >
            <Play size={18} fill="currentColor" />
            {phase === 'starting' ? 'PRÉPARATION…' : 'COMBATTRE'}
          </motion.button>
          <p className="relative mt-3 flex items-center justify-center gap-1.5 text-xs text-white/70">
            <NgoriCoin size={16} /> Solde : {balance} Ngori
            {stats ? ` · Gagnés au combat aujourd’hui : ${stats.earnedToday}/${stats.dailyCap}` : ''}
          </p>
          {stats?.stats.fights > 0 && (
            <p className="relative mt-1 text-center text-xs text-white/60">
              {stats.stats.wins} victoire{stats.stats.wins > 1 ? 's' : ''} · {stats.stats.losses} défaite{stats.stats.losses > 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="mt-6 rounded-2xl bg-surface p-4">
          <p className="flex items-center gap-2 font-display text-base font-semibold text-ink">
            <Trophy size={17} className="text-amber-500" /> Les champions de la semaine
          </p>
          <div className="mt-3">
            <Leaderboard refreshKey={refreshKey} />
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {[
            ['◀ ▶ Se déplacer', 'Maintiens les flèches pour avancer ou reculer (← → au clavier).'],
            ['👊 Poing · 🦶 Pied', 'Le poing est rapide, le pied porte plus loin et frappe plus fort (J et K au clavier).'],
            ['🛡️ Garde', 'Maintiens GARDE pour encaisser presque sans dégâts (L au clavier). Elle ne bloque qu’une partie du spécial.'],
            ['⚡ Spécial', 'Frapper et encaisser remplit ta barre bleue. Pleine, le SPÉCIAL envoie l’adversaire au tapis (I ou espace).'],
            ['🪙 Gains', `Deux rounds gagnants pour remporter le combat. Une victoire rapporte 1, 2 ou 3 Ngori selon le niveau, +${PERFECT_BONUS} pour un round parfait, jusqu’à ${stats?.dailyCap ?? 5} Ngori par jour.`],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl bg-surface p-3.5">
              <p className="text-sm font-semibold text-ink">{title}</p>
              <p className="mt-1 text-sm text-ink-soft/70">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {phase === 'fighting' && fight && (
        <FightScreen
          key={fight.fightId}
          seed={fight.seed}
          fighter={fight.fighter}
          level={fight.level}
          stage={stage.picture}
          audio={audio}
          muted={muted}
          onToggleMute={toggleMute}
          onEnd={handleEnd}
        />
      )}
      <AnimatePresence>
        {phase === 'result' && fight && (
          <ResultScreen
            outcome={outcome}
            local={local}
            error={saveError}
            onRetrySave={saveError && payload ? () => saveFight(payload) : null}
            onReplay={start}
            onClose={() => setPhase('lobby')}
            fighter={fight.fighter}
            opponent={fight.opponent}
            level={fight.level}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default BomaFight
