import { useState } from 'react'
import { Timer } from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { EPHEMERAL_OPTIONS } from '../../lib/ephemeral.js'

// Choose how long new messages stay in the conversation. Either member can
// change it; a notice tells the other one.
function EphemeralSheet({ firstName, ttl, onClose, onChoose }) {
  const [choice, setChoice] = useState(ttl)
  const [isSaving, setIsSaving] = useState(false)

  async function save() {
    if (choice === ttl) return onClose()
    setIsSaving(true)
    try {
      await onChoose(choice)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <Timer size={30} strokeWidth={1.75} className="mx-auto text-violet-600 dark:text-violet-300" aria-hidden="true" />
      <h2 className="mt-2 text-center font-display text-lg font-semibold text-ink">Messages éphémères</h2>
      <p className="mt-1 text-center text-sm text-ink-soft/70">
        Les nouveaux messages, photos et vocaux disparaissent pour vous deux après la durée choisie.{' '}
        {firstName || 'Votre match'} sera prévenu·e.
      </p>
      <div role="radiogroup" aria-label="Durée des messages" className="mt-4 space-y-2">
        {EPHEMERAL_OPTIONS.map((option) => (
          <label
            key={option.ttl}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
              choice === option.ttl ? 'border-violet-500 bg-violet-500/10' : 'border-ink/12 hover:bg-ink/5'
            }`}
          >
            <input
              type="radio"
              name="ephemeral-ttl"
              value={option.ttl}
              checked={choice === option.ttl}
              onChange={() => setChoice(option.ttl)}
              className="mt-1 accent-violet-600"
            />
            <span>
              <span className="block text-sm font-semibold text-ink">{option.label}</span>
              <span className="block text-xs text-ink-soft/70">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-ink-soft/60">
        Les messages déjà envoyés ne changent pas. Une personne peut toujours recopier ce qu’elle lit : n’envoyez que ce que vous voulez partager.
      </p>
      <div className="mt-4 flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Annuler
        </Button>
        <Button className="flex-1" onClick={save} disabled={isSaving}>
          {isSaving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </Modal>
  )
}

export default EphemeralSheet
