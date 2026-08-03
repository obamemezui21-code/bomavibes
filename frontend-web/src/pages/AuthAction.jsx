import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { applyActionCode, checkActionCode, confirmPasswordReset } from 'firebase/auth'
import { CircleCheck, PartyPopper, TriangleAlert } from 'lucide-react'
import { auth } from '../firebase/config.js'
import AuthLayout from '../components/AuthLayout.jsx'
import PasswordInput from '../components/PasswordInput.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const inputClass =
  'w-full rounded-xl border border-ink/12 bg-ink/[0.03] px-3.5 py-2.5 text-sm text-ink placeholder-ink-soft/50 outline-none transition focus:border-violet-400 focus:bg-white dark:focus:bg-ink/[0.06] focus:ring-4 focus:ring-violet-400/15'
const labelClass = 'mb-1.5 block text-sm font-medium text-ink/80'
const buttonClass =
  'block w-full rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-center text-sm font-semibold text-[#2B1D14] shadow-lg shadow-violet-500/25 transition disabled:cursor-not-allowed disabled:opacity-60'

function AuthAction() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { resetPassword } = useAuth()
  const mode = searchParams.get('mode')
  const oobCode = searchParams.get('oobCode')

  const [status, setStatus] = useState('checking')
  const [email, setEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [retryEmail, setRetryEmail] = useState('')
  const [retrySent, setRetrySent] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    if (!mode || !oobCode) {
      setStatus('error')
      setErrorMessage('Ce lien est invalide.')
      return
    }

    if (mode === 'verifyEmail') {
      applyActionCode(auth, oobCode)
        .then(() => setStatus('verified'))
        .catch(() => {
          setStatus('error')
          setErrorMessage('Ce lien de vérification est invalide ou a expiré.')
        })
    } else if (mode === 'resetPassword') {
      checkActionCode(auth, oobCode)
        .then((info) => {
          setEmail(info.data.email || '')
          setStatus('resetForm')
        })
        .catch(() => {
          setStatus('error')
          setErrorMessage('Ce lien de réinitialisation est invalide ou a expiré.')
        })
    } else {
      setStatus('error')
      setErrorMessage('Type de lien non reconnu.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleResetSubmit(e) {
    e.preventDefault()
    setErrorMessage('')

    if (newPassword.length < 8) {
      setErrorMessage('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Les mots de passe ne correspondent pas')
      return
    }

    setIsSubmitting(true)
    try {
      await confirmPasswordReset(auth, oobCode, newPassword)
      setStatus('resetDone')
    } catch {
      setErrorMessage('Impossible de réinitialiser le mot de passe, réessaie.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === 'checking') {
    return (
      <AuthLayout title="Vérification en cours…">
        <div className="flex justify-center py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
        </div>
      </AuthLayout>
    )
  }

  if (status === 'error') {
    async function handleRetry(e) {
      e.preventDefault()
      setIsRetrying(true)
      try {
        await resetPassword(retryEmail)
        setRetrySent(true)
      } finally {
        setIsRetrying(false)
      }
    }

    return (
      <AuthLayout title="Lien invalide" subtitle={errorMessage}>
        <div className="space-y-5 text-center">
          <TriangleAlert size={40} strokeWidth={1.5} className="mx-auto text-coral-500" />

          {mode !== 'verifyEmail' && (
            <div className="rounded-2xl bg-ink/[0.03] p-4 text-left">
              {retrySent ? (
                <p className="text-sm text-ink-soft">
                  Si un compte existe pour <span className="font-semibold text-ink">{retryEmail}</span>,
                  un nouveau lien vient d'être envoyé.
                </p>
              ) : (
                <form onSubmit={handleRetry} className="space-y-3">
                  <label className={labelClass}>Redemander un lien de réinitialisation</label>
                  <input
                    type="email"
                    required
                    value={retryEmail}
                    onChange={(e) => setRetryEmail(e.target.value)}
                    placeholder="toi@exemple.com"
                    className={inputClass}
                  />
                  <button type="submit" disabled={isRetrying} className={buttonClass}>
                    {isRetrying ? 'Envoi…' : 'Renvoyer le lien'}
                  </button>
                </form>
              )}
            </div>
          )}

          <Link to="/login" className="block text-sm font-semibold text-violet-600 hover:underline">
            Retour à la connexion
          </Link>
        </div>
      </AuthLayout>
    )
  }

  if (status === 'verified') {
    return (
      <AuthLayout title="Email vérifié !" subtitle="Ton adresse email est bien confirmée">
        <div className="space-y-4 text-center">
          <PartyPopper size={40} strokeWidth={1.5} className="mx-auto text-violet-500" />
          <button type="button" onClick={() => navigate('/login')} className={buttonClass}>
            Continuer
          </button>
        </div>
      </AuthLayout>
    )
  }

  if (status === 'resetForm') {
    return (
      <AuthLayout title="Nouveau mot de passe" subtitle={email ? `Pour ${email}` : undefined}>
        <form onSubmit={handleResetSubmit} className="space-y-4">
          {errorMessage && (
            <div className="rounded-xl border border-coral-500/30 bg-coral-500/10 px-3 py-2 text-sm text-coral-400">
              {errorMessage}
            </div>
          )}
          <div>
            <label className={labelClass}>Nouveau mot de passe</label>
            <PasswordInput
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="8 caractères minimum"
            />
          </div>
          <div>
            <label className={labelClass}>Confirme le mot de passe</label>
            <PasswordInput
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" disabled={isSubmitting} className={buttonClass}>
            {isSubmitting ? 'Mise à jour…' : 'Réinitialiser le mot de passe'}
          </button>
        </form>
      </AuthLayout>
    )
  }

  if (status === 'resetDone') {
    return (
      <AuthLayout title="Mot de passe mis à jour" subtitle="Tu peux te connecter avec ton nouveau mot de passe">
        <div className="space-y-4 text-center">
          <CircleCheck size={40} strokeWidth={1.5} className="mx-auto text-mint-500" />
          <Link to="/login" className={buttonClass}>
            Se connecter
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return null
}

export default AuthAction
