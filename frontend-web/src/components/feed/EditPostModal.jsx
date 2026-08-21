import { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

const MAX_LENGTH = 1000

function EditPostModal({ post, onClose, onSave }) {
  const [text, setText] = useState(post.text || '')
  const [isSaving, setIsSaving] = useState(false)

  const requiresText = post.type !== 'photo'
  const canSave = (!requiresText || text.trim().length > 0) && text !== (post.text || '')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSave || isSaving) return
    setIsSaving(true)
    try {
      await onSave(text.trim())
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-lg rounded-2xl p-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Modifier la publication</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft/60 hover:bg-ink/10"
            aria-label="Fermer"
          >
            <X size={16} strokeWidth={2.25} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <textarea
            rows={5}
            maxLength={MAX_LENGTH}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={post.type === 'photo' ? 'Légende (facultatif)…' : 'Votre texte…'}
            className="w-full resize-none rounded-xl border border-ink/12 bg-ink/[0.03] px-3.5 py-2.5 text-sm text-ink placeholder-ink-soft/50 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-400/15 dark:focus:bg-ink/[0.06]"
          />
          <button
            type="submit"
            disabled={!canSave || isSaving}
            className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 py-2.5 text-sm font-semibold text-ink-on-brand shadow-lg shadow-violet-500/25 transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

export default EditPostModal
