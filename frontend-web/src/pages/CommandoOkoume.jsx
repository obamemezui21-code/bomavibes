import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Crosshair, Lock, Medal, Star, Volume2, VolumeX } from 'lucide-react'
import { CHARACTERS, MISSIONS, MISSION_IDS } from '../../../shared/commando-okoume/engine.mjs'
import { finishCommandoMission, getCommando, startCommandoMission } from '../firebase/commando.js'
import { createCommandoAudio, loadMuted, saveMuted } from '../game/commando/audio.js'
import CommandoScreen from '../game/commando/CommandoScreen.jsx'
import NgoriCoin from '../components/NgoriCoin.jsx'
import { useToast } from '../context/ToastContext.jsx'
import mboumbaPortrait from '../assets/game/commando-mboumba.svg'
import moussavouPortrait from '../assets/game/commando-moussavou.svg'
import cover from '../assets/game/commando-cover.webp'

const PORTRAITS = { mboumba: mboumbaPortrait, moussavou: moussavouPortrait }
const CHARACTER_KEY = 'commando.character'

function readCharacter() {
  try {
    return localStorage.getItem(CHARACTER_KEY) || 'mboumba'
  } catch {
    return 'mboumba'
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

// COMMANDO OKOUMÉ: the unit's lobby (grade, commando, missions, ranking),
// the mission itself (CommandoScreen) and the debriefing.
function CommandoOkoume() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [audio] = useState(() => createCommandoAudio(loadMuted()))
  const [muted, setMuted] = useState(loadMuted)
  const [data, setData] = useState(null) // GET /api/commando
  const [character, setCharacter] = useState(readCharacter)
  const [mission, setMission] = useState(1)
  const [phase, setPhase] = useState('lobby') // lobby | starting | playing | result
  const [run, setRun] = useState(null) // { runId, seed, mission, options }
  const [outcome, setOutcome] = useState(null)
  const [saveError, setSaveError] = useState(null)

  const load = useCallback(() => {
    getCommando()
      .then((d) => {
        setData(d)
        // Open on the furthest mission unlocked.
        setMission((m) => (d.progress.unlocked.includes(m) && m !== 1 ? m : d.progress.unlocked[d.progress.unlocked.length - 1]))
      })
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

  function chooseCharacter(id) {
    setCharacter(id)
    try {
      localStorage.setItem(CHARACTER_KEY, id)
    } catch {
      // not remembered in private mode
    }
  }

  const grade = data?.progress?.grade
  const available = grade?.characters || ['mboumba']
  const chosen = available.includes(character) ? character : available[0]

  async function start() {
    audio.unlock() // inside the tap, or the browser keeps the sound off
    setOutcome(null)
    setSaveError(null)
    setPhase('starting')
    try {
      const r = await startCommandoMission(mission, chosen)
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
        const res = await finishCommandoMission(run.runId, payload)
        setOutcome(res)
        load()
      } catch (err) {
        setSaveError(err.status === 409 ? err.message : 'Impossible d’enregistrer la mission. Vérifie ta connexion.')
      }
    },
    [run, load],
  )

  const progress = data?.progress
  const xpRatio = grade?.nextXp ? Math.min(1, grade.xp / grade.nextXp) : 1

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
        <h1 className="flex-1 font-display text-lg font-semibold text-ink">Commando Okoumé</h1>
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
        {/* Grade card */}
        <div className="relative overflow-hidden rounded-[28px] bg-[#14200c] p-5 text-white shadow-xl">
          <img src={cover} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/20" />
          <div className="relative">
          <p className="font-mono text-[11px] tracking-[0.25em] text-amber-300">UNITÉ OKOUMÉ · GABON</p>
          <p className="mt-1 font-display text-2xl font-bold">Commando Okoumé</p>
          <p className="mt-1 text-sm text-white/80">
            Le réseau du Serpent Noir pille le pays : braconnage, orpaillage illégal, trafic d’ivoire. Ton unité doit le démanteler.
          </p>
          {!data ? (
            <div className="mt-4 h-10 animate-pulse rounded-xl bg-white/10" />
          ) : data.failed ? (
            <p className="mt-4 text-sm text-red-200">Impossible de charger ta progression. Réessaie plus tard.</p>
          ) : (
            <div className="mt-4 rounded-2xl bg-black/25 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Medal size={16} className="text-amber-300" />
                  {grade.name}
                </span>
                <span className="flex items-center gap-1 text-xs text-white/80">
                  <NgoriCoin size={14} /> {data.earnedToday}/{data.dailyCap} aujourd’hui
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${xpRatio * 100}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-white/70">
                {grade.nextName ? `${grade.xp} / ${grade.nextXp} XP · prochain grade : ${grade.nextName}` : `${grade.xp} XP · grade maximal`}
                {' · '}
                {grade.maxHp} cœurs
              </p>
            </div>
          )}
          </div>
        </div>

        {/* Commando choice */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">Ton commando</h2>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(CHARACTERS).map(([id, c]) => {
              const locked = !available.includes(id)
              const active = chosen === id
              return (
                <button
                  key={id}
                  type="button"
                  disabled={locked}
                  onClick={() => chooseCharacter(id)}
                  className={`relative flex flex-col items-start gap-2 rounded-2xl p-3 text-left transition ${
                    active ? 'bg-white ring-2 ring-amber-400 dark:bg-surface-tint' : 'bg-white/70 ring-1 ring-ink/8 dark:bg-surface-tint/60'
                  } disabled:opacity-60`}
                >
                  <img src={PORTRAITS[id]} alt="" className="h-14 w-14 rounded-xl" style={{ imageRendering: 'pixelated' }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{c.name}</p>
                    <p className="text-[11px] text-ink-soft/70">{c.corps}</p>
                    <p className="mt-1 text-[11px] text-ink-soft">
                      <b>{c.special}</b> : {c.specialText}
                    </p>
                  </div>
                  {locked && (
                    <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                      <Lock size={10} /> Grade Caporal
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* Missions */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink">Missions</h2>
          <div className="space-y-2">
            {MISSION_IDS.map((id) => {
              const m = MISSIONS[id]
              const unlocked = progress?.unlocked?.includes(id) ?? id === 1
              const done = progress?.missions?.[id]
              const active = mission === id
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => setMission(id)}
                  className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
                    active ? 'bg-white ring-2 ring-amber-400 dark:bg-surface-tint' : 'bg-white/70 ring-1 ring-ink/8 dark:bg-surface-tint/60'
                  } disabled:opacity-55`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2f4a17] font-mono text-sm font-bold text-amber-300">
                    {unlocked ? id : <Lock size={15} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{m.name}</span>
                    <span className="block truncate text-[11px] text-ink-soft/70">
                      {m.place} · {m.goal}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <Stars count={done?.stars || 0} size={12} />
                    {done?.best > 0 && <span className="font-mono text-[10px] text-ink-soft/60">{done.best}</span>}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-ink-soft/60">
            ⭐ mission réussie · ⭐ tous les otages libérés · ⭐ une blessure au plus. Chaque étoile vaut 1 Ngori (5 par jour).
          </p>
        </section>

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          disabled={phase === 'starting' || !data || data.failed}
          onClick={start}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2f4a17] to-[#7a2a1a] py-3.5 font-display text-base font-bold tracking-wide text-white shadow-lg disabled:opacity-60"
        >
          <Crosshair size={18} />
          {phase === 'starting' ? 'PRÉPARATION…' : `LANCER LA MISSION ${mission}`}
        </motion.button>

        {/* Leaderboard */}
        {data?.leaderboard?.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-ink">Classement de l’unité</h2>
            <ol className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8 dark:bg-surface-tint">
              {data.leaderboard.map((p, i) => (
                <li key={i} className={`flex items-center gap-3 px-3 py-2 text-sm ${p.me ? 'bg-amber-400/15' : ''} ${i ? 'border-t border-ink/6' : ''}`}>
                  <span className="w-5 text-center font-mono text-xs font-bold text-ink-soft">{i + 1}</span>
                  {p.photo ? (
                    <img src={p.photo} alt="" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <span className="h-7 w-7 rounded-full bg-ink/10" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">
                    {p.firstName}
                    <span className="ml-1.5 text-[11px] text-ink-soft/60">{p.grade}</span>
                  </span>
                  <span className="font-mono text-xs font-semibold text-ink">{p.totalScore}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {phase === 'playing' && run && (
        <CommandoScreen
          seed={run.seed}
          mission={run.mission}
          options={run.options}
          audio={audio}
          muted={muted}
          onToggleMute={toggleMute}
          onEnd={handleEnd}
        />
      )}

      {/* Debriefing */}
      <AnimatePresence>
        {phase === 'result' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[96] flex items-center justify-center bg-black/80 p-4"
          >
            <motion.div
              initial={{ y: 20, scale: 0.96 }}
              animate={{ y: 0, scale: 1 }}
              className="w-full max-w-sm rounded-3xl bg-[#14200c] p-5 text-center text-white"
            >
              {!outcome && !saveError && <p className="py-8 text-sm text-white/70">Le QG vérifie ta mission…</p>}
              {saveError && (
                <>
                  <p className="py-4 text-sm text-red-200">{saveError}</p>
                  <button type="button" onClick={() => setPhase('lobby')} className="rounded-full bg-white px-6 py-2 text-sm font-bold text-black">
                    Retour au QG
                  </button>
                </>
              )}
              {outcome && (
                <>
                  <p className="font-mono text-[11px] tracking-[0.25em] text-amber-300">MISSION {outcome.result.mission}</p>
                  <p className={`mt-1 font-display text-2xl font-bold ${outcome.result.completed ? 'text-amber-300' : 'text-red-300'}`}>
                    {outcome.result.completed ? 'Mission accomplie' : 'Mission échouée'}
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
                      <p className="text-base font-bold">{outcome.result.kills}</p>
                      <p className="text-white/60">hors de combat</p>
                    </div>
                    <div className="rounded-xl bg-white/10 p-2">
                      <p className="text-base font-bold">
                        {outcome.result.hostagesFreed}/{outcome.result.hostagesTotal}
                      </p>
                      <p className="text-white/60">otages</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm">
                    +{outcome.xpGained} XP
                    {outcome.credited > 0 && (
                      <span className="ml-2 inline-flex items-center gap-1 font-semibold text-amber-300">
                        +{outcome.credited} <NgoriCoin size={14} />
                      </span>
                    )}
                  </p>
                  {outcome.newBest && <p className="mt-1 text-xs text-amber-200">Nouveau record sur cette mission !</p>}
                  {outcome.promoted && (
                    <p className="mt-3 rounded-xl bg-amber-400 px-3 py-2 text-sm font-bold text-black">
                      🎖️ Promotion : tu passes {outcome.promoted} !
                    </p>
                  )}
                  {outcome.unlocked && (
                    <p className="mt-2 rounded-xl bg-white/10 px-3 py-2 text-sm">🔓 Mission {outcome.unlocked} débloquée : {MISSIONS[outcome.unlocked].name}</p>
                  )}
                  {outcome.anomaly && (
                    <p className="mt-2 text-[11px] text-red-200">Cette partie n’a pas pu être validée : rien n’a été compté.</p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (outcome.unlocked) setMission(outcome.unlocked)
                      setPhase('lobby')
                    }}
                    className="mt-5 w-full rounded-2xl bg-amber-400 py-3 font-display font-bold text-black"
                  >
                    Retour au QG
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

export default CommandoOkoume
