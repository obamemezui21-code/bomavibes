import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import AuthLayout from '../components/AuthLayout.jsx'
import PasswordInput from '../components/PasswordInput.jsx'
import GoogleIcon from '../components/GoogleIcon.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const inputClass =
  'w-full rounded-xl border border-ink/12 bg-ink/[0.03] px-3.5 py-2.5 text-sm text-ink placeholder-ink-soft/50 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-400/15'
const labelClass = 'mb-1.5 block text-sm font-medium text-ink/80'

function Login() {
  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

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

  function handleGoogle() {
    setError('')
    setIsGoogleLoading(true)
    loginWithGoogle()
  }

  return (
    <AuthLayout
      title="Content de te revoir"
      subtitle="Connecte-toi pour retrouver tes matchs"
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link to="/signup" className="font-semibold text-violet-600 underline-offset-2 hover:underline">
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
            <label htmlFor="password" className="block text-sm font-medium text-ink/80">
              Mot de passe
            </label>
            <a href="#" className="text-xs font-medium text-violet-600/80 hover:text-violet-600">
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
          className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-[#2B1D14] shadow-lg shadow-violet-500/25 transition hover:shadow-violet-500/35 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Connexion…' : 'Se connecter'}
        </motion.button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-ink/10" />
          <span className="text-xs font-medium text-ink-soft">ou</span>
          <div className="h-px flex-1 bg-ink/10" />
        </div>

        <motion.button
          type="button"
          onClick={handleGoogle}
          disabled={isGoogleLoading}
          whileTap={{ scale: 0.97 }}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-ink/12 bg-white py-2.5 text-sm font-semibold text-ink transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleIcon />
          {isGoogleLoading ? 'Connexion…' : 'Continuer avec Google'}
        </motion.button>
      </form>
    </AuthLayout>
  )
}

export default Login
