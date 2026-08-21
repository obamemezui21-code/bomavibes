import { TriangleAlert } from 'lucide-react'
import Modal from './Modal.jsx'
import Button from './Button.jsx'

function ConfirmModal({
  icon: Icon = TriangleAlert,
  title,
  description,
  confirmLabel = 'Confirmer',
  confirmingLabel,
  cancelLabel = 'Annuler',
  isConfirming,
  danger = true,
  onCancel,
  onConfirm,
}) {
  return (
    <Modal onClose={onCancel} className="text-center">
      <Icon size={32} strokeWidth={1.5} className="mx-auto text-coral-500" />
      <h2 className="mt-2 font-display text-lg font-semibold text-ink">{title}</h2>
      {description && <p className="mt-1 text-sm text-ink-soft/70">{description}</p>}
      <div className="mt-5 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          className="flex-1"
          onClick={onConfirm}
          disabled={isConfirming}
        >
          {isConfirming ? confirmingLabel || `${confirmLabel}…` : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

export default ConfirmModal
