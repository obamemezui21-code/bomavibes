import { useRef, useState } from 'react'
import { FileUp, Loader2, X } from 'lucide-react'
import { parseHomeworkFile } from '../../firebase/eduCheck.js'
import { BANDS, countWords } from '../../lib/eduCheckShared.js'

// Small pieces shared by the EDU-CHECK screens (pages/EduCheck.jsx).

export function Pill({ className = '', children }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${className}`}>{children}</span>
}

export function BandPill({ band }) {
  const b = BANDS[band] || BANDS.non_concluant
  return <Pill className={b.className}>{b.label}</Pill>
}

// A 0–100 bar; `tone` picks its colour.
export function ScoreBar({ value, tone = 'violet' }) {
  const color = { violet: 'bg-violet-600', mint: 'bg-mint-500', gold: 'bg-gold', coral: 'bg-coral-500', sky: 'bg-sky-500' }[tone]
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink/8" role="presentation">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, value || 0))}%` }} />
    </div>
  )
}

// A passage of the homework with the flagged part highlighted.
export function Passage({ p }) {
  if (!p) return null
  return (
    <blockquote className="mt-1.5 rounded-xl border-l-2 border-violet-400 bg-ink/[0.03] px-3 py-2 text-[13px] leading-relaxed text-ink-soft">
      {p.before}
      <mark className="rounded bg-gold/30 px-0.5 text-ink">{p.match}</mark>
      {p.after}
    </blockquote>
  )
}

/**
 * A text the teacher pastes or imports (PDF, DOCX, TXT). The file is read by
 * the server and dropped: only its text comes back, shown here to check.
 */
export function TextSource({ value, onChange, label, placeholder, maxWords, rows = 8, compact = false }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const words = countWords(value)

  async function importFile(file) {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const parsed = await parseHomeworkFile(file)
      setFileName(file.name)
      onChange(parsed.text)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      {label && <p className="mb-1.5 text-sm font-semibold text-ink">{label}</p>}
      <div
        className="rounded-2xl border border-ink/12 bg-surface focus-within:border-violet-400"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          importFile(e.dataTransfer.files?.[0])
        }}
      >
        <textarea
          value={value}
          onChange={(e) => {
            setFileName('')
            onChange(e.target.value)
          }}
          rows={rows}
          placeholder={placeholder || 'Collez le texte ici, ou importez un fichier PDF, DOCX ou TXT.'}
          className="block w-full resize-y rounded-t-2xl bg-transparent px-3.5 py-3 text-sm text-ink outline-none placeholder:text-ink-soft/50"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/8 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-violet-600/10 px-3 py-1.5 text-xs font-bold text-violet-700 transition hover:bg-violet-600/15 disabled:opacity-60 dark:text-violet-300"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
              {busy ? 'Lecture…' : compact ? 'Fichier' : 'Importer PDF, DOCX, TXT'}
            </button>
            {fileName && <span className="truncate text-xs text-ink-soft">{fileName}</span>}
            {value && (
              <button type="button" onClick={() => onChange('')} className="rounded-full p-1 text-ink-soft hover:bg-ink/5" aria-label="Effacer le texte">
                <X size={14} />
              </button>
            )}
          </div>
          <span className={`text-xs font-semibold ${maxWords && words > maxWords ? 'text-coral-500' : 'text-ink-soft'}`}>
            {words.toLocaleString('fr-FR')} mot{words > 1 ? 's' : ''}
            {maxWords ? ` / ${maxWords.toLocaleString('fr-FR')} max` : ''}
          </span>
        </div>
        <input ref={inputRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-coral-500">{error}</p>}
    </div>
  )
}

export function Disclaimer({ text }) {
  return (
    <p role="note" className="rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-[13px] font-medium leading-relaxed text-[#6b4a00] dark:text-gold">
      {text}
    </p>
  )
}
