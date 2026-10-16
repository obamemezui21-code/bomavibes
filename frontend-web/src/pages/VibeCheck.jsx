import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, BadgeCheck, Check, Heart, Lock, MessageCircle, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { getVibeCheck, getVibeResults, sendVibe, submitVibeAnswers } from '../firebase/vibeCheck.js'
import { isQuotaError } from '../firebase/swipes.js'
import { fallbackToFullPhoto, photoVariant } from '../lib/photoVariants.js'
import NgoriCoin from '../components/NgoriCoin.jsx'
import { ageSuffix } from '../lib/profileDisplay.js'

const PREF_OPTIONS = [
  { value: 'FEMME', label: 'Des femmes', emoji: '👩🏾' },
  { value: 'HOMME', label: 'Des hommes', emoji: '👨🏾' },
  { value: 'TOUS', label: 'Tout le monde', emoji: '💜' },
]

// The default "who I want to meet": the other gender, when the profile says.
function defaultPref(gender) {
  if (gender === 'HOMME') return 'FEMME'
  if (gender === 'FEMME') return 'HOMME'
  return 'TOUS'
}

function PrefStep({ gender, onPick }) {
  const suggested = defaultPref(gender)
  return (
    <div className="mx-auto max-w-md px-4 pt-8 text-center">
      <p className="text-5xl">💜</p>
      <h2 className="mt-3 font-display text-2xl font-black text-ink">Le match à l’aveugle</h2>
      <p className="mt-2 text-sm text-ink-soft">
        Réponds chaque jour à 8 questions « ceci ou cela ». On te montre les membres avec qui tu as le plus de vibe, <strong>photo cachée</strong> :
        ici, on choisit d’abord la personnalité.
      </p>
      <p className="mt-6 text-sm font-bold text-ink">Tu veux rencontrer…</p>
      <div className="mt-3 space-y-2">
        {PREF_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onPick(o.value)}
            className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left font-bold text-ink transition active:scale-[0.98] ${
              o.value === suggested ? 'border-violet-500 bg-violet-500/8' : 'border-ink/10 bg-surface'
            }`}
          >
            <span className="text-2xl">{o.emoji}</span> {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function QuizStep({ questions, onDone, busy }) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const q = questions[index]

  function pick(choice) {
    const next = { ...answers, [q.id]: choice }
    setAnswers(next)
    if (index + 1 < questions.length) setIndex(index + 1)
    else onDone(next)
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 pt-5">
      <div className="flex gap-1">
        {questions.map((item, i) => (
          <span key={item.id} className={`h-1.5 flex-1 rounded-full ${i <= index ? 'bg-violet-500' : 'bg-ink/10'}`} />
        ))}
      </div>
      <p className="mt-3 text-center text-xs font-bold uppercase tracking-[0.2em] text-ink-soft">
        Question {index + 1} / {questions.length}
      </p>
      <AnimatePresence mode="wait">
        <motion.div
          key={q.id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.2 }}
        >
          <h2 className="mt-6 text-center font-display text-3xl font-black text-ink">{q.text}</h2>
          <div className="mt-8 space-y-3">
            {[q.a, q.b].map((label, choice) => (
              <button
                key={choice}
                type="button"
                disabled={busy}
                onClick={() => pick(choice)}
                className={`w-full rounded-3xl px-5 py-6 text-lg font-bold text-white shadow-lg transition active:scale-[0.97] disabled:opacity-60 ${
                  choice === 0 ? 'bg-gradient-to-br from-violet-500 to-violet-600' : 'bg-gradient-to-br from-heart-500 to-heart-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-ink-soft">Pas de bonne réponse : sois toi-même, c’est comme ça qu’on trouve sa vibe.</p>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Avatar({ card }) {
  if (card.photo) {
    return (
      <img
        src={photoVariant(card.photo, 'thumb')}
        onError={fallbackToFullPhoto(card.photo)}
        alt={card.firstName}
        className="h-16 w-16 shrink-0 rounded-2xl object-cover"
      />
    )
  }
  return (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-heart-500 to-gold text-white">
      <Lock size={20} />
    </span>
  )
}

function VibeCard({ card, onVibe, busy }) {
  return (
    <motion.div layout className="rounded-3xl bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar card={card} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate font-display text-lg font-bold text-ink">
            {card.firstName}
            {ageSuffix(card)}
            {card.verified && <BadgeCheck size={16} className="shrink-0 text-violet-500" />}
          </p>
          {card.city && <p className="truncate text-xs text-ink-soft">{card.city}</p>}
          {card.vibeReceived && !card.vibeSent && (
            <p className="mt-0.5 text-xs font-bold text-heart-600">💜 T’a envoyé sa vibe</p>
          )}
        </div>
        {card.percent != null && (
          <div className="shrink-0 text-right">
            <p className="font-display text-3xl font-black leading-none text-violet-600">{card.percent}%</p>
            <p className="text-[11px] text-ink-soft">de vibe</p>
          </div>
        )}
      </div>

      {card.agreed.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">
            Vous êtes d’accord sur :
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {card.agreed.map((a) => (
              <span key={a.text} className="rounded-full bg-surface-tint px-2.5 py-1 text-xs text-ink" title={a.text}>
                {a.choice}
              </span>
            ))}
          </div>
        </div>
      )}

      {card.vibeSent ? (
        <p className="mt-3 flex items-center justify-center gap-1.5 rounded-full bg-surface-soft py-2.5 text-sm font-bold text-ink-soft">
          <Check size={16} /> Vibe envoyée, en attente de la sienne
        </p>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => onVibe(card)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-heart-600 py-3 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          <Heart size={16} fill="currentColor" /> {card.vibeReceived ? 'Renvoyer ma vibe' : 'Envoyer ma vibe'}
        </button>
      )}
    </motion.div>
  )
}

function MatchModal({ match, onClose }) {
  const navigate = useNavigate()
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-gradient-to-br from-violet-600 to-heart-600 p-6 text-center text-white"
      >
        <p className="font-display text-3xl font-black italic">C’est un match ! 💜</p>
        {match.photo && <img src={match.photo} alt="" className="mx-auto mt-5 h-36 w-36 rounded-full object-cover ring-4 ring-white/60" />}
        <p className="mt-4 text-sm text-white/90">
          Toi et {match.firstName} avez {match.percent != null ? `${match.percent} % de vibe` : 'la même vibe'}. Lance la conversation sur ce que vous
          avez en commun !
        </p>
        {match.credited > 0 && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-sm font-bold">
            <NgoriCoin size={16} /> +{match.credited} Ngori
          </p>
        )}
        <button
          type="button"
          onClick={() => navigate(`/chat/${match.matchId}`)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 font-bold text-violet-950"
        >
          <MessageCircle size={18} /> Lui écrire
        </button>
        <button type="button" onClick={onClose} className="mt-2 w-full py-2 text-sm text-white/80">
          Continuer à jouer
        </button>
      </motion.div>
    </motion.div>
  )
}

