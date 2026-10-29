import { useCallback, useEffect, useState } from 'react'
import { Check, MessageSquareWarning, X } from 'lucide-react'
import { decidePhotoReview, fetchPhotoReviewImageUrl, fetchPhotoReviews } from '../firebase/photoReviews.js'
import { useToast } from '../context/ToastContext.jsx'

const STATUS_TABS = [
  { value: 'pending', label: 'À vérifier' },
  { value: 'approved', label: 'Validées' },
  { value: 'rejected', label: 'Refusées' },
]

const SOURCES = {
  upload: 'Envoyée — acceptée en attendant',
  audit: 'Déjà sur le profil',
  'upload-refused': 'Refusée à l’envoi — contestée',
}

const REASON_LABELS = {
  'photo-no-face': 'Aucun visage visible',
  'photo-face-hidden': 'Visage caché',
  'photo-face-too-small': 'Visage trop petit',
  'photo-blurry': 'Floue',
  'photo-too-dark': 'Trop sombre',
  'photo-drawing': 'Dessin / illustration',
  'photo-animal': 'Animal',
  'photo-object': 'Statue, masque, poupée',
  'photo-not-ours': 'Ne vient pas de BomaVibes',
}

function formatDate(ms) {
  if (!ms) return ''
  return new Date(ms).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// The analysis' measures, in words a moderator can read.
function Scores({ details }) {
  const k = details.kinds || {}
  const items = [
    ['Visage', details.faceScore],
    ['Personne', k.person],
    ['Dessin', k.drawing],
    ['Animal', k.animal],
    ['Objet', k.object],
  ].filter(([, v]) => typeof v === 'number')
  if (!items.length) return null
  return (
    <p className="mt-1 text-[11px] text-ink-soft/60">
      Analyse : {items.map(([label, v]) => `${label} ${Math.round(v * 100)} %`).join(' · ')}
    </p>
  )
}

function PhotoImage({ id }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let objectUrl = null
    let cancelled = false
    fetchPhotoReviewImageUrl(id)
      .then((u) => {
        objectUrl = u
        if (!cancelled) setUrl(u)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id])
  if (failed) return <div className="flex h-full items-center justify-center p-2 text-center text-xs text-ink-soft/60">Photo indisponible</div>
  if (!url) return <div className="h-full w-full animate-pulse bg-ink/8" />
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full w-full" title="Ouvrir en grand">
      <img src={url} alt="Photo à vérifier" className="h-full w-full object-cover" />
    </a>
  )
}

function ReviewItem({ review, onDecided }) {
  const { showToast } = useToast()
  const [isRejecting, setIsRejecting] = useState(false)
  const [code, setCode] = useState(review.code || 'photo-no-face')
  const [isBusy, setIsBusy] = useState(false)
  const pending = review.status === 'pending'

  async function decide(decision) {
    setIsBusy(true)
    try {
      const res = await decidePhotoReview(review.id, decision, decision === 'reject' ? code : undefined)
      showToast(decision === 'approve' ? (res.added === false && !review.onProfile ? 'Validée (profil déjà complet : le membre est prévenu).' : 'Photo validée.') : 'Photo refusée.', 'success')
      onDecided(review.id)
    } catch (err) {
      showToast(err.message, 'error')
      setIsBusy(false)
    }
  }

  return (
    <div className="glass-panel flex gap-3 rounded-2xl p-3">
      <div className="aspect-[3/4] w-28 shrink-0 overflow-hidden rounded-xl bg-ink/5 sm:w-36">
        <PhotoImage id={review.id} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <p className="font-display text-base font-semibold text-ink">{review.firstName}</p>
          <p className="text-[11px] text-ink-soft/60">
            {pending ? formatDate(review.createdAt) : `Traité le ${formatDate(review.decidedAt)}`}
          </p>
        </div>
        <p className="text-xs text-ink-soft/70">{SOURCES[review.source] || review.source}</p>
        {review.appealed && (
          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            <MessageSquareWarning size={12} /> Contestée par le membre
          </p>
        )}
        {review.code && (
          <p className="mt-1 text-xs text-ink">
            Analyse automatique : <b>{REASON_LABELS[review.code] || review.code}</b>
          </p>
        )}
        <Scores details={review.details} />
        {!pending && review.decisionCode && (
          <p className="mt-1 text-xs text-coral-600">Motif envoyé : {REASON_LABELS[review.decisionCode] || review.decisionCode}</p>
        )}

        {pending &&
          (isRejecting ? (
            <div className="mt-2 space-y-2">
              <label className="block text-xs font-medium text-ink/80" htmlFor={`code-${review.id}`}>
                Motif (envoyé au membre, avec un conseil)
              </label>
              <select
                id={`code-${review.id}`}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-xl border border-ink/12 bg-ink/[0.03] px-3 py-2 text-sm text-ink outline-none focus:border-violet-400"
              >
                {Object.entries(REASON_LABELS)
                  .filter(([c]) => c !== 'photo-not-ours')
                  .map(([c, label]) => (
                    <option key={c} value={c}>
                      {label}
                    </option>
                  ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsRejecting(false)}
                  disabled={isBusy}
                  className="flex-1 rounded-full border border-ink/12 py-1.5 text-sm font-semibold text-ink hover:bg-ink/5"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => decide('reject')}
                  disabled={isBusy}
                  className="flex-1 rounded-full bg-coral-500 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Confirmer le refus
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setIsRejecting(true)}
                disabled={isBusy}
                className="flex flex-1 items-center justify-center gap-1 rounded-full border border-coral-500/40 py-1.5 text-sm font-semibold text-coral-500 hover:bg-coral-500/5 disabled:opacity-60"
              >
                <X size={15} strokeWidth={2.5} /> Refuser
              </button>
              <button
                type="button"
                onClick={() => decide('approve')}
                disabled={isBusy}
                className="flex flex-1 items-center justify-center gap-1 rounded-full bg-violet-600 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Check size={15} strokeWidth={2.5} /> Valider
              </button>
            </div>
          ))}
      </div>
    </div>
  )
}

// Photos the automatic analysis wasn't sure about, refused photos members
// contest, and photos already on profiles the audit refused (a refusal only
// suspends an account once confirmed here).
function AdminPhotoReviews() {
  const [status, setStatus] = useState('pending')
  const [reviews, setReviews] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setReviews(null)
    setError(null)
    fetchPhotoReviews(status)
      .then((d) => setReviews(d.reviews.map((r) => ({ ...r, status }))))
      .catch((err) => setError(err.message))
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Photos à vérifier</h1>
        <p className="mt-1 text-sm text-ink-soft/70">
          L’analyse automatique ne refuse que ce qui est certain. Ici : les photos dont elle n’est pas sûre (acceptées en attendant), et
          les refus contestés ou à confirmer. Un compte n’est suspendu qu’après un refus confirmé ici.
        </p>
      </div>
      <div className="flex gap-2" role="tablist">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            onClick={() => setStatus(tab.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              status === tab.value ? 'bg-violet-600 text-white' : 'border border-ink/12 text-ink-soft hover:bg-ink/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-coral-600">{error}</p>}
      {!reviews && !error && <div className="h-32 animate-pulse rounded-2xl bg-ink/5" />}
      {reviews?.length === 0 && <p className="py-10 text-center text-sm text-ink-soft/60">Rien à afficher ici.</p>}
      <div className="space-y-3">
        {reviews?.map((review) => (
          <ReviewItem key={review.id} review={review} onDecided={(id) => setReviews((list) => list.filter((r) => r.id !== id))} />
        ))}
      </div>
    </div>
  )
}

export default AdminPhotoReviews
