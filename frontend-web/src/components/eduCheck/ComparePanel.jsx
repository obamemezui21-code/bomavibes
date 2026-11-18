import { useState } from 'react'
import { GitCompare, Loader2, Plus, X } from 'lucide-react'
import { compareHomework } from '../../firebase/eduCheck.js'
import { useToast } from '../../context/ToastContext.jsx'
import { inputClass } from '../../lib/formStyles.js'
import { Disclaimer, TextSource } from './eduUi.jsx'

// Comparer plusieurs devoirs: two works of a student, two versions of a
// homework, or one homework against earlier works. Style, vocabulary,
// structure side by side; nothing is stored.

const COLORS = ['bg-violet-600', 'bg-pink-500', 'bg-sky-500', 'bg-gold', 'bg-mint-500']

function ComparePanel({ config }) {
  const { showToast } = useToast()
  const [texts, setTexts] = useState([
    { label: 'Devoir 1', text: '' },
    { label: 'Devoir 2', text: '' },
  ])
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const max = config.limits.maxCompareTexts

  const update = (i, patch) => setTexts((list) => list.map((t, k) => (k === i ? { ...t, ...patch } : t)))

  async function run() {
    const filled = texts.filter((t) => t.text.trim())
    if (filled.length < 2) return showToast('Ajoutez au moins deux textes.', 'error')
    setBusy(true)
    try {
      setResult(await compareHomework(filled.map((t, i) => ({ label: t.label.trim() || `Texte ${i + 1}`, text: t.text }))))
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-soft">
        Comparez deux devoirs du même étudiant, deux versions d’un devoir, ou un devoir avec plusieurs travaux antérieurs. Les textes ne sont pas conservés.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {texts.map((t, i) => (
          <div key={i} className="relative rounded-3xl border border-ink/8 bg-surface p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className={`h-3 w-3 shrink-0 rounded-full ${COLORS[i]}`} />
              <input value={t.label} onChange={(e) => update(i, { label: e.target.value })} maxLength={60} className={`${inputClass} !py-1.5`} aria-label={`Nom du texte ${i + 1}`} />
              {texts.length > 2 && (
                <button type="button" onClick={() => setTexts((list) => list.filter((_, k) => k !== i))} className="rounded-full p-1 text-ink-soft hover:bg-ink/5" aria-label="Retirer ce texte">
                  <X size={16} />
                </button>
              )}
            </div>
            <TextSource value={t.text} onChange={(v) => update(i, { text: v })} rows={6} compact maxWords={config.limits.maxWords} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {texts.length < max && (
          <button type="button" onClick={() => setTexts((list) => [...list, { label: `Devoir ${list.length + 1}`, text: '' }])} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-violet-400 px-3.5 py-2 text-xs font-bold text-violet-600">
            <Plus size={14} /> Ajouter un texte
          </button>
        )}
        <button type="button" onClick={run} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-60">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <GitCompare size={16} />} Comparer
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          <Disclaimer text="Comparaison statistique du style : des textes proches peuvent avoir des auteurs différents, et l’inverse. Les écarts appellent un échange, jamais une conclusion." />
          <section className="rounded-3xl border border-ink/8 bg-surface p-4">
            <h3 className="font-display text-base font-bold text-ink">Similarité stylistique</h3>
            <ul className="mt-2 space-y-3">
              {result.pairs.map((p) => (
                <li key={`${p.a}-${p.b}`}>
                  <p className="text-sm text-ink">
                    {p.a} ↔ {p.b} : <strong>{p.similarity}/100</strong>
                  </p>
                  {p.notable.length > 0 && <p className="text-xs text-orange-600">Écarts marqués : {p.notable.join(' · ')}</p>}
                  <p className="mt-1 text-xs text-ink-soft">
                    Vocabulaire commun : {p.sharedVocabulary.join(', ') || '—'}
                    {p.onlyA.length > 0 && ` · Seulement « ${p.a} » : ${p.onlyA.join(', ')}`}
                    {p.onlyB.length > 0 && ` · Seulement « ${p.b} » : ${p.onlyB.join(', ')}`}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* Simple comparative chart: each feature, one bar per text. */}
          <section className="rounded-3xl border border-ink/8 bg-surface p-4">
            <h3 className="font-display text-base font-bold text-ink">Style et structure</h3>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-soft">
              {result.labels.map((l, i) => (
                <span key={l} className="inline-flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${COLORS[i]}`} /> {l} ({result.structure[i].words} mots{result.structure[i].tooShort ? ', court' : ''})
                </span>
              ))}
            </div>
            <ul className="mt-3 space-y-3">
              {result.features.map((f) => {
                const top = Math.max(...f.values, 0.0001)
                return (
                  <li key={f.key}>
                    <p className="text-xs font-semibold text-ink">{f.label}</p>
                    <div className="mt-1 space-y-1">
                      {f.values.map((v, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink/8">
                            <div className={`h-full rounded-full ${COLORS[i]}`} style={{ width: `${Math.max(2, (v / top) * 100)}%` }} />
                          </div>
                          <span className="w-12 text-right text-xs text-ink-soft">{v}</span>
                        </div>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}

export default ComparePanel