function Results({ results, onVibe, busyId }) {
  const empty = !results.received.length && !results.top.length
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 pt-5">
      <div className="flex items-center gap-3 rounded-2xl bg-violet-500/10 p-4 text-sm text-ink">
        <Sparkles size={20} className="shrink-0 text-violet-600" />
        <p>Réponses du jour enregistrées. Reviens demain pour 8 nouvelles questions : plus tu joues, plus ton % de vibe est précis.</p>
      </div>

      {results.received.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-ink">💜 Ils t’ont envoyé leur vibe</h2>
          {results.received.map((card) => (
            <VibeCard key={card.id} card={card} onVibe={onVibe} busy={busyId === card.id} />
          ))}
        </section>
      )}

      {results.top.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-ink">Tes meilleures vibes</h2>
          <p className="-mt-2 text-xs text-ink-soft">La photo se dévoile quand tu envoies ta vibe. Si c’est réciproque, c’est un match !</p>
          {results.top.map((card) => (
            <VibeCard key={card.id} card={card} onVibe={onVibe} busy={busyId === card.id} />
          ))}
        </section>
      )}

      {empty && (
        <div className="rounded-3xl bg-surface p-6 text-center">
          <p className="text-4xl">🔮</p>
          <p className="mt-2 font-bold text-ink">Pas encore assez de réponses en commun</p>
          <p className="mt-1 text-sm text-ink-soft">
            Il faut au moins 5 questions en commun avec quelqu’un pour calculer votre vibe. Reviens demain, et parles-en autour de toi !
          </p>
        </div>
      )}
    </div>
  )
}

