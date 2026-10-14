import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, BarChart3, Delete, HelpCircle, Share2, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { getMotDuJour, submitMotDuJourGuess } from '../firebase/motDuJour.js'
import { ABSENT, CORRECT, PRESENT, keyboardMarks, normalizeWord, shareText } from '../../../shared/mot-du-jour/engine.mjs'
import NgoriCoin from '../components/NgoriCoin.jsx'

const ROWS = ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN']

const TILE = {
  [CORRECT]: 'border-mint-500 bg-mint-500 text-white',
  [PRESENT]: 'border-gold bg-gold text-[#4a3000]',
  [ABSENT]: 'border-ink-soft/50 bg-ink-soft/50 text-white',
}

const KEY = {
  [CORRECT]: 'bg-mint-500 text-white',
  [PRESENT]: 'bg-gold text-[#4a3000]',
  [ABSENT]: 'bg-ink-soft/35 text-ink/50',
}

const RULES_SEEN_KEY = 'motDuJour.rulesSeen'

// Next word at midnight UTC — 1 h in Libreville.
function untilNextWord(now) {
  const next = new Date(now)
  next.setUTCHours(24, 0, 0, 0)
  const minutes = Math.max(0, Math.ceil((next - now) / 60000))
  const h = Math.floor(minutes / 60)
  return h ? `${h} h ${String(minutes % 60).padStart(2, '0')}` : `${minutes} min`
}

