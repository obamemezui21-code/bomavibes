import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, MapPin, Ticket } from 'lucide-react'
import { cancelEventTicket, fetchMyTickets } from '../firebase/events.js'
import { useToast } from '../context/ToastContext.jsx'
import { downloadTicketPdf } from '../lib/ticketPdf.js'
import ConfirmModal from '../components/ui/ConfirmModal.jsx'
import TicketQr from '../components/TicketQr.jsx'
import logoIcon from '../assets/bomavibes-icon.webp'

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
  const [downloadingId, setDownloadingId] = useState(null)

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

  async function handleDownload(ticket) {
    setDownloadingId(ticket.id)
    try {
      await downloadTicketPdf(ticket)
    } catch {
      showToast('Impossible de générer le PDF.', 'error')
    } finally {
      setDownloadingId(null)
    }
  }

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

      <div className="space-y-4">
        {tickets.map((ticket) => (
          <div key={ticket.id} className="relative overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-sm dark:bg-surface-tint">
            <div className="relative h-32 w-full bg-gradient-to-br from-violet-600 to-pink-600">
              {ticket.event?.image && (
                <img src={ticket.event.image} alt="" className="h-full w-full object-cover" loading="lazy" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 py-1 pl-1 pr-2.5 shadow-sm">
                <img src={logoIcon} alt="" className="h-5 w-5 rounded-full" />
                <span className="text-[11px] font-bold text-ink">BomaVibes</span>
              </div>
              <span className="absolute right-3 top-3 rounded-full bg-mint-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                Confirmé
              </span>
              <p className="absolute bottom-2.5 left-3.5 right-3.5 truncate text-sm font-bold text-white drop-shadow-sm">
                {ticket.event?.title || 'Événement supprimé'}
              </p>
            </div>

            <div className="p-4 pb-3">
              {ticket.event && (
                <>
                  <p className="text-xs capitalize text-ink-soft/60">{formatEventDate(ticket.event.date)}</p>
                  {ticket.event.location && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft/60">
                      <MapPin size={12} strokeWidth={2.25} />
                      {ticket.event.location}
                    </p>
                  )}
                </>
              )}
              {ticket.attendeeName && (
                <p className="mt-2 text-xs text-ink-soft/60">Participant : {ticket.attendeeName}</p>
              )}
            </div>

            {/* Perforation — notches sit half outside the card edges, colored
                to match the page (not the card) so overflow-hidden clips
                them into the classic ticket-stub "bite" look. */}
            <div className="relative border-t-2 border-dashed border-ink/15">
              <span className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full bg-surface" />
              <span className="absolute -right-2.5 -top-2.5 h-5 w-5 rounded-full bg-surface" />
            </div>

            <div className="flex items-center gap-3 p-4 pt-3">
              <TicketQr value={`BOMAVIBES:${ticket.code}`} size={56} />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft/50">Code billet</span>
                <p className="font-mono text-base font-bold tracking-wider text-ink">{ticket.code}</p>
              </div>
            </div>

            <div className="flex gap-2 px-4 pb-4">
              <button
                type="button"
                onClick={() => handleDownload(ticket)}
                disabled={downloadingId === ticket.id}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 py-2 text-xs font-semibold text-white shadow-md shadow-violet-500/25 transition disabled:opacity-50"
              >
                <Download size={13} strokeWidth={2.25} />
                {downloadingId === ticket.id ? 'Génération…' : 'Télécharger (PDF)'}
              </button>
              {ticket.event && (
                <button
                  type="button"
                  onClick={() => setCancellingTicket(ticket)}
                  className="rounded-full bg-ink/6 px-4 py-2 text-xs font-semibold text-coral-600 transition hover:bg-coral-500/10"
                >
                  Annuler
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
