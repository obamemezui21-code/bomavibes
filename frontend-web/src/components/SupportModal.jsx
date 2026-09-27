import { X } from 'lucide-react'
import Modal from './ui/Modal.jsx'
import SupportForm from './SupportForm.jsx'

// Same content as the standalone /soutenir page, opened in place instead —
// used from Profile/Réglages/Discover so the user never loses their spot.
// The pre-auth marketing entry points (Landing, its teaser, the landing
// chat widget) keep linking to the full page.
function SupportModal({ onClose }) {
  return (
    <Modal onClose={onClose} className="max-h-[85vh] max-w-lg overflow-y-auto text-left">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">Construisons BomaVibes ensemble</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink/60 transition hover:bg-ink/8"
          aria-label="Fermer"
        >
          <X size={18} strokeWidth={2.25} />
        </button>
      </div>

      <SupportForm />
    </Modal>
  )
}

export default SupportModal
