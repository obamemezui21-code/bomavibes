import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, BarChart3, Gift, HelpCircle, Play, Trophy, Volume2, VolumeX } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { finishNgoriRun, getMyNgoriRunStats, getNgoriRunLeaderboard, startNgoriRun } from '../firebase/ngoriRun.js'
import { REWARDS } from '../lib/ngori.js'
import { fallbackToFullPhoto, photoVariant } from '../lib/photoVariants.js'
import { createGameAudio, loadMuted, saveMuted } from '../game/ngoriRun/audio.js'
import GameScreen from '../game/ngoriRun/GameScreen.jsx'
import { districtAt, placeVenues } from '../game/ngoriRun/libreville.js'
import { fetchPublishedVenues } from '../firebase/venues.js'
import NgoriCoin from '../components/NgoriCoin.jsx'
import kevinPortrait from '../assets/game/kevin.webp'
import aichaPortrait from '../assets/game/aicha.webp'

const BUTTONS_KEY = 'ngoriRun.buttons'
const RUNNER_KEY = 'ngoriRun.runner'
// The two heroes (their in-game sprites: renderer.js RUNNERS). Purely
// cosmetic: both play by exactly the same rules.
const RUNNER_CHOICES = [
  { id: 'man', name: 'Kévin', title: 'Le déterminé', portrait: kevinPortrait, ring: 'ring-amber-400' },
  { id: 'woman', name: 'Aïcha', title: 'La rapide', portrait: aichaPortrait, ring: 'ring-fuchsia-400' },
]

function readRunner() {
  try {
    return localStorage.getItem(RUNNER_KEY) === 'woman' ? 'woman' : 'man'
  } catch {
    return 'man'
  }
}
const TABS = [
  { id: 'leaderboard', label: 'Classement', icon: Trophy },
  { id: 'rewards', label: 'Récompenses', icon: Gift },
  { id: 'stats', label: 'Mes stats', icon: BarChart3 },
  { id: 'help', label: 'Comment jouer', icon: HelpCircle },
]

function readFlag(key) {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key, value) {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // not remembered in private mode
  }
}

const fmt = (n) => (n || 0).toLocaleString('fr-FR')

// The next reward still out of reach, and how close the balance is to it.
function nextGoal(balance) {
  const reward = REWARDS.find((r) => r.cost > balance)
  return reward ? { reward, missing: reward.cost - balance, ratio: balance / reward.cost } : null
}

function GoalBar({ balance, dark }) {
  const goal = nextGoal(balance)
  if (!goal) {
    return <p className={`text-sm ${dark ? 'text-white/80' : 'text-ink-soft/70'}`}>Tu peux débloquer toutes les récompenses 🎉</p>
  }
  return (
    <div>
      <div className={`flex justify-between text-xs font-semibold ${dark ? 'text-white/80' : 'text-ink-soft/70'}`}>
        <span>
          {goal.reward.emoji} {goal.reward.label}
        </span>
        <span className="tabular-nums">
          {balance} / {goal.reward.cost}
        </span>
      </div>
      <div className={`mt-1.5 h-2.5 overflow-hidden rounded-full ${dark ? 'bg-white/15' : 'bg-ink/10'}`}>
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#ffe08a] to-gold"
          initial={{ width: 0 }}
          animate={{ width: `${goal.ratio * 100}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <p className={`mt-1.5 text-xs ${dark ? 'text-white/70' : 'text-ink-soft/60'}`}>
        Encore <strong>{goal.missing} Ngori</strong> pour débloquer {goal.reward.label.toLowerCase()} ({goal.reward.duration}).
      </p>
    </div>
  )
}

function Leaderboard({ refreshKey }) {
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    getNgoriRunLeaderboard()
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  if (failed) return <p className="py-8 text-center text-sm text-ink-soft/60">Classement indisponible pour le moment.</p>
  if (!data) return <div className="mx-auto my-8 h-7 w-7 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
  if (!data.top.length) {
    return <p className="py-8 text-center text-sm text-ink-soft/60">Personne n'a encore couru cette semaine. Sois le premier ! 🏃</p>
  }
  const medal = (rank) => ['🥇', '🥈', '🥉'][rank - 1] || rank
  const rows = data.me && !data.top.some((e) => e.isMe) ? [...data.top, null, data.me] : data.top
  return (
    <div>
      <p className="mb-3 text-xs text-ink-soft/60">Cette semaine · meilleur score de chaque joueur · remis à zéro chaque lundi</p>
      <ol className="space-y-2">
        {rows.map((e, i) =>
          e === null ? (
            <li key="sep" className="text-center text-ink-soft/40">⋯</li>
          ) : (
            <li
              key={`${e.rank}-${i}`}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${e.isMe ? 'bg-violet-500/12 ring-1 ring-violet-500/30' : 'bg-surface'}`}
            >
              <span className="w-7 text-center font-display text-base font-bold text-ink">{medal(e.rank)}</span>
              {e.photo ? (
                <img
                  src={photoVariant(e.photo, 'thumb')}
                  onError={fallbackToFullPhoto(e.photo)}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/15 text-sm font-bold text-violet-600">
                  {e.firstName?.[0] || '?'}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {e.firstName}
                  {e.isMe ? ' (toi)' : ''}
                </p>
                <p className="text-xs text-ink-soft/60">
                  {fmt(e.distance)} m · 📍 {districtAt(e.distance)} · {e.ngoriEarned} Ngori
                </p>
              </div>
              <span className="font-display text-sm font-bold tabular-nums text-ink">{fmt(e.score)}</span>
            </li>
          ),
        )}
      </ol>
    </div>
  )
}

