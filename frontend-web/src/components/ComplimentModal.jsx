import { useState } from 'react'
import { MessageCircleHeart } from 'lucide-react'
import Modal from './ui/Modal.jsx'
import Button from './ui/Button.jsx'
import { COMPLIMENT_MAX, COMPLIMENT_SUGGESTIONS } from '../lib/compliments.js'

// A short note sent with a like (Hinge comments / Bumble compliments). `about`
// quotes what it answers on the profile (bio or a prompt), or is null for a
// general compliment.
function ComplimentModal({ firstName, about, onCancel, onSend }) {
  const [text, setText] = useState('')
  const trimmed = text.trim()

  return (
    <Modal onClose={onCancel}>
      <MessageCircleHeart size={32} strokeWidth={1.5} className="mx-auto text-pink-500" />
      <h2 className="mt-2 text-center font-display text-lg font-semibold text-ink">
        Un compliment pour {firstName || 'ce profil'}
      </h2>
      <p className="mt-1 text-center text-xs text-ink-soft/70">
        Il part avec ton like. S'il y a match, il ouvrira votre conversation.
      </p>

      {about && (
        <blockquote className="mt-4 line-clamp-3 rounded-xl border-l-2 border-violet-400 bg-ink/[0.04] px-3 py-2 text-sm text-ink-soft">
          {about}
        </blockquote>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={COMPLIMENT_MAX}
        rows={3}
        autoFocus
        placeholder={about ? 'Ta réaction…' : 'Ce qui te plaît chez cette personne…'}
        className="mt-4 w-full resize-none rounded-xl border border-ink/12 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-violet-400 dark:bg-surface-tint"
      />
      <div className="mt-1 flex justify-end text-[11px] text-ink-soft/50">
        {text.length}/{COMPLIMENT_MAX}
      </div>

      {!about && !trimmed && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {COMPLIMENT_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setText(s)}
              className="rounded-full bg-ink/[0.06] px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-ink/10"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          Annuler
        </Button>
        <Button className="flex-1" disabled={!trimmed} onClick={() => onSend({ text: trimmed, about: about || null })}>
          Envoyer avec un like
        </Button>
      </div>
    </Modal>
  )
}

export default ComplimentModal
