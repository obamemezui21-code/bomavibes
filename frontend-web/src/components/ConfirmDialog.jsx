import { motion } from 'framer-motion'
import { TriangleAlert } from 'lucide-react'

function ConfirmDialog({ title, description, confirmLabel = 'Confirmer', isConfirming, onCancel, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-sm rounded-2xl p-6 text-center"
      >
        <TriangleAlert size={32} strokeWidth={1.5} className="mx-auto text-coral-500" />
        <h2 className="mt-2 font-display text-lg font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-soft/70">{description}</p>}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-ink/12 py-2.5 text-sm font-medium text-ink/80 hover:bg-ink/5"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="flex-1 rounded-xl bg-coral-500 py-2.5 text-sm font-semibold text-white transition hover:bg-coral-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isConfirming ? 'Suppression…' : confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default ConfirmDialog