function Stats({ refreshKey }) {
  const [data, setData] = useState(null)
  const [rank, setRank] = useState(null)
  useEffect(() => {
    let cancelled = false
    getMyNgoriRunStats()
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData({ failed: true }))
    getNgoriRunLeaderboard()
      .then((d) => !cancelled && setRank(d.me?.rank ?? null))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  if (!data) return <div className="mx-auto my-8 h-7 w-7 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
  if (data.failed) return <p className="py-8 text-center text-sm text-ink-soft/60">Statistiques indisponibles pour le moment.</p>
  const s = data.stats
  const tiles = [
    ['🏁', 'Meilleure distance', `${fmt(s.bestDistance)} m`],
    ['📍', 'Quartier le plus loin', s.games ? districtAt(s.bestDistance) : '—'],
    ['⭐', 'Meilleur score', fmt(s.bestScore)],
    ['🪙', 'Ngori ramassés', fmt(s.totalCollected)],
    ['💰', 'Ngori gagnés', fmt(s.totalEarned)],
    ['🎮', 'Parties', fmt(s.games)],
    ['🔥', 'Meilleur combo', `×${s.bestCombo}`],
    ['🏆', 'Classement', rank ? `${rank}ᵉ cette semaine` : '—'],
    ['📅', "Gagnés aujourd'hui", `${data.earnedToday} / ${data.dailyCap}`],
  ]
  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map(([emoji, label, value]) => (
        <div key={label} className="rounded-2xl bg-surface p-3.5">
          <p className="text-lg">{emoji}</p>
          <p className="mt-1 font-display text-lg font-bold text-ink">{value}</p>
          <p className="text-xs text-ink-soft/60">{label}</p>
        </div>
      ))}
    </div>
  )
}

