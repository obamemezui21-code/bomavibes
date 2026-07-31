import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import AuthLayout from '../components/AuthLayout.jsx'
import PasswordInput from '../components/PasswordInput.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-cream-100 placeholder-cream-300/30 outline-none transition focus:border-gold-400/60 focus:bg-white/[0.07] focus:ring-4 focus:ring-gold-400/10'
const labelClass = 'mb-1.5 block text-sm font-medium text-cream-200'

function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await login(email, password)
      navigate(location.state?.from?.pathname || '/discover', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Content de te revoir"
      subtitle="Connecte-toi pour retrouver tes matchs"
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link to="/signup" className="font-semibold text-gold-400 underline-offset-2 hover:underline">
            Inscris-toi
          </Link>
        </>
      }
    >
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

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-cream-200">
              Mot de passe
            </label>
            <a href="#" className="text-xs font-medium text-gold-400/80 hover:text-gold-400">
              Mot de passe oublié ?
            </a>
          </div>
          <PasswordInput
            id="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <motion.button
          type="submit"
          disabled={isSubmitting}
          whileTap={{ scale: 0.97 }}
          className="w-full rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 py-2.5 text-sm font-semibold text-forest-950 shadow-lg shadow-gold-500/20 transition hover:shadow-gold-500/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Connexion…' : 'Se connecter'}
        </motion.button>
      </form>
    </AuthLayout>
  )
}

export default Login
