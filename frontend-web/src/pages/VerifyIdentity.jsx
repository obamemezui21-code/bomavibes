import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BadgeCheck, Camera, Clock, IdCard, Lock, LogOut, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useIdentity } from '../context/IdentityContext.jsx'
import { ID_TYPES, startVerification, submitIdentityVerification } from '../firebase/verification.js'
import { compressImage } from '../lib/compressImage.js'

const primaryButton =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 disabled:opacity-50'
const secondaryButton =
  'flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-ink/12 py-2.5 text-sm font-semibold text-ink hover:bg-ink/5 disabled:opacity-50'

function usePreview(file) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => url && URL.revokeObjectURL(url), [url])
  return url
}

function Steps({ current }) {
  const labels = ['Pièce d’identité', 'Selfie', 'Envoi']
  return (
    <div className="mb-5 flex gap-1.5">
      {labels.map((label, i) => (
        <div key={label} className="flex-1">
          <div className={`h-1.5 rounded-full ${i <= current ? 'bg-gradient-to-r from-violet-500 to-pink-500' : 'bg-ink/10'}`} />
          <p className={`mt-1 text-[11px] font-medium ${i === current ? 'text-ink' : 'text-ink-soft/50'}`}>{label}</p>
        </div>
      ))}
    </div>
  )
}

function PrivacyNote() {
  return (
    <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-ink-soft/70">
      <Lock size={12} strokeWidth={2.25} className="mt-0.5 shrink-0" />
      Vos photos ne sont jamais affichées sur votre profil. Seule notre équipe de modération les voit, et elles sont
      supprimées dès la vérification terminée.
    </p>
  )
}

