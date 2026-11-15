import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Plus, Trash2 } from 'lucide-react'
import { inputClass, labelClass } from '../../lib/formStyles.js'
import { MONTH_NAMES, parseMonthYear } from '../../lib/cvAssistant.js'
import { NIVEAUX, YEARS, capitalizeWord } from './cvShared.js'

// Small building blocks of the CV PNPE screens.

export function StepCard({ title, subtitle, children }) {
  return (
    <section className="glass-panel rounded-3xl p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      {subtitle && <p className="mt-1 text-sm leading-relaxed text-ink-soft/80">{subtitle}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  )
}

// A label, with a tick that pops in once the field is right.
export function Field({ label, required, valid, error, hint, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className={`${labelClass} flex items-center gap-1.5`}>
        {label}
        {required && <span className="text-pink-600">*</span>}
        <AnimatePresence>
          {valid && (
            <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-mint-500 text-white">
              <Check size={12} strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-pink-600">{error}</span>}
      {!error && hint && <span className="mt-1 block text-xs text-ink-soft/70">{hint}</span>}
    </label>
  )
}

export function Chip({ selected = false, onClick, children, icon: Icon, small = false }) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      type="button"
      whileTap={reduce ? undefined : { scale: 0.93 }}
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium transition ${small ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${
        selected
          ? 'border-transparent bg-gradient-to-r from-brand-1 via-brand-2 to-brand-3 text-white shadow-md shadow-violet-500/25'
          : 'border-ink/12 bg-white/70 text-ink/80 hover:border-violet-400 hover:text-violet-700 dark:bg-white/5'
      }`}
    >
      {Icon && <Icon size={small ? 12 : 14} />}
      {children}
    </motion.button>
  )
}

export function ChipRow({ children, label }) {
  return (
    <div>
      {label && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft/60">{label}</p>}
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export function AddButton({ onClick, children }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-violet-400/40 py-3 text-sm font-semibold text-violet-600 transition hover:border-violet-400 hover:bg-violet-500/5"
    >
      <Plus size={16} /> {children}
    </motion.button>
  )
}

export function RemoveButton({ onClick, label }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft/60 transition hover:bg-coral-500/10 hover:text-coral-600">
      <Trash2 size={16} />
    </button>
  )
}

// Month and year from two lists: no date to type, no format to guess.
export function MonthYear({ value, onChange, disabled = false, label }) {
  const { month, year } = parseMonthYear(value)
  const compose = (m, y) => (m >= 0 && y ? `${MONTH_NAMES[m]} ${y}` : y || (m >= 0 ? MONTH_NAMES[m] : ''))
  return (
    <div className="grid grid-cols-[1.25fr_1fr] gap-2">
      <select aria-label={`${label} : mois`} className={inputClass} value={month} disabled={disabled} onChange={(e) => onChange(compose(Number(e.target.value), year))}>
        <option value={-1}>Mois</option>
        {MONTH_NAMES.map((m, i) => (
          <option key={m} value={i}>
            {m}
          </option>
        ))}
      </select>
      <select aria-label={`${label} : année`} className={inputClass} value={year} disabled={disabled} onChange={(e) => onChange(compose(month, e.target.value))}>
        <option value="">Année</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center gap-2.5 py-1 text-sm text-ink/80">
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-violet-500' : 'bg-ink/20'}`}>
        <motion.span layout className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  )
}

export function LevelPills({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Niveau">
      {NIVEAUX.map((n) => (
        <Chip key={n} small selected={value === n} onClick={() => onChange(n)}>
          {capitalizeWord(n)}
        </Chip>
      ))}
    </div>
  )
}

// Score ring for « CV complet à 72 % ».
export function ScoreRing({ value, size = 64 }) {
  const reduce = useReducedMotion()
  const r = size / 2 - 5
  const circumference = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`CV complet à ${value} %`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-white/25" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: circumference * (1 - value / 100) }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 60, damping: 15 }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">{value}%</span>
    </div>
  )
}