// "Vibe Check" — blind matching on the day's "ceci ou cela" answers.
function VibeCheck() {
  const navigate = useNavigate()
  const { profile: account } = useAuth()
  const { showToast } = useToast()
  const [game, setGame] = useState(null)
  const [pref, setPref] = useState(null)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [match, setMatch] = useState(null)
  const [quotaHit, setQuotaHit] = useState(false)

  useEffect(() => {
    getVibeCheck()
      .then(async (g) => {
        setGame(g)
        setPref(g.pref)
        if (g.playedToday) setResults(await getVibeResults())
      })
      .catch((err) => setError(err.message))
  }, [])

  async function finishQuiz(answers) {
    setBusy(true)
    try {
      const { credited } = await submitVibeAnswers(game.day, pref, answers)
      if (credited) showToast(`+${credited} Ngori pour ta participation !`, 'success')
      setGame((g) => ({ ...g, playedToday: true }))
      setResults(await getVibeResults())
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleVibe(card) {
    setBusyId(card.id)
    try {
      const out = await sendVibe(card.id)
      const update = (list) => list.map((c) => (c.id === card.id ? { ...c, vibeSent: true, photo: out.photo } : c))
      setResults((r) => ({
        ...r,
        received: out.matchId ? r.received.filter((c) => c.id !== card.id) : update(r.received),
        top: out.matchId ? r.top.filter((c) => c.id !== card.id) : update(r.top),
      }))
      if (out.matchId) setMatch({ ...out, firstName: card.firstName })
      else showToast(`Vibe envoyée à ${card.firstName} 💜`, 'success')
    } catch (err) {
      if (isQuotaError(err)) setQuotaHit(true)
      showToast(err.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const balance = account?.ngori || 0
  let body = null
  if (error) body = <p className="mx-auto mt-10 max-w-sm px-4 text-center text-sm text-coral-500">{error}</p>
  else if (!game) body = <p className="mt-10 text-center text-sm text-ink-soft">Chargement…</p>
  else if (!pref) body = <PrefStep gender={game.gender} onPick={setPref} />
  else if (!game.playedToday) body = <QuizStep questions={game.questions} onDone={finishQuiz} busy={busy} />
  else if (!results) body = <p className="mt-10 text-center text-sm text-ink-soft">On calcule tes vibes…</p>
  else body = <Results results={results} onVibe={handleVibe} busyId={busyId} />

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
        <h1 className="flex-1 font-display text-lg font-semibold text-ink">Vibe Check</h1>
        <span className="flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-sm font-bold text-ink">
          <NgoriCoin size={18} /> {balance}
        </span>
      </div>

      {body}

      {quotaHit && (
        <p className="mx-auto mt-4 max-w-md px-4 text-center text-xs text-ink-soft">
          Plus de likes aujourd’hui ?{' '}
          <Link to="/ngori" className="font-bold text-violet-600 underline">
            Débloque des likes illimités avec tes Ngori
          </Link>{' '}
          ou{' '}
          <Link to="/tarifs" className="font-bold text-violet-600 underline">
            passe à un abonnement
          </Link>
          .
        </p>
      )}

      <AnimatePresence>{match && <MatchModal match={match} onClose={() => setMatch(null)} />}</AnimatePresence>
    </div>
  )
}

export default VibeCheck
