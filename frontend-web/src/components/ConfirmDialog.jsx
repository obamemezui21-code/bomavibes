import ConfirmModal from './ui/ConfirmModal.jsx'

function ConfirmDialog({ title, description, confirmLabel = 'Confirmer', isConfirming, onCancel, onConfirm }) {
  return (
    <ConfirmModal
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      confirmingLabel="Suppression…"
      isConfirming={isConfirming}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

export default ConfirmDialog
