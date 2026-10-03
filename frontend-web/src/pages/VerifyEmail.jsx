import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

// Firebase allows about one verification link a minute per account.
const RESEND_COOLDOWN = 60

function VerifyEmail() {
  const { user, profile, isProfileLoading, logout, resendVerificationEmail, refreshEmailVerified } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [isChecking, setIsChecking] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  // Wait for the account doc before choosing: deciding on a profile that
  // hasn't loaded yet sent finished profiles back to /onboarding.
  useEffect(() => {
    if (user?.emailVerified && !isProfileLoading) navigate(profile?.onboarded ? '/discover' : '/onboarding', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.emailVerified, isProfileLoading])

  // The link is usually opened in another tab or app (the mail app): notice
  // it here on our own, without waiting for "J'ai vérifié mon email". The
  // effect above then moves them on.
  useEffect(() => {
    if (user?.emailVerified) return undefined
    const check = () => {
      if (document.visibilityState === 'visible') refreshEmailVerified().catch(() => {})
    }
    const timer = setInterval(check, 5000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.emailVerified])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function handleResend() {
    if (cooldown > 0) return
    await resendVerificationEmail()
    setCooldown(RESEND_COOLDOWN)
  }

  async function handleCheck() {
    setIsChecking(true)
    const verified = await refreshEmailVerified()
    setIsChecking(false)

    if (verified) {
      // /discover's guard sends a member without a profile to /onboarding
      // once their account doc is loaded.
      navigate('/discover', { replace: true })
    } else {
      showToast("Votre email n'est pas encore vérifié", 'info')
    }
  }

  return (
    <AuthLayout title="Vérifiez votre email" subtitle="Une dernière étape avant de continuer">
      <div className="space-y-4 text-center">
        <Mail size={40} strokeWidth={1.5} className="mx-auto text-violet-500" />
        <p className="text-sm leading-relaxed text-ink-soft">
          Nous avons envoyé un lien de vérification à{' '}
          <span className="font-semibold text-ink">{user?.email}</span>. Cliquez sur ce lien, puis
          revenez ici.
        </p>
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-ink-soft">
          Pensez à regarder dans les spams. Si vous demandez un nouvel email, seul le lien du{' '}
          <span className="font-semibold text-ink">dernier email reçu</span> fonctionne.
        </p>

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={handleCheck}
          disabled={isChecking}
          className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-ink-on-brand shadow-lg shadow-violet-500/25 transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isChecking ? 'Vérification…' : "J'ai vérifié mon email"}
        </motion.button>

        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0}
          className="w-full rounded-xl border border-ink/12 py-2.5 text-sm font-semibold text-ink transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cooldown > 0 ? `Renvoyer l'email (${cooldown}s)` : "Renvoyer l'email de vérification"}
        </button>

        <button
          type="button"
          onClick={logout}
          className="text-sm font-medium text-ink-soft transition hover:text-ink"
        >
          Se déconnecter
        </button>
      </div>
    </AuthLayout>
  )
}

export default VerifyEmail
