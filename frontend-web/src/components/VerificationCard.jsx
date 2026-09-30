import { useEffect, useMemo, useRef, useState } from 'react'
import { BadgeCheck, Camera, Clock, Lock, RotateCcw, ShieldAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { startVerification, submitVerificationSelfie, subscribeToMyVerification } from '../firebase/verification.js'
import { compressImage } from '../lib/compressImage.js'

// "Profil vérifié" by selfie: the server picks a pose, the user takes a
// selfie doing it, a moderator compares it with the profile photos.
function VerificationCard() {
  const { user, publicProfile } = useAuth()
  const { showToast } = useToast()
  const fileInputRef = useRef(null)
  const [request, setRequest] = useState(undefined) // undefined = loading
  const [challenge, setChallenge] = useState(null) // { pose, instruction } for this session
  const [selfie, setSelfie] = useState(null)

  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    if (!user?.id) return undefined
    return subscribeToMyVerification(user.id, setRequest)
  }, [user?.id])

  const previewUrl = useMemo(() => (selfie ? URL.createObjectURL(selfie) : null), [selfie])
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl])

  async function handleStart() {
    setIsBusy(true)
    try {
      setChallenge(await startVerification())
      setSelfie(null)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setIsBusy(false)
    }
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setSelfie(file)
  }

  async function handleSend() {
    if (!selfie) return
    setIsBusy(true)
    try {
      await submitVerificationSelfie(await compressImage(selfie))
      setChallenge(null)
      setSelfie(null)
      showToast('Selfie envoyé ! Notre équipe va le vérifier.', 'success')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setIsBusy(false)
    }
  }

  const card = 'glass-panel mb-6 rounded-2xl p-5'

  if (publicProfile?.verified) {
    return (
      <div className={`${card} flex items-center gap-3`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white">
          <BadgeCheck size={22} strokeWidth={2.25} />
        </span>
        <div>
          <p className="font-display text-base font-semibold text-ink">Profil vérifié</p>
          <p className="text-sm text-ink-soft/70">Le badge ✓ apparaît à côté de votre prénom partout sur BomaVibes.</p>
        </div>
      </div>
    )
  }

  if (request === undefined) return null

  if (request?.status === 'pending' && !challenge) {
    return (
      <div className={`${card} flex items-center gap-3`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-950/10 text-violet-950 dark:bg-white/10 dark:text-white">
          <Clock size={20} strokeWidth={2.25} />
        </span>
        <div>
          <p className="font-display text-base font-semibold text-ink">Vérification en cours</p>
          <p className="text-sm text-ink-soft/70">Notre équipe examine votre selfie. Vous serez prévenu·e dès que c'est fait.</p>
        </div>
      </div>
    )
  }

  // Taking the selfie
  if (challenge) {
    return (
      <div className={card}>
        <p className="font-display text-base font-semibold text-ink">Prenez un selfie en faisant cette pose</p>
        <div className="mt-3 rounded-2xl bg-violet-950 px-4 py-5 text-center text-white">
          <p className="text-lg font-semibold leading-snug">{challenge.instruction}</p>
          <p className="mt-1 text-xs text-white/60">Visage bien visible, sans lunettes de soleil, en pleine lumière.</p>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="user" onChange={handleFile} className="hidden" />

        {previewUrl ? (
          <div className="mt-4 space-y-3">
            <img src={previewUrl} alt="Votre selfie" className="mx-auto max-h-72 rounded-2xl object-cover" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-ink/12 py-2.5 text-sm font-semibold text-ink transition hover:bg-ink/5 disabled:opacity-60"
              >
                <RotateCcw size={15} strokeWidth={2.25} />
                Reprendre
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={isBusy}
                className="flex-1 rounded-full bg-violet-950 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-950/90 disabled:opacity-60 dark:bg-pink-500"
              >
                {isBusy ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-violet-950 py-3 text-sm font-semibold text-white transition hover:bg-violet-950/90 dark:bg-pink-500"
          >
            <Camera size={17} strokeWidth={2.25} />
            Prendre le selfie
          </button>
        )}

        <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-soft/60">
          <Lock size={12} strokeWidth={2.25} className="mt-0.5 shrink-0" />
          Votre selfie n'est jamais affiché sur votre profil. Seule l'équipe de modération le voit, et il est supprimé
          dès la vérification terminée.
        </p>
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
            {wasRejected ? 'Vérification non validée' : 'Faites vérifier votre profil'}
          </p>
          <p className="text-sm text-ink-soft/70">
            {wasRejected
              ? `${request.rejectReason || ''} Vous pouvez réessayer.`
              : 'Obtenez le badge ✓ : les autres sauront que vos photos sont bien les vôtres. Il suffit d’un selfie.'}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleStart}
        disabled={isBusy}
        className="mt-4 w-full rounded-full bg-violet-950 py-3 text-sm font-semibold text-white transition hover:bg-violet-950/90 disabled:opacity-60 dark:bg-pink-500"
      >
        {isBusy ? 'Un instant…' : wasRejected ? 'Réessayer' : 'Vérifier mon profil'}
      </button>
    </div>
  )
}

export default VerificationCard
