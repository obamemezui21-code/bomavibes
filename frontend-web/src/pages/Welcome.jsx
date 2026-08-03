import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, MapPin, MessageCircle } from 'lucide-react'
import GoogleIcon from '../components/GoogleIcon.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const AVATAR_SEEDS = ['Amara', 'Kwame', 'Zola', 'Malik', 'Ndeye', 'Junior']
const CENTER_SEED = 'BomaVibes'

function avatarUrl(seed) {
  return `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(seed)}&backgroundColor=f3e8ff,fce7f3,ede9fe`
}

const SATELLITE_POSITIONS = [
  'top-1 left-1/2 -translate-x-1/2',
  'top-11 right-0',
  'bottom-11 right-0',
  'bottom-1 left-1/2 -translate-x-1/2',
  'bottom-11 left-0',
  'top-11 left-0',
]

function Welcome() {
  const { loginWithGoogle, token } = useAuth()
  const navigate = useNavigate()
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (token) navigate('/discover', { replace: true })
  }, [token, navigate])

  async function handleGoogle() {
    setError('')
    setIsGoogleLoading(true)
    try {
      await loginWithGoogle()
    } catch (err) {
      setError(err.message)
      setIsGoogleLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-surface-soft px-6 py-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto h-64 w-64 shrink-0"
      >
        <div className="absolute inset-0 rounded-full bg-violet-500/10" />
        <div className="absolute inset-7 rounded-full bg-violet-500/15" />
        <div className="absolute inset-[3.75rem] rounded-full bg-violet-500/25" />

        {AVATAR_SEEDS.map((seed, i) => (
          <img
            key={seed}
            src={avatarUrl(seed)}
            alt=""
            className={`absolute h-12 w-12 rounded-full border-2 border-white object-cover shadow-md ${SATELLITE_POSITIONS[i]}`}
          />
        ))}

        <img
          src={avatarUrl(CENTER_SEED)}
          alt=""
          className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white object-cover shadow-xl"
        />

        <span className="absolute -right-1 top-6 flex h-8 w-8 items-center justify-center rounded-full bg-violet-500 text-white shadow-lg">
          <MapPin size={16} strokeWidth={2.25} />
        </span>
        <span className="absolute -left-1 bottom-8 flex h-8 w-8 items-center justify-center rounded-full bg-pink-500 text-white shadow-lg">
          <MessageCircle size={16} strokeWidth={2.25} />
        </span>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-8 max-w-xs text-center font-display text-2xl font-bold text-ink"
      >
        Rencontre de nouvelles personnes près de chez toi
      </motion.h1>

      {error && <p className="mt-4 max-w-xs text-center text-sm text-coral-400">{error}</p>}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-8 w-full max-w-xs space-y-3"
      >
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-3 text-sm font-semibold text-[#2B1D14] shadow-lg shadow-violet-500/25 transition hover:shadow-violet-500/35"
        >
          <Mail size={18} strokeWidth={2} />
          Se connecter par email
        </button>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={isGoogleLoading}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-ink/12 bg-white dark:bg-surface-tint py-3 text-sm font-semibold text-ink transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleIcon />
          {isGoogleLoading ? 'Connexion…' : 'Continuer avec Google'}
        </button>
      </motion.div>

      <p className="mt-6 text-sm text-ink-soft/70">
        Pas encore de compte ?{' '}
        <Link to="/signup" className="font-semibold text-violet-600 underline-offset-2 hover:underline">
          Inscris-toi
        </Link>
      </p>
    </div>
  )
}

export default Welcome
