import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, ShieldX, X } from 'lucide-react'
import {
  fetchVerificationRequests,
  fetchVerificationSelfieUrl,
  reviewVerification,
  revokeVerification,
} from '../firebase/verification.js'
import { useToast } from '../context/ToastContext.jsx'

const STATUS_TABS = [
  { value: 'pending', label: 'À examiner' },
  { value: 'approved', label: 'Validées' },
  { value: 'rejected', label: 'Refusées' },
]

const REJECT_REASONS = [
  { value: 'mismatch', label: 'Ne correspond pas aux photos du profil' },
  { value: 'pose', label: 'Pose demandée non visible' },
  { value: 'blurry', label: 'Photo floue ou trop sombre' },
  { value: 'face', label: 'Visage pas assez visible' },
  { value: 'other', label: 'Autre raison' },
]

function formatDate(ms) {
  if (!ms) return ''
  return new Date(ms).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// The private selfie, loaded with the moderator's token (see verification.js).
function PrivateSelfie({ uid }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let objectUrl = null
    let cancelled = false
    fetchVerificationSelfieUrl(uid)
      .then((u) => {
        objectUrl = u
        if (!cancelled) setUrl(u)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [uid])

  if (failed) return <div className="flex h-full items-center justify-center text-xs text-ink-soft/60">Selfie indisponible</div>
  if (!url) return <div className="h-full w-full animate-pulse bg-ink/8" />
  return <img src={url} alt="Selfie de vérification" className="h-full w-full object-cover" />
}

function VerificationItem({ request, onDecided }) {
  const { showToast } = useToast()
  const [isRejecting, setIsRejecting] = useState(false)
  const [reason, setReason] = useState('mismatch')
  const [isBusy, setIsBusy] = useState(false)
  const { profile } = request

  async function decide(decision) {
    setIsBusy(true)
    try {
      await reviewVerification(request.uid, decision, decision === 'reject' ? reason : undefined)
      showToast(decision === 'approve' ? 'Profil vérifié.' : 'Demande refusée.', 'success')
      onDecided(request.uid)
    } catch (err) {
      showToast(err.message, 'error')
      setIsBusy(false)
    }
  }

  async function revoke() {
    setIsBusy(true)
    try {
      await revokeVerification(request.uid)
      showToast('Badge retiré.', 'success')
      onDecided(request.uid)
    } catch (err) {
      showToast(err.message, 'error')
      setIsBusy(false)
    }
  }

  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-base font-semibold text-ink">
          {profile.firstName || 'Sans prénom'}
          {profile.age ? `, ${profile.age}` : ''}
          {profile.city ? <span className="font-normal text-ink-soft/60"> · {profile.city}</span> : null}
        </p>
        <p className="text-xs text-ink-soft/60">
          {request.status === 'pending' ? `Envoyé le ${formatDate(request.submittedAt)}` : `Traité le ${formatDate(request.reviewedAt)}`}
        </p>
      </div>

      {request.status === 'pending' && (
        <>
          <p className="mt-2 rounded-xl bg-violet-950 px-3 py-2 text-sm font-medium text-white">
            Pose demandée : {request.instruction || request.pose}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-violet-600">Selfie</p>
              <div className="aspect-[3/4] overflow-hidden rounded-xl ring-2 ring-violet-500">
                {request.hasSelfie ? <PrivateSelfie uid={request.uid} /> : null}
              </div>
            </div>
            {profile.photos.slice(0, 3).map((url, i) => (
              <div key={url}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-soft/60">Photo {i + 1}</p>
                <img src={url} alt="" className="aspect-[3/4] w-full rounded-xl object-cover" />
              </div>
            ))}
          </div>

          {isRejecting ? (
            <div className="mt-3 space-y-2">
              <label className="block text-sm font-medium text-ink/80" htmlFor={`reason-${request.uid}`}>
                Raison du refus (envoyée à l'utilisateur)
              </label>
              <select
                id={`reason-${request.uid}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-ink/12 bg-ink/[0.03] px-3.5 py-2.5 text-sm text-ink outline-none focus:border-violet-400"
              >
                {REJECT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsRejecting(false)}
                  disabled={isBusy}
                  className="flex-1 rounded-full border border-ink/12 py-2 text-sm font-semibold text-ink hover:bg-ink/5"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => decide('reject')}
                  disabled={isBusy}
                  className="flex-1 rounded-full bg-coral-500 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Confirmer le refus
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setIsRejecting(true)}
                disabled={isBusy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-coral-500/40 py-2 text-sm font-semibold text-coral-500 hover:bg-coral-500/5 disabled:opacity-60"
              >
                <X size={15} strokeWidth={2.5} />
                Refuser
              </button>
              <button
                type="button"
                onClick={() => decide('approve')}
                disabled={isBusy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-sky-500 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                <BadgeCheck size={16} strokeWidth={2.25} />
                Valider
              </button>
            </div>
          )}
        </>
      )}

      {request.status === 'rejected' && request.rejectReason && (
        <p className="mt-2 text-sm text-ink-soft/70">Motif : {request.rejectReason}</p>
      )}

      {request.status === 'approved' && (
        <button
          type="button"
          onClick={revoke}
          disabled={isBusy}
          className="mt-3 flex items-center gap-1.5 rounded-full border border-ink/12 px-3.5 py-1.5 text-xs font-semibold text-ink-soft/70 hover:bg-ink/5 disabled:opacity-60"
        >
          <ShieldX size={14} strokeWidth={2.25} />
          Retirer le badge
        </button>
      )}
    </div>
  )
}

function AdminVerifications() {
  const { showToast } = useToast()
  const [status, setStatus] = useState('pending')
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setRequests(await fetchVerificationRequests(status))
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [status, showToast])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 desktop:py-8">
      <h2 className="font-display text-lg font-semibold text-ink">Vérifications de profil</h2>
      <p className="mb-4 mt-1 text-sm text-ink-soft/70">
        Comparez le selfie avec les photos du profil et vérifiez que la pose demandée est bien faite. Le selfie est
        supprimé dès la décision prise.
      </p>

      <div className="mb-4 flex gap-1.5 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              status === tab.value ? 'bg-ink text-surface' : 'bg-ink/6 text-ink-soft/60 hover:bg-ink/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="py-8 text-center text-sm text-ink-soft/50">Chargement…</p>}
      {!isLoading && requests.length === 0 && (
        <p className="py-8 text-center text-sm text-ink-soft/50">Aucune demande dans cette catégorie.</p>
      )}

      <div className="space-y-3">
        {requests.map((r) => (
          <VerificationItem
            key={r.uid}
            request={r}
            onDecided={(uid) => setRequests((prev) => prev.filter((x) => x.uid !== uid))}
          />
        ))}
      </div>
    </div>
  )
}

export default AdminVerifications
