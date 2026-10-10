import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import Button from '../ui/Button.jsx'

// Admin forms as short steps instead of one long scrolling form: a few
// fields at a time, "Suivant" (or Enter) checks them and shows the next ones.
//
// steps: [{ title, hint?, content, validate?: () => errorMessage | null }]
// Native `required` / type checks of the step's own fields run first.
// isEditing: an existing item — every step can be opened directly and saved
// from anywhere, no need to walk through all of them to change one field.
function StepForm({
  title,
  steps,
  onSubmit,
  onCancel,
  isSaving = false,
  isEditing = false,
  submitLabel = 'Enregistrer',
  savingLabel = 'Enregistrement…',
  submitIcon: SubmitIcon = Check,
}) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [error, setError] = useState('')
  // Furthest step reached: a new item can jump back, not ahead.
  const [reached, setReached] = useState(isEditing ? steps.length - 1 : 0)
  const stepRef = useRef(null)
  const prefersReducedMotion = useReducedMotion()

  const step = steps[Math.min(index, steps.length - 1)]
  const isLast = index >= steps.length - 1

  // Put the cursor in the step's first field.
  useEffect(() => {
    const first = stepRef.current?.querySelector(
      'input:not([type=hidden]):not([type=file]):not([type=checkbox]), textarea, select',
    )
    first?.focus({ preventScroll: true })
  }, [index])

  function checkStep() {
    const fields = stepRef.current ? [...stepRef.current.querySelectorAll('input, select, textarea')] : []
    const invalid = fields.find((f) => !f.checkValidity())
    if (invalid) {
      invalid.reportValidity()
      return false
    }
    const message = step.validate?.()
    if (message) {
      setError(message)
      return false
    }
    setError('')
    return true
  }

  function goTo(next) {
    if (next === index || next < 0 || next >= steps.length) return
    if (next > index && !checkStep()) return
    setError('')
    setDirection(next > index ? 1 : -1)
    setIndex(next)
    setReached((r) => Math.max(r, next))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (isSaving) return
    if (!isLast && !isEditing) {
      goTo(index + 1)
      return
    }
    if (!checkStep()) return
    // Steps not shown are unmounted: check their validate() too.
    const blocked = steps.findIndex((s) => s.validate?.())
    if (blocked !== -1) {
      setDirection(blocked > index ? 1 : -1)
      setIndex(blocked)
      setError(steps[blocked].validate())
      return
    }
    onSubmit(e)
  }

  const offset = prefersReducedMotion ? 0 : 24

  return (
    <form onSubmit={handleSubmit}>
      {title && <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>}

      {/* Progress: one chip per step, the reachable ones clickable. */}
      <div className="mt-3 flex items-center gap-1.5">
        {steps.map((s, i) => {
          const canOpen = i <= reached
          return (
            <button
              key={i}
              type="button"
              onClick={() => canOpen && goTo(i)}
              disabled={!canOpen}
              title={s.title}
              aria-label={`Étape ${i + 1} : ${s.title}`}
              className={`h-1.5 flex-1 rounded-full transition ${
                i === index ? 'bg-violet-500' : i <= reached ? 'bg-violet-500/35 hover:bg-violet-500/60' : 'bg-ink/10'
              }`}
            />
          )
        })}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{step.title}</p>
        <p className="shrink-0 text-[11px] font-medium tabular-nums text-ink-soft/50">
          Étape {index + 1} / {steps.length}
        </p>
      </div>
      {step.hint && <p className="mt-0.5 text-xs text-ink-soft/55">{step.hint}</p>}

      <div className="relative mt-3 min-h-[9rem]">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={index}
            ref={stepRef}
            custom={direction}
            initial={{ opacity: 0, x: direction * offset }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * offset }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.16, ease: 'easeOut' }}
            className="space-y-3"
          >
            {step.content}
          </motion.div>
        </AnimatePresence>
      </div>

      {error && <p className="mt-3 rounded-xl bg-coral-500/10 px-3 py-2 text-xs text-coral-500">{error}</p>}

      <div className="mt-5 flex gap-3">
        {index === 0 ? (
          <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
            Annuler
          </Button>
        ) : (
          <Button type="button" variant="secondary" className="flex flex-1 items-center justify-center gap-1.5" onClick={() => goTo(index - 1)}>
            <ArrowLeft size={15} strokeWidth={2.25} />
            Retour
          </Button>
        )}
        {!isLast && (
          <Button
            type={isEditing ? 'button' : 'submit'}
            variant={isEditing ? 'secondary' : undefined}
            onClick={isEditing ? () => goTo(index + 1) : undefined}
            className="flex flex-1 items-center justify-center gap-1.5"
          >
            Suivant
            <ArrowRight size={15} strokeWidth={2.25} />
          </Button>
        )}
        {(isLast || isEditing) && (
          <Button type="submit" className="flex flex-1 items-center justify-center gap-1.5" disabled={isSaving}>
            <SubmitIcon size={15} strokeWidth={2.25} />
            {isSaving ? savingLabel : submitLabel}
          </Button>
        )}
      </div>
    </form>
  )
}

export default StepForm
