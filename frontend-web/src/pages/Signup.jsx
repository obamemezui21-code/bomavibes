import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import AuthLayout from '../components/AuthLayout.jsx'
import PasswordInput from '../components/PasswordInput.jsx'
import GoogleIcon from '../components/GoogleIcon.jsx'
import ImageGridCaptcha from '../components/ImageGridCaptcha.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { inputClass, labelClass } from '../lib/formStyles.js'

// Anti-bot: no external service, no keys. `website` is a hidden field real
// visitors never see or fill — form-filling bots do, since they fill every
// input. `formLoadedAt` catches the other common bot pattern, submitting
// within a second of the page loading, faster than a human can type.
const MIN_SUBMIT_DELAY_MS = 1500

function Signup() {
  const { register, loginWithGoogle, token } = useAuth()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [website, setWebsite] = useState('')
  const [error, setError] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [captcha, setCaptcha] = useState({ token: '', indices: [] })
  const formLoadedAt = useRef(Date.now())
  const captchaRef = useRef(null)

  useEffect(() => {
    if (token) navigate('/discover', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    if (!acceptedTerms) {
      setError("Merci d'accepter les conditions d'utilisation pour continuer")
      return
    }
    if (website.trim() || Date.now() - formLoadedAt.current < MIN_SUBMIT_DELAY_MS) {
      // Bot caught by the honeypot or the time trap — same generic error as
      // a real failure, so nothing tells it which check it tripped.
      setError('Une erreur est survenue, réessayez')
      return
    }
    if (captcha.indices.length === 0) {
      setError('Merci de sélectionner les images demandées')
      return
    }

    setIsSubmitting(true)
    try {
      const captchaRes = await fetch('/api/captcha/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: captcha.token, indices: captcha.indices }),
      })
      if (!captchaRes.ok) {
        const body = await captchaRes.json().catch(() => null)
        throw new Error(body?.message || 'Vérification anti-robot invalide, réessayez')
      }

      await register(firstName, email, password)
      navigate('/onboarding', { replace: true })
    } catch (err) {
      setError(err.message)
      captchaRef.current?.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleGoogle() {
    setError('')
    if (!acceptedTerms) {
      setError("Merci d'accepter les conditions d'utilisation pour continuer")
      return
    }
    setIsGoogleLoading(true)
    try {
      await loginWithGoogle()
    } catch (err) {
      setError(err.message)
      setIsGoogleLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Créez votre compte"
      subtitle="Rejoignez la communauté gabonaise"
      footer={
        <>
          Déjà un compte ?{' '}
          <Link to="/login" className="font-semibold text-violet-600 underline-offset-2 hover:underline">
            Connectez-vous
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
          <label htmlFor="firstName" className={labelClass}>
            Prénom
          </label>
          <input
            id="firstName"
            type="text"
            required
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Ex: Sarah"
            className={inputClass}
          />
        </div>

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
            placeholder="vous@exemple.com"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>
            Mot de passe
          </label>
          <PasswordInput
            id="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8 caractères minimum"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className={labelClass}>
            Confirmez le mot de passe
          </label>
          <PasswordInput
            id="confirmPassword"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <label
          className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-xs leading-relaxed transition ${
            acceptedTerms
              ? 'border-violet-400/40 bg-violet-400/[0.06] text-ink-soft'
              : 'border-ink/12 bg-ink/[0.03] text-ink-soft'
          }`}
        >
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-violet-500"
          />
          <span>
            J'accepte les{' '}
            <Link to="/conditions" target="_blank" className="font-semibold text-violet-600 underline-offset-2 hover:underline">
              conditions d'utilisation
            </Link>{' '}
            et la{' '}
            <Link to="/confidentialite" target="_blank" className="font-semibold text-violet-600 underline-offset-2 hover:underline">
              politique de confidentialité
            </Link>
            .
          </span>
        </label>

        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <ImageGridCaptcha ref={captchaRef} onChange={setCaptcha} />

        <motion.button
          type="submit"
          disabled={isSubmitting}
          whileTap={{ scale: 0.97 }}
          className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-ink-on-brand shadow-lg shadow-violet-500/25 transition hover:shadow-violet-500/35 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Création du compte…' : 'Créer mon compte'}
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
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-ink/12 bg-white dark:bg-surface-tint py-2.5 text-sm font-semibold text-ink transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <GoogleIcon />
          {isGoogleLoading ? 'Connexion…' : 'Continuer avec Google'}
        </motion.button>
      </form>
    </AuthLayout>
  )
}

export default Signup
