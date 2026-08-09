import { useState } from 'react'
import { Send, X } from 'lucide-react'

const MAX_LENGTH = 500

function CommentComposer({ replyTarget, replyAuthorName, onCancelReply, onSubmit }) {
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onSubmit(trimmed)
      setText('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="border-t border-ink/8 bg-surface p-3">
      {replyTarget && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-ink/[0.04] px-3 py-1.5 text-xs">
          <span className="text-ink-soft/70">
            Réponse à <span className="font-semibold text-ink">{replyAuthorName || 'ce commentaire'}</span>
          </span>
          <button type="button" onClick={onCancelReply} className="text-ink-soft/50 hover:text-ink">
            <X size={14} strokeWidth={2.25} />
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <textarea
          rows={1}
          maxLength={MAX_LENGTH}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e)
            }
          }}
          placeholder={replyTarget ? 'Écrire une réponse…' : 'Écrire un commentaire…'}
          className="max-h-32 min-h-[44px] w-full resize-none rounded-2xl border border-ink/12 bg-ink/[0.03] px-3.5 py-2.5 text-sm text-ink placeholder-ink-soft/40 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-400/15"
        />
        <button
          type="submit"
          disabled={!text.trim() || isSubmitting}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-[#2B1D14] shadow-lg shadow-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Envoyer"
        >
          <Send size={17} strokeWidth={2.25} />
        </button>
      </form>
    </div>
  )
}

export default CommentComposer
