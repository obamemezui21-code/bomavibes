import { useNavigate } from 'react-router-dom'
import { BadgeCheck, Clock, ShieldAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useIdentity } from '../context/IdentityContext.jsx'
import { VERIFIED_PERKS } from '../lib/identityStatus.js'

// "Profil vérifié" status on the profile page. The verification itself
// (identity document + pose selfie) happens on /verification — optional,
// rewarded with the ✓ badge and the VERIFIED_PERKS.
function VerificationCard() {
  const { publicProfile } = useAuth()
  const { request } = useIdentity()
  const navigate = useNavigate()
  const card = 'glass-panel mb-6 rounded-2xl p-5'

  if (publicProfile?.verified) {
    return (
      <div className={`${card} flex items-center gap-3`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white">
          <BadgeCheck size={22} strokeWidth={2.25} />
        </span>
        <div>
          <p className="font-display text-base font-semibold text-ink">Identité vérifiée</p>
          <p className="text-sm text-ink-soft/70">Le badge ✓ apparaît à côté de votre prénom partout sur BomaVibes.</p>
        </div>
      </div>
    )
  }

  if (request === undefined) return null

  if (request?.status === 'pending') {
    return (
      <div className={`${card} flex items-center gap-3`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-950/10 text-violet-950 dark:bg-white/10 dark:text-white">
          <Clock size={20} strokeWidth={2.25} />
        </span>
        <div>
          <p className="font-display text-base font-semibold text-ink">Vérification en cours</p>
          <p className="text-sm text-ink-soft/70">
            Notre équipe examine votre pièce d’identité et votre selfie. Vous serez prévenu·e dès que c’est fait.
          </p>
        </div>
      </div>
    )
  }

  const wasRejected = request?.status === 'rejected'
  return (
    <div className={card}>
      <div className="flex items-start gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
            wasRejected ? 'bg-coral-500/12 text-coral-500' : 'bg-sky-500/12 text-sky-500'
          }`}
        >
          {wasRejected ? <ShieldAlert size={20} strokeWidth={2.25} /> : <BadgeCheck size={22} strokeWidth={2.25} />}
        </span>
        <div>
          <p className="font-display text-base font-semibold text-ink">
            {wasRejected ? 'Vérification non validée' : 'Faites vérifier votre identité'}
          </p>
          <p className="text-sm text-ink-soft/70">
            {wasRejected
              ? `${request.rejectReason || ''} Vous pouvez réessayer.`
              : 'Une pièce d’identité et un selfie suffisent, et vous débloquez :'}
          </p>
        </div>
      </div>
      {!wasRejected && (
        <ul className="mt-3 space-y-1.5 rounded-xl bg-sky-500/[0.06] p-3 text-sm text-ink">
          {VERIFIED_PERKS.map((p) => (
            <li key={p.text} className="flex gap-2">
              <span>{p.emoji}</span>
              {p.text}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => navigate('/verification')}
        className="mt-4 w-full rounded-full bg-violet-950 py-3 text-sm font-semibold text-white transition hover:bg-violet-950/90 dark:bg-pink-500"
      >
        {wasRejected ? 'Réessayer' : 'Vérifier mon identité'}
      </button>
    </div>
  )
}

export default VerificationCard