function Rewards({ balance }) {
  const navigate = useNavigate()
  return (
    <div className="space-y-2.5">
      {REWARDS.map((r) => (
        <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-lg">{r.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{r.label}</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/10">
              <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(1, balance / r.cost) * 100}%` }} />
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-ink">
            <NgoriCoin size={15} />
            {r.cost}
          </span>
        </div>
      ))}
      <button
        type="button"
        onClick={() => navigate('/ngori')}
        className="mt-2 w-full rounded-full bg-violet-950 py-3 text-sm font-semibold text-white dark:bg-pink-500"
      >
        Utiliser mes Ngori
      </button>
    </div>
  )
}

function Help({ dailyCap }) {
  const sections = [
    ['👆 Commandes', 'Glisse ← ou → pour changer de voie, ↑ pour sauter, ↓ pour glisser. Sur ordinateur : les flèches du clavier (Échap pour la pause).'],
    ['🚧 Obstacles', 'Barrières, cônes et trous : saute par-dessus. Banderoles : glisse dessous. Taxis et travaux : change de voie !'],
    ['🪙 Ngori', 'Pièce normale +1, pièce dorée +3. Enchaîne-les sans en rater : 5 d’affilée = +1, 10 = +2, 20 = +5.'],
    ['📍 Le parcours', 'Tu longes la côte du Bord de mer jusqu’au Cap Estérias : Louis, Batterie IV, La Sablière, Les Charbonnages, Okala, Angondjé… Après 5 km, c’est le Tour de Libreville par Glass, Oloumi et Owendo !'],
    ['🏁 Distance', 'Bonus à 500 m (+1), 1 km (+2), 2 km (+3) et 5 km (+5). La vitesse augmente toutes les 30 secondes.'],
    ['⚡ Bonus rares', '🛡️ Bouclier : encaisse un choc. 🧲 Aimant : attire les Ngori. ×2 : double les Ngori. ⚡ Boost : vitesse et invincibilité.'],
    ['💰 Gains', `Tes Ngori ramassés sont crédités sur ton solde, jusqu'à ${dailyCap} Ngori par jour grâce au jeu. Ensuite tu peux continuer à jouer pour le classement !`],
  ]
  return (
    <div className="space-y-2.5">
      {sections.map(([title, text]) => (
        <div key={title} className="rounded-2xl bg-surface p-3.5">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-1 text-sm text-ink-soft/70">{text}</p>
        </div>
      ))}
    </div>
  )
}

function ResultScreen({ outcome, local, error, onRetrySave, onReplay, onClose, balance, hero }) {
  const navigate = useNavigate()
  const r = outcome?.result || local
  const capped = outcome && outcome.credited < r.total && !outcome.anomaly
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
        className="w-full max-w-sm rounded-[28px] bg-violet-950 p-6 text-white shadow-2xl"
      >
        <img src={hero.portrait} alt="" className={`mx-auto mb-3 h-16 w-16 rounded-full object-cover ring-2 ${hero.ring}`} />
        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-pink-300">Course terminée</p>
        <h2 className="mt-1 text-center font-display text-2xl font-bold">
          {r.distance >= 1000
            ? `🔥 Belle course, ${hero.name} !`
            : r.distance >= 300
              ? `👏 Bien joué, ${hero.name} !`
              : `💪 On recommence, ${hero.name} ?`}
        </h2>
        <p className="mt-1 text-center text-sm text-white/75">
          {districtAt(r.distance) === districtAt(0)
            ? 'Encore un effort pour sortir du Bord de mer !'
            : `Tu es ${hero.id === 'woman' ? 'allée' : 'allé'} jusqu'à 📍 ${districtAt(r.distance)}`}
        </p>
        {(outcome?.newBestScore || outcome?.newBestDistance) && (
          <p className="mt-2 text-center">
            <span className="rounded-full bg-gold/20 px-3 py-1 text-xs font-bold text-amber-200">🏆 Nouveau record personnel !</span>
          </p>
        )}

        <dl className="mt-5 space-y-2 text-sm">
          {[
            ['Distance', `${fmt(r.distance)} m`],
            ['Quartier atteint', `📍 ${districtAt(r.distance)}`],
            ['Score', fmt(r.score)],
            ['Ngori ramassés', r.coins],
            ['Bonus', `+${r.bonus}`],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between border-b border-white/10 pb-2">
              <dt className="text-white/70">{label}</dt>
              <dd className="font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 rounded-2xl bg-white/8 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Total</p>
          <p className="mt-1 flex items-center justify-center gap-2 font-display text-3xl font-bold">
            {outcome ? outcome.credited : '…'} <NgoriCoin size={30} />
          </p>
          {outcome && (
            <p className="mt-1 text-xs text-white/70">
              {outcome.anomaly
                ? 'Course non validée : aucun Ngori crédité.'
                : capped
                  ? `${r.total} ramassés · limite du jeu atteinte aujourd'hui (${outcome.earnedToday}/${outcome.dailyCap}). Reviens demain !`
                  : `crédités sur ton solde · ${outcome.earnedToday}/${outcome.dailyCap} gagnés en jouant aujourd'hui`}
            </p>
          )}
          {error && (
            <div className="mt-2">
              <p className="text-xs text-coral-400">{error}</p>
              {onRetrySave && (
                <button type="button" onClick={onRetrySave} className="mt-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold">
                  Réessayer d'enregistrer
                </button>
              )}
            </div>
          )}
          {!outcome && !error && <p className="mt-1 text-xs text-white/60">Vérification de la course…</p>}
        </div>

        <div className="mt-4">
          <p className="mb-2 text-center text-sm font-semibold">Tu es maintenant à {balance} Ngori</p>
          <GoalBar balance={balance} dark />
        </div>

        <button
          type="button"
          onClick={onReplay}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-bold text-violet-950"
        >
          <Play size={16} fill="currentColor" /> Rejouer
        </button>
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => navigate('/ngori')} className="flex-1 rounded-full border border-white/25 py-2.5 text-sm font-semibold">
            Mes récompenses
          </button>
          <button type="button" onClick={onClose} className="flex-1 rounded-full border border-white/25 py-2.5 text-sm font-semibold">
            Fermer
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// NGORI RUN — lobby, the run itself and the result. Ngori are paid by the
// server after replaying the run (see firebase/ngoriRun.js).
function NgoriRun() {
  const navigate = useNavigate()
  const { profile: account } = useAuth()
  const { showToast } = useToast()
  const [audio] = useState(() => createGameAudio(loadMuted()))
  const [muted, setMuted] = useState(loadMuted)
  const [showButtons, setShowButtons] = useState(() => readFlag(BUTTONS_KEY))
  const [runner, setRunner] = useState(readRunner)
  const [billboards, setBillboards] = useState([])
  const [tab, setTab] = useState('leaderboard')
  const [phase, setPhase] = useState('lobby') // lobby | starting | playing | result
  const [run, setRun] = useState(null) // { runId, seed }
  const [payload, setPayload] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [today, setToday] = useState(null) // { earnedToday, dailyCap }
  const [refreshKey, setRefreshKey] = useState(0)
  const balance = account?.ngori || 0

  useEffect(() => () => audio.close(), [audio])

  // The Coins Chics venues become billboards along the route.
  useEffect(() => {
    let cancelled = false
    fetchPublishedVenues()
      .then((venues) => !cancelled && setBillboards(placeVenues(venues)))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    getMyNgoriRunStats()
      .then((d) => setToday({ earnedToday: d.earnedToday, dailyCap: d.dailyCap }))
      .catch(() => {})
  }, [refreshKey])

  function toggleMute() {
    const next = !muted
    setMuted(next)
    saveMuted(next)
    audio.setMuted(next)
  }

  async function start() {
    audio.unlock() // must happen inside the tap
    setPhase('starting')
    setOutcome(null)
    setSaveError(null)
    setPayload(null)
    try {
      const r = await startNgoriRun()
      setRun({ runId: r.runId, seed: r.seed })
      setToday({ earnedToday: r.earnedToday, dailyCap: r.dailyCap })
      setPhase('playing')
    } catch (err) {
      showToast(err.message === 'request failed' ? 'Impossible de lancer la course, réessaie.' : err.message, 'error')
      setPhase('lobby')
    }
  }

  const save = useCallback(
    async (data) => {
      setSaveError(null)
      try {
        const res = await finishNgoriRun(run.runId, data)
        setOutcome(res)
        setToday({ earnedToday: res.earnedToday, dailyCap: res.dailyCap })
        if (res.credited > 0) audio.play('reward')
        setRefreshKey((k) => k + 1)
      } catch (err) {
        // 409: already saved (e.g. a retry after a timeout that did go through).
        setSaveError(err.status === 409 ? err.message : "Impossible d'enregistrer la course. Vérifie ta connexion.")
      }
    },
    [run, audio],
  )

  function handleEnd(data) {
    if (data.endTick < 1) {
      // Quit during the countdown: nothing was played.
      setPhase('lobby')
      return
    }
    setPayload(data)
    setPhase('result')
    save(data)
  }

  // Shown while the server replays the run; its own figures replace these.
  const local = payload && { ...payload.claimed, total: payload.claimed.coins + payload.claimed.bonus }

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
        <h1 className="flex-1 font-display text-lg font-semibold text-ink">Ngori Run</h1>
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
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#2a0f45] via-[#5b1f6e] to-[#e9467d] p-5 text-white shadow-xl shadow-violet-900/20">
          <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[#ffb36b]/40 blur-2xl" />
          <p className="relative text-xs font-bold uppercase tracking-[0.25em] text-white/70">BomaVibes présente</p>
          <h2 className="relative mt-1 font-display text-4xl font-black italic tracking-tight">
            NGORI <span className="text-gold">RUN</span>
          </h2>
          <p className="relative mt-1 text-sm text-white/80">Cours sur le bord de mer, esquive, ramasse des Ngori.</p>

          <div className="relative mt-4 flex items-center gap-2">
            <NgoriCoin size={30} />
            <p className="text-sm">
              Ton solde : <span className="font-display text-xl font-bold">{balance}</span> Ngori
            </p>
          </div>
          {today && (
            <p className="relative mt-1 text-xs text-white/70">
              Gagnés en jouant aujourd'hui : {today.earnedToday}/{today.dailyCap}
              {today.earnedToday >= today.dailyCap ? ' · joue pour le classement !' : ''}
            </p>
          )}
          <div className="relative mt-4">
            <GoalBar balance={balance} dark />
          </div>

          <div className="relative mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Choisis ton héros</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {RUNNER_CHOICES.map((choice) => {
                const active = runner === choice.id
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => {
                      setRunner(choice.id)
                      try {
                        localStorage.setItem(RUNNER_KEY, choice.id)
                      } catch {
                        // not remembered in private mode
                      }
                    }}
                    aria-pressed={active}
                    className={`flex items-center gap-2 rounded-2xl p-1.5 pr-3 text-left text-sm font-semibold transition ${
                      active ? 'bg-white text-violet-950 shadow-lg' : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <img
                      src={choice.portrait}
                      alt=""
                      className={`h-12 w-12 shrink-0 rounded-full object-cover ring-2 ${active ? choice.ring : 'ring-white/30'}`}
                    />
                    <span className="min-w-0">
                      <span className="block font-display text-base font-bold leading-tight">{choice.name}</span>
                      <span className={`block text-[11px] font-medium ${active ? 'text-violet-950/60' : 'text-white/60'}`}>
                        {choice.title}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={start}
            disabled={phase === 'starting'}
            className="relative mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white py-4 font-display text-base font-black tracking-wide text-violet-950 shadow-lg disabled:opacity-70"
          >
            <Play size={18} fill="currentColor" />
            {phase === 'starting' ? 'PRÉPARATION…' : 'COMMENCER LA COURSE'}
          </motion.button>
          <label className="relative mt-3 flex cursor-pointer items-center justify-center gap-2 text-xs text-white/75">
            <input
              type="checkbox"
              checked={showButtons}
              onChange={(e) => {
                setShowButtons(e.target.checked)
                writeFlag(BUTTONS_KEY, e.target.checked)
              }}
              className="accent-pink-500"
            />
            Afficher les boutons tactiles
          </label>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-1 rounded-2xl bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition ${
                tab === t.id ? 'bg-violet-500/12 text-violet-600' : 'text-ink-soft/60 hover:text-ink'
              }`}
            >
              <t.icon size={17} strokeWidth={2.25} />
              {t.label}
            </button>
          ))}
        </div>
        <div className="mt-4">
          {tab === 'leaderboard' && <Leaderboard refreshKey={refreshKey} />}
          {tab === 'rewards' && <Rewards balance={balance} />}
          {tab === 'stats' && <Stats refreshKey={refreshKey} />}
          {tab === 'help' && <Help dailyCap={today?.dailyCap ?? 5} />}
        </div>
      </div>

      {phase === 'playing' && run && (
        <GameScreen
          key={run.runId}
          seed={run.seed}
          runner={runner}
          billboards={billboards}
          audio={audio}
          muted={muted}
          onToggleMute={toggleMute}
          showButtons={showButtons}
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
            balance={balance}
            hero={RUNNER_CHOICES.find((c) => c.id === runner) || RUNNER_CHOICES[0]}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default NgoriRun
