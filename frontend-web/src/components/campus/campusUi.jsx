import { useEffect, useRef, useState } from 'react'
import { Check, Clock, FileSpreadsheet, FileText, Loader2, Minus, Printer, Search, ShieldCheck, X } from 'lucide-react'
import { SESSION_STATUS, STATUS, UNSET } from '../../lib/campus.js'
import { downloadExcel, downloadPdf, printReport } from '../../lib/campusExport.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useCampus } from './campusContext.js'
import Spinner from '../ui/Spinner.jsx'

// Small pieces shared by the Campus screens.

// A status is never told by its colour alone: icon and word go with it.
const STATUS_UI = {
  P: { icon: Check, on: 'border-mint-600 bg-mint-600 text-white', soft: 'bg-mint-500/15 text-mint-600 dark:text-mint-400', dot: 'bg-mint-500' },
  R: { icon: Clock, on: 'border-amber-400 bg-amber-400 text-[#2b1a2c]', soft: 'bg-amber-400/20 text-amber-800 dark:text-amber-300', dot: 'bg-amber-400' },
  A: { icon: X, on: 'border-coral-600 bg-coral-600 text-white', soft: 'bg-coral-500/15 text-coral-600 dark:text-coral-400', dot: 'bg-coral-500' },
}
const NONE_UI = { icon: Minus, soft: 'bg-ink/8 text-ink-soft', dot: 'bg-ink/25' }

// justified: for an absence, true or false (undefined: not told apart).
export function StatusPill({ status, justified }) {
  const excused = status === 'A' && justified
  const ui = excused ? { icon: ShieldCheck, soft: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' } : STATUS_UI[status] || NONE_UI
  const Icon = ui.icon
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${ui.soft}`}>
      <Icon size={12} strokeWidth={3} aria-hidden="true" />
      {status === 'A' && justified !== undefined ? (excused ? 'Absent justifié' : 'Absent non justifié') : STATUS[status]?.label || UNSET}
    </span>
  )
}

export function SessionPill({ status }) {
  const tone = status === 'validated' ? STATUS_UI.P.soft : status === 'cancelled' ? STATUS_UI.A.soft : STATUS_UI.R.soft
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${tone}`}>{SESSION_STATUS[status]}</span>
}

// The three big buttons of a sheet's row. Pressing the status already set takes
// it off — unless it was set an instant ago: that's a double tap.
export function StatusButtons({ value, onChange, name, disabled }) {
  const setAt = useRef(0)
  function press(key, on, now) {
    if (on && now - setAt.current < 700) return
    if (!on) setAt.current = now
    onChange(on ? null : key)
  }
  return (
    <div className="flex flex-1 gap-1.5 sm:flex-none" role="group" aria-label={`Statut de ${name}`}>
      {Object.keys(STATUS_UI).map((key) => {
        const ui = STATUS_UI[key]
        const Icon = ui.icon
        const on = value === key
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={(e) => press(key, on, e.timeStamp)}
            className={`flex h-11 flex-1 items-center sm:w-[5.5rem] sm:flex-none desktop:h-10 justify-center gap-1 rounded-xl border text-xs font-bold sm:text-[13px] transition active:scale-95 disabled:opacity-50 ${on ? ui.on : 'border-ink/15 bg-surface text-ink-soft hover:border-ink/30 hover:text-ink'}`}
          >
            <Icon size={14} strokeWidth={3} aria-hidden="true" className="shrink-0 max-[359px]:hidden" />
            {STATUS[key].label}
          </button>
        )
      })}
    </div>
  )
}

