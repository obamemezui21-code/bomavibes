import { Plus, X } from 'lucide-react'
import { MAX_PROFILE_PROMPTS, PROFILE_PROMPTS, PROMPT_ANSWER_MAX } from '../lib/onboardingOptions.js'
import { inputClass, labelClass } from '../lib/formStyles.js'

// Up to MAX_PROFILE_PROMPTS { question, answer } pairs: the member picks a
// question (each one at most once) and writes a short answer.
function ProfilePromptsEditor({ prompts, onChange }) {
  const used = prompts.map((p) => p.question)
  const nextFree = PROFILE_PROMPTS.find((q) => !used.includes(q))

  function update(index, patch) {
    onChange(prompts.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  return (
    <div>
      <label className={labelClass}>
        Mes questions <span className="font-normal text-ink-soft/50">(jusqu'à {MAX_PROFILE_PROMPTS})</span>
      </label>
      <p className="-mt-1 mb-3 text-xs text-ink-soft/60">Des réponses qui donnent envie d'engager la conversation.</p>

      <div className="space-y-3">
        {prompts.map((prompt, index) => (
          <div key={index} className="rounded-2xl border border-ink/10 bg-surface-soft p-3">
            <div className="flex items-center gap-2">
              <select
                value={prompt.question}
                onChange={(e) => update(index, { question: e.target.value })}
                aria-label="Question"
                className={`${inputClass} flex-1 font-semibold text-violet-600`}
              >
                {PROFILE_PROMPTS.filter((q) => q === prompt.question || !used.includes(q)).map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onChange(prompts.filter((_, i) => i !== index))}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5"
                aria-label="Retirer cette question"
              >
                <X size={16} />
              </button>
            </div>
            <textarea
              rows="2"
              maxLength={PROMPT_ANSWER_MAX}
              placeholder="Votre réponse…"
              value={prompt.answer}
              onChange={(e) => update(index, { answer: e.target.value })}
              className={`${inputClass} mt-2 resize-none`}
            />
            <p className="mt-1 text-right text-[11px] text-ink-soft/50">
              {prompt.answer.length}/{PROMPT_ANSWER_MAX}
            </p>
          </div>
        ))}
      </div>

      {prompts.length < MAX_PROFILE_PROMPTS && nextFree && (
        <button
          type="button"
          onClick={() => onChange([...prompts, { question: nextFree, answer: '' }])}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-violet-500/40 py-3 text-sm font-semibold text-violet-600 transition hover:bg-violet-500/5"
        >
          <Plus size={16} strokeWidth={2.5} />
          Ajouter une question
        </button>
      )}
    </div>
  )
}

export default ProfilePromptsEditor
