import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

const RESEND_COOLDOWN = 30

function VerifyEmail() {
  const { user, profile, logout, resendVerificationEmail, refreshEmailVerified } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [isChecking, setIsChecking] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (user?.emailVerified) navigate(profile?.onboarded ? '/discover' : '/onboarding', { replace: true })
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
      navigate(profile?.onboarded ? '/discover' : '/onboarding', { replace: true })
    } else {
      showToast("Ton email n'est pas encore vérifié", 'info')
    }
  }

  return (
    <AuthLayout title="Vérifie ton email" subtitle="Une dernière étape avant de continuer">
      <div className="space-y-4 text-center">
        <Mail size={40} strokeWidth={1.5} className="mx-auto text-violet-500" />
        <p className="text-sm leading-relaxed text-ink-soft">
          On a envoyé un lien de vérification à{' '}
          <span className="font-semibold text-ink">{user?.email}</span>. Clique sur ce lien, puis
          reviens ici.
        </p>

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={handleCheck}
          disabled={isChecking}
          className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-[#2B1D14] shadow-lg shadow-violet-500/25 transition disabled:cursor-not-allowed disabled:opacity-60"
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
