import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Coffee, Lock, X } from 'lucide-react'
import { answerWeMet, getWeMet } from '../../firebase/weMet.js'

const CHOICE =
  'flex-1 rounded-full py-2 text-xs font-semibold transition disabled:opacity-60'
const PRIMARY = `${CHOICE} bg-gradient-to-r from-violet-500 to-pink-500 text-white`
const SECONDARY = `${CHOICE} bg-ink/[0.06] text-ink hover:bg-ink/10`

// "We Met" card at the top of a conversation (as on Hinge): asked privately
// a few days after the match started talking. The server decides when.
function WeMetPrompt({ matchId, firstName }) {
  const [step, setStep] = useState(null) // null | 'met' | 'again' | 'thanks'
  const [uncomfortable, setUncomfortable] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    getWeMet(matchId)
      .then(({ ask }) => !cancelled && ask && setStep('met'))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [matchId])

  async function send(answer) {
    setSending(true)
    try {
      await answerWeMet(matchId, answer)
      setStep(answer.met === 'not_yet' ? null : 'thanks')
    } catch {
      setStep(null) // asked again on a later visit
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    if (step !== 'thanks' || uncomfortable) return undefined
    const t = setTimeout(() => setStep(null), 3500)
    return () => clearTimeout(t)
  }, [step, uncomfortable])

  return (
    <AnimatePresence>
      {step && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute inset-x-3 top-3 z-10 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-ink/8 dark:bg-surface-tint"
        >
          {step !== 'thanks' && (
            <button
              type="button"
              onClick={() => send({ met: 'not_yet' })}
              disabled={sending}
              className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full text-ink-soft/50 hover:bg-ink/5"
              aria-label="Plus tard"
            >
              <X size={14} strokeWidth={2.25} />
            </button>
          )}

          {step === 'met' && (
            <>
              <p className="flex items-center gap-1.5 pr-8 text-sm font-semibold text-ink">
                <Coffee size={16} strokeWidth={2.25} className="text-violet-500" />
                Avez-vous rencontré {firstName} en vrai ?
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" className={PRIMARY} disabled={sending} onClick={() => setStep('again')}>
                  Oui
                </button>
                <button type="button" className={SECONDARY} disabled={sending} onClick={() => send({ met: 'not_yet' })}>
                  Pas encore
                </button>
                <button type="button" className={SECONDARY} disabled={sending} onClick={() => send({ met: 'no' })}>
                  Non
                </button>
              </div>
            </>
          )}

          {step === 'again' && (
            <>
              <p className="pr-8 text-sm font-semibold text-ink">Aimeriez-vous revoir {firstName} ?</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className={PRIMARY}
                  disabled={sending}
                  onClick={() => send({ met: 'yes', seeAgain: true, uncomfortable })}
                >
                  Oui 💜
                </button>
                <button
                  type="button"
                  className={SECONDARY}
                  disabled={sending}
                  onClick={() => send({ met: 'yes', seeAgain: false, uncomfortable })}
                >
                  Non
                </button>
              </div>
              <label className="mt-3 flex items-start gap-2 text-xs text-ink-soft">
                <input
                  type="checkbox"
                  checked={uncomfortable}
                  onChange={(e) => setUncomfortable(e.target.checked)}
                  className="mt-0.5 accent-coral-500"
                />
                Je me suis senti·e mal à l'aise ou en danger (l'équipe sera prévenue, sans que {firstName} le sache)
              </label>
            </>
          )}

          {step === 'thanks' && (
            <div className="pr-2">
              <p className="text-sm font-semibold text-ink">Merci pour ta réponse !</p>
              {uncomfortable ? (
                <p className="mt-1 text-xs text-ink-soft">
                  Notre équipe va examiner la situation. Tu peux aussi bloquer {firstName} depuis son profil. Conseils et
                  aide : <Link to="/securite" className="font-semibold text-violet-600 underline">Sécurité</Link>.
                  <button
                    type="button"
                    onClick={() => setStep(null)}
                    className="mt-2 block font-semibold text-ink-soft/70 hover:underline"
                  >
                    Fermer
                  </button>
                </p>
              ) : (
                <p className="mt-1 flex items-center gap-1 text-xs text-ink-soft">
                  <Lock size={11} strokeWidth={2.5} />
                  Elle reste privée : {firstName} ne la verra jamais.
                </p>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default WeMetPrompt