// Mandatory identity verification for new members (and the optional
// "Profil vérifié" badge for older ones): an identity document, then a
// selfie doing a pose picked by the server, reviewed by a moderator.
function VerifyIdentity() {
  const { logout } = useAuth()
  const { showToast } = useToast()
  const { status, request } = useIdentity()
  const navigate = useNavigate()
  const documentInput = useRef(null)
  const selfieInput = useRef(null)

  const [step, setStep] = useState('intro') // intro | document | selfie
  const [idType, setIdType] = useState('cni')
  const [document, setDocument] = useState(null)
  const [selfie, setSelfie] = useState(null)
  const [challenge, setChallenge] = useState(null) // { pose, instruction }
  const [isBusy, setIsBusy] = useState(false)
  const documentUrl = usePreview(document)
  const selfieUrl = usePreview(selfie)

  function pick(setter) {
    return (e) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (file) setter(file)
    }
  }

  async function goToSelfie() {
    setIsBusy(true)
    try {
      setChallenge(await startVerification()) // the pose is valid 30 minutes
      setStep('selfie')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setIsBusy(false)
    }
  }

  async function send() {
    setIsBusy(true)
    try {
      const [doc, face] = await Promise.all([compressImage(document), compressImage(selfie)])
      await submitIdentityVerification({ idType, document: doc, selfie: face })
      showToast('Envoyé ! Notre équipe va vérifier votre identité.', 'success')
      setStep('intro')
      setDocument(null)
      setSelfie(null)
      setChallenge(null)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setIsBusy(false)
    }
  }

  if (status === 'loading') {
    return (
      <AuthLayout title="Vérification d’identité">
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
        </div>
      </AuthLayout>
    )
  }

  if (status === 'ok') {
    return (
      <AuthLayout title="Identité vérifiée" subtitle="Merci de contribuer à une communauté sûre">
        <div className="space-y-4 text-center">
          <BadgeCheck size={44} className="mx-auto text-sky-500" />
          <p className="text-sm text-ink-soft">Votre profil affiche le badge ✓ et vous avez accès à tout BomaVibes.</p>
          <button type="button" onClick={() => navigate('/discover', { replace: true })} className={primaryButton}>
            Continuer
          </button>
        </div>
      </AuthLayout>
    )
  }

  if (status === 'pending' && step === 'intro') {
    return (
      <AuthLayout title="Vérification en cours" subtitle="Généralement en quelques heures">
        <div className="space-y-4 text-center">
          <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2, repeat: Infinity }}>
            <Clock size={44} className="mx-auto text-violet-500" />
          </motion.div>
          <p className="text-sm leading-relaxed text-ink-soft">
            Notre équipe examine votre pièce d’identité et votre selfie. En attendant, vous pouvez déjà découvrir les
            profils et le fil d’actualité. Vous pourrez liker, écrire et publier dès que ce sera validé — vous recevrez
            une notification.
          </p>
          <button type="button" onClick={() => navigate('/discover', { replace: true })} className={primaryButton}>
            Découvrir BomaVibes
          </button>
        </div>
      </AuthLayout>
    )
  }

  if (step === 'document') {
    return (
      <AuthLayout title="Votre pièce d’identité" subtitle="Étape 1 sur 3">
        <Steps current={0} />
        <p className="mb-2 text-sm font-medium text-ink/80">Type de pièce</p>
        <div className="grid grid-cols-2 gap-2">
          {ID_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setIdType(t.value)}
              className={`rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${
                idType === t.value ? 'border-violet-500 bg-violet-500/10 text-ink' : 'border-ink/12 text-ink-soft hover:bg-ink/5'
              }`}
            >
              <span className="mr-1.5">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>

        <input ref={documentInput} type="file" accept="image/*" capture="environment" onChange={pick(setDocument)} className="hidden" />
        <ul className="mt-4 space-y-1 text-xs text-ink-soft/80">
          <li>• Face avec votre photo, en entier, bien à plat</li>
          <li>• Lisible : pas de reflet, pas de flou</li>
          <li>• Pièce valide (non expirée), à votre nom</li>
        </ul>

        {documentUrl ? (
          <div className="mt-4 space-y-3">
            <img src={documentUrl} alt="Votre pièce d’identité" className="mx-auto max-h-56 rounded-xl object-contain" />
            <div className="flex gap-2">
              <button type="button" onClick={() => documentInput.current?.click()} className={secondaryButton}>
                <RotateCcw size={15} /> Reprendre
              </button>
              <button type="button" onClick={goToSelfie} disabled={isBusy} className={`${secondaryButton} border-transparent bg-violet-950 text-white hover:bg-violet-950/90 dark:bg-pink-500`}>
                {isBusy ? 'Un instant…' : 'Suivant'}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => documentInput.current?.click()} className={`mt-4 ${primaryButton}`}>
            <IdCard size={18} /> Photographier ma pièce
          </button>
        )}
        <PrivacyNote />
      </AuthLayout>
    )
  }

  if (step === 'selfie' && challenge) {
    return (
      <AuthLayout title="Votre selfie" subtitle="Étape 2 sur 3">
        <Steps current={selfie ? 2 : 1} />
        <div className="rounded-2xl bg-violet-950 px-4 py-5 text-center text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Faites cette pose</p>
          <p className="mt-1 text-lg font-semibold leading-snug">{challenge.instruction}</p>
          <p className="mt-1 text-xs text-white/60">Visage bien visible, sans lunettes de soleil, en pleine lumière.</p>
        </div>

        <input ref={selfieInput} type="file" accept="image/*" capture="user" onChange={pick(setSelfie)} className="hidden" />

        {selfieUrl ? (
          <div className="mt-4 space-y-3">
            <img src={selfieUrl} alt="Votre selfie" className="mx-auto max-h-64 rounded-xl object-cover" />
            <div className="flex gap-2">
              <button type="button" onClick={() => selfieInput.current?.click()} disabled={isBusy} className={secondaryButton}>
                <RotateCcw size={15} /> Reprendre
              </button>
              <button type="button" onClick={send} disabled={isBusy} className={`${secondaryButton} border-transparent bg-violet-950 text-white hover:bg-violet-950/90 dark:bg-pink-500`}>
                {isBusy ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => selfieInput.current?.click()} className={`mt-4 ${primaryButton}`}>
            <Camera size={18} /> Prendre le selfie
          </button>
        )}
        <button type="button" onClick={() => setStep('document')} disabled={isBusy} className="mt-3 w-full text-center text-xs font-medium text-ink-soft/70 hover:underline">
          ← Revenir à la pièce d’identité
        </button>
        <PrivacyNote />
      </AuthLayout>
    )
  }

  // Intro: first time, or after a refusal.
  const wasRejected = status === 'rejected'
  return (
    <AuthLayout title="Vérifions votre identité" subtitle="Pour la sécurité de tous nos membres">
      <div className="space-y-4">
        {wasRejected && (
          <div className="flex gap-2.5 rounded-xl border border-coral-500/30 bg-coral-500/10 px-3 py-2.5 text-sm text-coral-500">
            <ShieldAlert size={18} className="mt-0.5 shrink-0" />
            <span>
              <strong>Vérification non validée.</strong> {request?.rejectReason || ''} Vous pouvez recommencer.
            </span>
          </div>
        )}
        <div className="flex items-start gap-3">
          <ShieldCheck size={36} className="shrink-0 text-sky-500" />
          <p className="text-sm leading-relaxed text-ink-soft">
            Sur BomaVibes, chaque nouveau profil est vérifié par notre équipe : vous rencontrez de vraies personnes, et
            elles savent que vous êtes vous. Cela prend 2 minutes.
          </p>
        </div>
        <ol className="space-y-2 rounded-2xl bg-ink/[0.03] p-4 text-sm text-ink">
          <li>
            <strong>1.</strong> Une photo de votre pièce d’identité (carte d’identité, passeport, permis ou titre de séjour)
          </li>
          <li>
            <strong>2.</strong> Un selfie en faisant une pose que nous vous indiquons
          </li>
          <li>
            <strong>3.</strong> Notre équipe valide, généralement en quelques heures
          </li>
        </ol>
        <button type="button" onClick={() => setStep('document')} className={primaryButton}>
          Commencer
        </button>
        <PrivacyNote />
        <button
          type="button"
          onClick={async () => {
            await logout()
            navigate('/')
          }}
          className="mx-auto flex items-center gap-1.5 text-xs font-medium text-ink-soft/60 hover:underline"
        >
          <LogOut size={13} /> Se déconnecter
        </button>
      </div>
    </AuthLayout>
  )
}

export default VerifyIdentity
