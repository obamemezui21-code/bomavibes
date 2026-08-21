import { useState } from 'react'
import { Flag } from 'lucide-react'
import { REPORT_REASONS } from '../lib/reportReasons.js'
import Modal from './ui/Modal.jsx'
import Button from './ui/Button.jsx'

const chipClass = (selected) =>
  `rounded-xl border px-3.5 py-2 text-sm font-medium transition ${
    selected
      ? 'border-coral-400 bg-coral-500/10 text-coral-500'
      : 'border-ink/12 text-ink-soft/70 hover:bg-ink/5'
  }`

function ReportModal({ firstName, onClose, onSubmit, isSubmitting, title, reasons = REPORT_REASONS }) {
  const [reason, setReason] = useState(null)
  const [description, setDescription] = useState('')
  const [alsoBlock, setAlsoBlock] = useState(true)

  return (
    <Modal onClose={onClose}>
        <div className="flex items-center gap-2">
          <Flag size={18} strokeWidth={2.25} className="text-coral-500" />
          <h2 className="font-display text-lg font-semibold text-ink">{title || `Signaler ${firstName || 'ce profil'}`}</h2>
        </div>
        <p className="mt-1 text-sm text-ink-soft/70">Notre équipe examine chaque signalement.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {reasons.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className={chipClass(reason === r)}>
              {r}
            </button>
          ))}
        </div>

        <textarea
          rows="3"
          maxLength="500"
          placeholder="Détails (facultatif)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-3 w-full resize-none rounded-xl border border-ink/12 bg-ink/[0.03] px-3.5 py-2.5 text-sm text-ink placeholder-ink-soft/50 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-400/15"
        />

        <label className="mt-3 flex items-center gap-2 text-sm text-ink/80">
          <input
            type="checkbox"
            checked={alsoBlock}
            onChange={(e) => setAlsoBlock(e.target.checked)}
            className="h-4 w-4 rounded border-ink/25 accent-coral-500"
          />
          Bloquer également cette personne
        </label>

        <div className="mt-5 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => onSubmit(reason, description.trim(), alsoBlock)}
            disabled={!reason || isSubmitting}
          >
            {isSubmitting ? 'Envoi…' : 'Signaler'}
          </Button>
        </div>
    </Modal>
  )
}

export default ReportModal
