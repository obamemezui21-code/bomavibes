import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { inputClass } from '../lib/formStyles.js'

// "Côte d'Ivoire" is found by typing "cote", "COTE" or "côte".
function normalizeSearch(text) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

// A compact field showing the current choice; tapping it opens a sheet with
// a search box over the options — instead of laying every choice out as
// chips. options: [{ value, label, icon?, group? }] (`group` headings show
// while nothing is typed). allowCustom: a typed value with no match can be
// used as is (e.g. a town that isn't listed).
function SearchSelect({
  id,
  value,
  options,
  onSelect,
  title,
  placeholder = 'Choisir',
  searchPlaceholder = 'Rechercher…',
  allowCustom = false,
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <>
      <button
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        className={`${inputClass} flex items-center gap-2 text-left`}
        aria-haspopup="dialog"
      >
        {selected?.icon}
        <span className={`min-w-0 flex-1 truncate ${selected || value ? '' : 'text-ink-soft/50'}`}>
          {selected?.label || value || placeholder}
        </span>
        <ChevronDown size={16} className="shrink-0 text-ink-soft/50" />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <SearchSheet
              title={title}
              value={value}
              options={options}
              searchPlaceholder={searchPlaceholder}
              allowCustom={allowCustom}
              onClose={() => setOpen(false)}
              onSelect={(v) => {
                onSelect(v)
                setOpen(false)
              }}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

function SearchSheet({ title, value, options, searchPlaceholder, allowCustom, onClose, onSelect }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const q = normalizeSearch(query)

  useEffect(() => {
    // Focus once the sheet is in place: on iOS an early focus scrolls the page.
    const timer = setTimeout(() => inputRef.current?.focus(), 150)
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Names starting with what's typed come first ("ga": Gabon before Sénégal).
  const matches = useMemo(() => {
    if (!q) return options
    const found = options.filter((o) => normalizeSearch(o.label).includes(q))
    const starts = (o) => normalizeSearch(o.label).startsWith(q)
    return [...found.filter(starts), ...found.filter((o) => !starts(o))]
  }, [options, q])
  const custom = allowCustom && query.trim() && !matches.some((o) => normalizeSearch(o.label) === q)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-label={title}
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[85svh] w-full max-w-md flex-col sm:h-[min(36rem,80svh)] rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] text-ink shadow-2xl dark:bg-surface-tint sm:rounded-3xl"
      >
        <div className="flex items-center gap-2 px-5 pb-2 pt-4">
          <p className="flex-1 font-display text-lg font-semibold">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink/70 transition hover:bg-ink/5"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft/50" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className={`${inputClass} pl-10`}
              enterKeyHint="done"
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                if (matches.length === 1) onSelect(matches[0].value)
                else if (custom) onSelect(query.trim())
              }}
            />
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
          {custom && (
            <li>
              <button
                type="button"
                onClick={() => onSelect(query.trim())}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-violet-600 transition hover:bg-ink/5"
              >
                Utiliser « {query.trim()} »
              </button>
            </li>
          )}
          {matches.map((o, i) => {
            const heading = !q && o.group && o.group !== matches[i - 1]?.group
            return (
              <li key={o.value} className="[contain-intrinsic-size:auto_48px] [content-visibility:auto]">
                {heading && (
                  <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-soft/50">
                    {o.group}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => onSelect(o.value)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition hover:bg-ink/5 ${
                    o.value === value ? 'bg-violet-500/10 font-semibold text-violet-700 dark:text-violet-300' : ''
                  }`}
                >
                  {o.icon}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.value === value && <Check size={16} className="shrink-0" />}
                </button>
              </li>
            )
          })}
          {!matches.length && !custom && (
            <li className="px-3 py-8 text-center text-sm text-ink-soft/60">Aucun résultat pour « {query.trim()} »</li>
          )}
        </ul>
      </motion.div>
    </motion.div>
  )
}

export default SearchSelect
