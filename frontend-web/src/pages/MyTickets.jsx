import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Ticket } from 'lucide-react'
import { cancelEventTicket, fetchMyTickets } from '../firebase/events.js'
import { useToast } from '../context/ToastContext.jsx'
import ConfirmModal from '../components/ui/ConfirmModal.jsx'

function formatEventDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function MyTickets() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [tickets, setTickets] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [cancellingTicket, setCancellingTicket] = useState(null)
  const [isCancelling, setIsCancelling] = useState(false)

  const load = useCallback(() => {
    setIsLoading(true)
    fetchMyTickets()
      .then((data) => setTickets(data.tickets))
      .catch(() => showToast('Impossible de charger tes billets.', 'error'))
      .finally(() => setIsLoading(false))
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  async function handleCancel() {
    if (!cancellingTicket) return
    setIsCancelling(true)
    try {
      await cancelEventTicket(cancellingTicket.event.id)
      setTickets((prev) => prev.filter((t) => t.id !== cancellingTicket.id))
      showToast('Réservation annulée.', 'success')
      setCancellingTicket(null)
    } catch (err) {
      showToast(err.message || "Impossible d'annuler cette réservation.", 'error')
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24 desktop:pb-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/events')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5"
          aria-label="Retour"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <h1 className="font-display text-xl font-semibold text-ink">Mes billets</h1>
      </div>

      {isLoading && <p className="py-16 text-center text-sm text-ink-soft/50">Chargement…</p>}

      {!isLoading && tickets.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <Ticket size={32} strokeWidth={1.5} className="text-ink-soft/30" />
          <p className="text-sm text-ink-soft/60">Aucune réservation pour le moment.</p>
        </div>
      )}

      <div className="space-y-3">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="glass-panel overflow-hidden rounded-2xl">
            {ticket.event?.image && (
              <img src={ticket.event.image} alt="" className="h-28 w-full object-cover" loading="lazy" />
            )}
            <div className="p-4">
              <p className="text-sm font-semibold text-ink">{ticket.event?.title || 'Événement supprimé'}</p>
              {ticket.event && (
                <>
                  <p className="mt-1 text-xs capitalize text-ink-soft/60">{formatEventDate(ticket.event.date)}</p>
                  {ticket.event.location && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft/60">
                      <MapPin size={12} strokeWidth={2.25} />
                      {ticket.event.location}
                    </p>
                  )}
                </>
              )}
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-ink/[0.04] px-3 py-2">
                <span className="text-[11px] font-semibold uppercase text-ink-soft/50">Code billet</span>
                <span className="font-mono text-sm font-bold tracking-wider text-ink">{ticket.code}</span>
              </div>
              {ticket.event && (
                <button
                  type="button"
                  onClick={() => setCancellingTicket(ticket)}
                  className="mt-3 w-full rounded-full bg-ink/6 py-2 text-xs font-semibold text-coral-600 transition hover:bg-coral-500/10"
                >
                  Annuler ma réservation
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {cancellingTicket && (
        <ConfirmModal
          title="Annuler cette réservation ?"
          description={`Ta place pour "${cancellingTicket.event?.title}" sera libérée.`}
          confirmLabel="Annuler la réservation"
          confirmingLabel="Un instant…"
          isConfirming={isCancelling}
          onCancel={() => setCancellingTicket(null)}
          onConfirm={handleCancel}
        />
      )}
    </div>
  )
}

export default MyTickets
