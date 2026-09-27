import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MailCheck } from 'lucide-react'
import Modal from './ui/Modal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { inputClass, labelClass } from '../lib/formStyles.js'

function ForgotPasswordModal({ onClose }) {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSent, setIsSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await resetPassword(email)
      setIsSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal onClose={onClose} className="max-w-sm text-left">
      <h2 className="mb-1 font-display text-lg font-semibold text-ink">Mot de passe oublié</h2>
      <p className="mb-4 text-sm text-ink-soft/60">Nous vous envoyons un lien pour le réinitialiser</p>

      {isSent ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3 py-2 text-center"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
          >
            <MailCheck size={40} strokeWidth={1.5} className="mx-auto text-mint-500" />
          </motion.div>
          <p className="text-sm leading-relaxed text-ink-soft">
            Si un compte existe pour <span className="font-semibold text-ink">{email}</span>, un email avec les
            instructions vient d'être envoyé.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full rounded-xl border border-ink/12 py-2.5 text-sm font-medium text-ink/80 hover:bg-ink/5"
          >
            Fermer
          </button>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden rounded-xl border border-coral-500/30 bg-coral-500/10 px-3 py-2 text-sm text-coral-400"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label htmlFor="forgot-email" className={labelClass}>
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              className={inputClass}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-ink/12 py-2.5 text-sm font-medium text-ink/80 hover:bg-ink/5"
            >
              Annuler
            </button>
            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileTap={{ scale: 0.97 }}
              className="flex-1 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-ink-on-brand shadow-lg shadow-violet-500/25 transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Envoi…' : 'Envoyer le lien'}
            </motion.button>
          </div>
        </form>
      )}
    </Modal>
  )
}

export default ForgotPasswordModal