export function CountsLine({ counts, justified, className = '' }) {
  return (
    <span className={`flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft ${className}`}>
      {[
        ['P', counts.p, 'présents'],
        ['R', counts.r, 'retards'],
        ['A', counts.a, justified ? `absents (${justified} justifié${justified > 1 ? 's' : ''})` : 'absents'],
        ['N', counts.n, 'non renseignés'],
      ].map(([key, n, label]) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${(STATUS_UI[key] || NONE_UI).dot}`} aria-hidden="true" />
          <b className="font-semibold text-ink">{n}</b> {label}
        </span>
      ))}
    </span>
  )
}

export function Panel({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-ink/8 bg-surface p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-display text-base font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Tile({ label, value, hint, status }) {
  const ui = status ? STATUS_UI[status] || NONE_UI : null
  const Icon = ui?.icon
  return (
    <div className="rounded-2xl border border-ink/8 bg-surface p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
        {Icon && (
          <span className={`flex h-5 w-5 items-center justify-center rounded-full ${ui.soft}`}>
            <Icon size={12} strokeWidth={3} aria-hidden="true" />
          </span>
        )}
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold text-ink">{typeof value === 'number' ? value.toLocaleString('fr-FR') : value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
    </div>
  )
}

export function Loading() {
  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  )
}

export function ErrorNote({ children, onRetry }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-coral-500/30 bg-coral-500/10 px-4 py-3 text-sm text-coral-600 dark:text-coral-400">
      <span>{children}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-semibold underline">
          Réessayer
        </button>
      )}
    </div>
  )
}

export function Empty({ children }) {
  return <p className="rounded-xl bg-ink/[0.03] px-4 py-6 text-center text-sm text-ink-soft">{children}</p>
}

export function Btn({ variant = 'secondary', className = '', icon: Icon, busy, children, ...props }) {
  const look = {
    primary: 'bg-violet-950 text-white hover:opacity-90 dark:bg-violet-600',
    secondary: 'border border-ink/12 bg-surface text-ink hover:bg-ink/5',
    danger: 'bg-coral-600 text-white hover:opacity-90',
    ghost: 'text-ink-soft hover:bg-ink/5 hover:text-ink',
  }[variant]
  return (
    <button type="button" {...props} disabled={props.disabled || busy} className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${look} ${className}`}>
      {busy ? <Loader2 size={16} className="animate-spin" /> : Icon && <Icon size={16} />}
      {children}
    </button>
  )
}

export function SearchBox({ value, onChange, placeholder = 'Rechercher un nom, un prénom, un numéro', inputRef, className = '' }) {
  return (
    <label className={`relative block ${className}`}>
      <span className="sr-only">{placeholder}</span>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-ink/12 bg-surface pl-9 pr-9 text-sm text-ink outline-none placeholder:text-ink-soft/60 focus:border-violet-400 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Effacer la recherche" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-soft hover:bg-ink/5">
          <X size={14} />
        </button>
      )}
    </label>
  )
}


export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  )
}

// Closed with Escape or the cross — not by a press beside it: what was typed
// must not be lost that way.
export function Dialog({ title, onClose, children, footer, wide }) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    const before = document.activeElement
    ref.current?.focus()
    const onKey = (e) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      before?.focus?.()
    }
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-6" data-campus-dialog>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`flex max-h-[92svh] w-full flex-col rounded-t-3xl border border-ink/10 bg-surface outline-none sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="flex items-center justify-between gap-3 border-b border-ink/8 px-5 py-3.5">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-full p-2 text-ink-soft hover:bg-ink/5">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-ink/8 px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  )
}

// PDF, Excel and print of a report. `report` is a function: built only when
// asked for (it may have to load something).
export function ExportButtons({ report, excel = true, print = true, label = '' }) {
  const { boot } = useCampus()
  const { showToast } = useToast()
  const [busy, setBusy] = useState('')
  if (!boot.me.canExport) return null

  async function run(kind, action) {
    setBusy(kind)
    try {
      await action(await report())
      if (kind !== 'print') showToast('Document prêt.', 'success')
    } catch (err) {
      console.error(err)
      showToast(err.message || 'Export impossible.', 'error')
    } finally {
      setBusy('')
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Btn icon={FileText} busy={busy === 'pdf'} onClick={() => run('pdf', downloadPdf)}>
        {label}PDF
      </Btn>
      {excel && (
        <Btn icon={FileSpreadsheet} busy={busy === 'xlsx'} onClick={() => run('xlsx', downloadExcel)}>
          Excel
        </Btn>
      )}
      {print && (
        <Btn icon={Printer} busy={busy === 'print'} onClick={() => run('print', printReport)}>
          Imprimer
        </Btn>
      )}
    </div>
  )
}

// A 0–1 rate as a thin bar with its value, for tables and lists.
export function RateBar({ rate, className = '' }) {
  if (rate === null || rate === undefined) return <span className="text-xs text-ink-soft">—</span>
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <span className="h-2 min-w-12 flex-1 overflow-hidden rounded-full bg-violet-500/15" aria-hidden="true">
        <span className="block h-full rounded-full bg-violet-500" style={{ width: `${Math.round(rate * 100)}%` }} />
      </span>
      <span className="w-12 text-right text-xs font-semibold tabular-nums text-ink">{`${(rate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`}</span>
    </span>
  )
}
