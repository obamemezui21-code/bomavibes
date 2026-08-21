import { ShieldOff } from 'lucide-react'
import ConfirmModal from './ui/ConfirmModal.jsx'

function BlockConfirmModal({ firstName, onCancel, onConfirm, isBlocking }) {
  return (
    <ConfirmModal
      icon={ShieldOff}
      title={`Bloquer ${firstName || 'cette personne'} ?`}
      description={`${firstName || 'Cette personne'} ne pourra plus vous contacter ni voir votre profil. Vous pourrez débloquer à tout moment depuis les paramètres.`}
      confirmLabel="Bloquer"
      confirmingLabel="Blocage…"
      isConfirming={isBlocking}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

export default BlockConfirmModal
