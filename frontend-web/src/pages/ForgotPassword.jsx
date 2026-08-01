import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import AuthLayout from '../components/AuthLayout.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const inputClass =
  'w-full rounded-xl border border-ink/12 bg-ink/[0.03] px-3.5 py-2.5 text-sm text-ink placeholder-ink-soft/50 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-400/15'
const labelClass = 'mb-1.5 block text-sm font-medium text-ink/80'

function ForgotPassword() {
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
    <AuthLayout
      title="Mot de passe oublié"
      subtitle="On t'envoie un lien pour le réinitialiser"
      footer={
        <Link to="/login" className="font-semibold text-violet-600 underline-offset-2 hover:underline">
          Retour à la connexion
        </Link>
      }
    >
      {isSent ? (
        <div className="space-y-3 text-center">
          <span className="text-4xl">✉️</span>
          <p className="text-sm leading-relaxed text-ink-soft">
            Si un compte existe pour <span className="font-semibold text-ink">{email}</span>, un
            email avec les instructions vient d'être envoyé.
          </p>
        </div>
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
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@exemple.com"
              className={inputClass}
            />
          </div>

          <motion.button
            type="submit"
            disabled={isSubmitting}
            whileTap={{ scale: 0.97 }}
            className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-[#2B1D14] shadow-lg shadow-violet-500/25 transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Envoi…' : 'Envoyer le lien'}
          </motion.button>
        </form>
      )}
    </AuthLayout>
  )
}

export default ForgotPassword