function Tile({ letter, mark, index, reveal }) {
  return (
    <motion.div
      initial={reveal ? { rotateX: 0 } : false}
      animate={reveal ? { rotateX: [0, 90, 0] } : undefined}
      transition={{ delay: index * 0.18, duration: 0.45 }}
      className={`flex aspect-square w-full items-center justify-center rounded-xl border-2 font-display text-2xl font-black uppercase ${
        mark ? TILE[mark] : letter ? 'border-ink/40 bg-surface text-ink' : 'border-ink/12 bg-surface text-ink'
      }`}
    >
      {letter}
    </motion.div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-surface p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-center">
          <h2 className="flex-1 font-display text-lg font-bold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink/60 hover:bg-ink/5" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}

function Rules({ rewards }) {
  const examples = [
    ['MBOLO', 'C....', 'Le M est bien placé.'],
    ['GABON', '.P...', 'Le A est dans le mot, mais pas à cette place.'],
    ['FORET', 'AAAAA', 'Aucune de ces lettres n’est dans le mot.'],
  ]
  return (
    <div className="space-y-3 text-sm text-ink-soft">
      <p>
        Trouve le mot du jour en <strong className="text-ink">6 essais</strong>. Un indice t’aide dès le départ, et le mot est le même pour tout
        le monde. Les accents ne comptent pas.
      </p>
      {examples.map(([word, marks, text]) => (
        <div key={word}>
          <div className="flex gap-1">
            {[...word].map((l, i) => (
              <span
                key={i}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border-2 font-display text-sm font-black ${
                  TILE[marks[i]] || 'border-ink/15 text-ink'
                }`}
              >
                {l}
              </span>
            ))}
          </div>
          <p className="mt-1">{text}</p>
        </div>
      ))}
      <p className="flex flex-wrap items-center gap-1 rounded-2xl bg-gold/12 p-3 text-ink">
        <NgoriCoin size={16} /> Trouvé : <strong>{rewards.winReward} Ngori</strong>, en {rewards.quickWinTries} essais ou moins :{' '}
        <strong>{rewards.quickWinReward}</strong>. Et +{rewards.streakBonus} tous les {rewards.streakLength} jours gagnés d’affilée !
      </p>
    </div>
  )
}

function Stats({ stats, maxTries, highlight }) {
  const rate = stats.played ? Math.round((stats.won / stats.played) * 100) : 0
  const top = Math.max(1, ...stats.distribution)
  const tiles = [
    [stats.played, 'Parties'],
    [`${rate} %`, 'Gagnées'],
    [stats.streak, 'Série'],
    [stats.bestStreak, 'Record'],
  ]
  return (
    <div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {tiles.map(([value, label]) => (
          <div key={label} className="rounded-2xl bg-surface-soft py-2">
            <p className="font-display text-xl font-black text-ink">{value}</p>
            <p className="text-[11px] text-ink-soft">{label}</p>
          </div>
        ))}
      </div>
      <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-ink-soft">Essais pour trouver</p>
      <div className="space-y-1.5">
        {Array.from({ length: maxTries }, (_, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-3 font-bold text-ink">{i + 1}</span>
            <div
              className={`flex h-5 min-w-6 items-center justify-end rounded-md px-1.5 font-bold text-white ${
                highlight === i + 1 ? 'bg-mint-500' : 'bg-ink-soft/50'
              }`}
              style={{ width: `${Math.max(8, ((stats.distribution[i] || 0) / top) * 100)}%` }}
            >
              {stats.distribution[i] || 0}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// "Le Mot du Jour" — a Wordle on Gabon: one word a day for everyone, marked
// by the server, paid in Ngori once found.
function MotDuJour() {
  const navigate = useNavigate()
  const { profile: account } = useAuth()
  const { showToast } = useToast()
  const [game, setGame] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [current, setCurrent] = useState('')
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(0)
  const [revealRow, setRevealRow] = useState(-1)
  const [modal, setModal] = useState(null) // 'rules' | 'stats'
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    getMotDuJour()
      .then((g) => {
        setGame(g)
        let seen = false
        try {
          seen = localStorage.getItem(RULES_SEEN_KEY) === '1'
          localStorage.setItem(RULES_SEEN_KEY, '1')
        } catch {
          // Private browsing: show the rules each time.
        }
        if (!seen && g.status === 'playing' && !g.guesses.length) setModal('rules')
      })
      .catch((err) => setLoadError(err.message))
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const playing = game?.status === 'playing'

  const submit = useCallback(async () => {
    if (!game || busy) return
    if (current.length !== game.length) {
      setShake((n) => n + 1)
      showToast(`Il faut ${game.length} lettres.`, 'error')
      return
    }
    setBusy(true)
    try {
      const next = await submitMotDuJourGuess(game.day, current)
      setRevealRow(next.guesses.length - 1)
      setGame(next)
      setCurrent('')
      // Let the tiles flip before cheering.
      if (next.status === 'won') {
        setTimeout(() => showToast(`Bravo ! +${next.credited} Ngori`, 'success'), game.length * 180 + 450)
      }
    } catch (err) {
      setShake((n) => n + 1)
      showToast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }, [game, busy, current, showToast])

  const press = useCallback(
    (key) => {
      if (!playing || busy) return
      if (key === 'ENTER') return submit()
      if (key === 'BACK') return setCurrent((c) => c.slice(0, -1))
      setCurrent((c) => (c.length < game.length ? c + key : c))
    },
    [playing, busy, submit, game?.length],
  )

  // Physical keyboard.
  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey || modal) return
      if (e.key === 'Enter') press('ENTER')
      else if (e.key === 'Backspace') press('BACK')
      else {
        const letter = normalizeWord(e.key)
        if (letter.length === 1) press(letter)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, modal])

  async function share() {
    const text = shareText({ day: game.day, marks: game.marks, won: game.status === 'won' })
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        showToast('Résultat copié, colle-le où tu veux !', 'success')
      }
    } catch {
      // Share sheet closed.
    }
  }

  const keys = game ? keyboardMarks(game.guesses, game.marks) : {}
  const balance = account?.ngori || 0

  return (
    <div className="flex min-h-svh flex-col bg-surface-soft pb-24 desktop:min-h-full desktop:pb-6">
      <div className="flex items-center gap-2 border-b border-ink/8 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5"
          aria-label="Retour"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <h1 className="flex-1 font-display text-lg font-semibold text-ink">Le Mot du Jour</h1>
        <button type="button" onClick={() => setModal('rules')} className="rounded-full p-2 text-ink/70 hover:bg-ink/5" aria-label="Règles">
          <HelpCircle size={19} />
        </button>
        <button
          type="button"
          onClick={() => game && setModal('stats')}
          className="rounded-full p-2 text-ink/70 hover:bg-ink/5"
          aria-label="Statistiques"
        >
          <BarChart3 size={19} />
        </button>
        <span className="flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-sm font-bold text-ink">
          <NgoriCoin size={18} /> {balance}
        </span>
      </div>

      {loadError && <p className="mx-auto mt-10 max-w-sm px-4 text-center text-sm text-coral-500">{loadError}</p>}
      {!game && !loadError && <p className="mt-10 text-center text-sm text-ink-soft">Chargement du mot du jour…</p>}

      {game && (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-4">
          <p className="text-center text-sm text-ink-soft">
            Indice : <strong className="text-violet-600">{game.hint}</strong> · {game.length} lettres
          </p>

          <div className="mx-auto mt-4 w-full space-y-1.5" style={{ maxWidth: game.length * 58 }}>
            {Array.from({ length: game.maxTries }, (_, r) => {
              const done = r < game.guesses.length
              const word = done ? game.guesses[r] : r === game.guesses.length ? current : ''
              return (
                <motion.div
                  key={r === game.guesses.length ? `row-${r}-${shake}` : `row-${r}`}
                  animate={r === game.guesses.length && shake ? { x: [0, -8, 8, -6, 6, 0] } : {}}
                  transition={{ duration: 0.35 }}
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${game.length}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: game.length }, (_, i) => (
                    <Tile key={i} index={i} letter={word[i] || ''} mark={done ? game.marks[r][i] : null} reveal={done && r === revealRow} />
                  ))}
                </motion.div>
              )
            })}
          </div>

          {!playing && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: revealRow >= 0 ? game.length * 0.18 + 0.45 : 0 }}
              className="mt-5 rounded-3xl bg-surface p-5 text-center shadow-sm"
            >
              <p className="text-sm font-bold text-ink-soft">
                {game.status === 'won' ? `Trouvé en ${game.guesses.length} essai${game.guesses.length > 1 ? 's' : ''} ! 🎉` : 'Pas cette fois… le mot était'}
              </p>
              <p className="mt-1 font-display text-3xl font-black uppercase tracking-wide text-violet-600">{game.reveal.word}</p>
              <p className="mt-3 text-sm text-ink-soft">{game.reveal.fact}</p>
              {game.credited > 0 && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-sm font-bold text-ink">
                  <NgoriCoin size={16} /> +{game.credited} Ngori
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={share}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-violet-600 py-3 text-sm font-bold text-white"
                >
                  <Share2 size={16} /> Partager
                </button>
                <button
                  type="button"
                  onClick={() => setModal('stats')}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-surface-tint py-3 text-sm font-bold text-ink"
                >
                  <BarChart3 size={16} /> Mes stats
                </button>
              </div>
              <p className="mt-4 text-xs text-ink-soft">Prochain mot dans {untilNextWord(now)}</p>
            </motion.div>
          )}

          {playing && (
            <div className="mt-auto space-y-1.5 pt-6">
              {ROWS.map((row, r) => (
                <div key={row} className="flex justify-center gap-1">
                  {r === 2 && (
                    <button
                      type="button"
                      onClick={() => press('ENTER')}
                      disabled={busy}
                      className="flex h-12 flex-[1.6] items-center justify-center rounded-lg bg-violet-600 text-xs font-bold text-white disabled:opacity-60"
                    >
                      ENTRER
                    </button>
                  )}
                  {[...row].map((letter) => (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => press(letter)}
                      className={`h-12 flex-1 rounded-lg text-sm font-bold transition active:scale-95 ${KEY[keys[letter]] || 'bg-surface-tint text-ink'}`}
                    >
                      {letter}
                    </button>
                  ))}
                  {r === 2 && (
                    <button
                      type="button"
                      onClick={() => press('BACK')}
                      className="flex h-12 flex-[1.6] items-center justify-center rounded-lg bg-surface-tint text-ink"
                      aria-label="Effacer"
                    >
                      <Delete size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {modal === 'rules' && game && (
          <Modal title="Comment jouer" onClose={() => setModal(null)}>
            <Rules rewards={game.rewards} />
          </Modal>
        )}
        {modal === 'stats' && game && (
          <Modal title="Mes statistiques" onClose={() => setModal(null)}>
            <Stats stats={game.stats} maxTries={game.maxTries} highlight={game.status === 'won' ? game.guesses.length : null} />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}

export default MotDuJour
