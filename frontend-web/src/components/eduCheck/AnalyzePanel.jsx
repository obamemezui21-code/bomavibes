import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Circle, Loader2, MinusCircle, Plus, Play, X, XCircle } from 'lucide-react'
import { deleteAnalysis, fetchAnalysis, startAnalysis } from '../../firebase/eduCheck.js'
import { downloadEduCheckPdf } from '../../lib/eduCheckPdf.js'
import { useToast } from '../../context/ToastContext.jsx'
import { inputClass, labelClass } from '../../lib/formStyles.js'
import AnalysisResult from './AnalysisResult.jsx'
import { Console } from './resultUi.jsx'
import { TextSource } from './eduUi.jsx'
import { countWords } from '../../lib/eduCheckShared.js'

// Analyser un devoir: 1. the text, 2. who and what, 3. the analyses, then
// the steps as the server runs them, then the results.

const CHECK_OPTIONS = [
  { key: 'ai', label: 'Détection IA · 3 moteurs', hint: 'Preuves de provenance, estimation par modèle de langage, analyse stylistique : trois résultats séparés.' },
  { key: 'quality', label: 'Qualité rédactionnelle', hint: 'Ponctuation, fautes fréquentes, phrases, paragraphes, argumentation.' },
  { key: 'sources', label: 'Vérification des sources', hint: 'Références, citations, recherche dans Crossref et OpenAlex.' },
  { key: 'coherence', label: 'Cohérence et respect du sujet', hint: 'Sujet, introduction et conclusion, répétitions, exemples.' },
  { key: 'level', label: 'Niveau académique', hint: 'Comparé aux repères du niveau choisi.' },
  { key: 'style', label: 'Comparaison avec des travaux antérieurs', hint: 'Si vous ajoutez d’anciens devoirs du même étudiant.' },
]

const STEP_STATUS = {
  pending: { label: 'En attente', icon: Circle, className: 'text-white/35' },
  running: { label: 'En cours', icon: Loader2, className: 'text-[#d9a6ff]', spin: true },
  done: { label: 'Terminé', icon: CheckCircle2, className: 'text-[#2fd083]' },
  failed: { label: 'Échec', icon: XCircle, className: 'text-[#ff6b5e]' },
  inconclusive: { label: 'Non concluant', icon: MinusCircle, className: 'text-[#ffc83d]' },
}

const POLL_MS = 900
const today = () => new Date().toISOString().slice(0, 10)

const EMPTY_META = { establishment: '', student: '', className: '', subject: '', teacher: '', topic: '', level: 'premiere_annee', levelLabel: '', submittedAt: today() }

function Steps({ steps }) {
  const done = steps.filter((s) => s.status !== 'pending' && s.status !== 'running').length
  return (
    <div>
      <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-[#7b1fa2] via-[#d3187f] to-[#ffc83d] transition-all duration-700" style={{ width: `${Math.max(6, (done / Math.max(1, steps.length)) * 100)}%` }} />
      </div>
      <ol className="space-y-1.5">
        {steps.map((s, i) => {
          const st = STEP_STATUS[s.status] || STEP_STATUS.pending
          const Icon = st.icon
          return (
            <li key={s.key} className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition ${s.status === 'running' ? 'border-[#ad52ec]/50 bg-[#ad52ec]/10' : 'border-white/8 bg-white/[.03]'}`}>
              <span className="w-6 font-mono text-[11px] text-white/35">{String(i + 1).padStart(2, '0')}</span>
              <Icon size={17} className={`${st.className} ${st.spin ? 'animate-spin' : ''}`} />
              <span className="min-w-0 flex-1 text-sm font-medium text-white/90">{s.label}</span>
              <span className={`font-mono text-[11px] font-bold uppercase tracking-wider ${st.className}`}>{st.label}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function AnalyzePanel({ config, onOpenHistory }) {
  const { showToast } = useToast()
  const [text, setText] = useState('')
  const [meta, setMeta] = useState(EMPTY_META)
  const [checks, setChecks] = useState(['ai', 'quality', 'sources', 'coherence', 'level'])
  const [priors, setPriors] = useState([])
  const [isgenai, setIsgenai] = useState(false)
  const [phase, setPhase] = useState('form') // form | running | result
  const [analysis, setAnalysis] = useState(null)
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const pollRef = useRef(null)
  const { limits, levels } = config

  useEffect(() => () => clearTimeout(pollRef.current), [])

  const set = (field) => (e) => setMeta((m) => ({ ...m, [field]: e.target.value }))
  const toggle = (key) => setChecks((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]))
  const words = countWords(text)
  const usablePriors = priors.filter((p) => p.trim())

  function poll(id) {
    pollRef.current = setTimeout(async () => {
      try {
        const a = await fetchAnalysis(id)
        setAnalysis(a)
        if (a.status === 'done' || a.status === 'inconclusive') {
          setPhase('result')
          return
        }
        if (a.status === 'failed') {
          showToast(a.error || 'L’analyse a échoué.', 'error')
          return
        }
        poll(id)
      } catch (err) {
        showToast(err.message, 'error')
      }
    }, POLL_MS)
  }

  async function launch() {
    if (!words) return showToast('Ajoutez le texte du devoir.', 'error')
    if (words > limits.maxWords) return showToast(`Le texte dépasse ${limits.maxWords} mots.`, 'error')
    if (!checks.length) return showToast('Choisissez au moins une analyse.', 'error')
    const wanted = checks.filter((c) => c !== 'style' || usablePriors.length)
    setBusy(true)
    try {
      const { id } = await startAnalysis({
        text,
        meta: { ...meta, levelLabel: meta.level === 'autre' ? meta.levelLabel : '' },
        checks: wanted.length ? wanted : ['quality'],
        priorTexts: checks.includes('style') || checks.includes('ai') ? usablePriors : [],
        options: { isgenai: checks.includes('ai') && isgenai },
      })
      setAnalysis({ id, status: 'pending', steps: [] })
      setPhase('running')
      poll(id)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function download() {
    setDownloading(true)
    try {
      await downloadEduCheckPdf(analysis, { disclaimer: config.disclaimer })
    } catch {
      showToast('Impossible de créer le PDF.', 'error')
    } finally {
      setDownloading(false)
    }
  }

  async function remove() {
    if (!window.confirm('Supprimer définitivement cette analyse et le texte du devoir ?')) return
    try {
      await deleteAnalysis(analysis.id)
      showToast('Analyse supprimée.', 'success')
      reset()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  function reset() {
    clearTimeout(pollRef.current)
    setPhase('form')
    setAnalysis(null)
    setText('')
    setPriors([])
    setMeta((m) => ({ ...EMPTY_META, establishment: m.establishment, teacher: m.teacher, className: m.className, subject: m.subject, level: m.level }))
  }

  if (phase === 'running') {
    const failed = analysis?.status === 'failed'
    return (
      <Console className="mx-auto max-w-xl">
        <div className="space-y-4 p-5 sm:p-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[.2em] text-[#d9a6ff]">EDU-CHECK · analyse</p>
            <h2 className="mt-1 font-display text-xl font-black text-white">{failed ? 'L’analyse a échoué' : 'Analyse en cours…'}</h2>
            <p className="mt-1 text-xs text-white/50">Chaque étape s’affiche au moment où le serveur la termine.</p>
          </div>
          <Steps steps={analysis?.steps?.length ? analysis.steps : [{ key: 'prepare', label: 'Envoi du devoir', status: 'running' }]} />
          {failed && (
            <button type="button" onClick={() => setPhase('form')} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#2b1a2c]">
              Revenir au formulaire
            </button>
          )}
        </div>
      </Console>
    )
  }

  if (phase === 'result' && analysis) {
    return (
      <div className="space-y-4">
        <AnalysisResult analysis={analysis} onDownload={download} onDelete={remove} downloading={downloading} />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={reset} className="rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white">
            Analyser un autre devoir
          </button>
          <button type="button" onClick={onOpenHistory} className="rounded-full border border-ink/12 px-4 py-2 text-sm font-bold text-ink">
            Voir l’historique
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-display text-base font-bold text-ink">1. Le devoir</h2>
        <p className="mb-2 text-xs text-ink-soft">
          PDF, DOCX ou TXT jusqu’à {limits.maxFileMb} Mo, ou texte collé ({limits.maxWords.toLocaleString('fr-FR')} mots maximum ; au moins {limits.minWords} pour les indices de style). Le fichier n’est pas conservé.
        </p>
        <TextSource value={text} onChange={setText} maxWords={limits.maxWords} rows={10} />
      </section>

      <section>
        <h2 className="mb-2 font-display text-base font-bold text-ink">2. Informations</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['student', 'Étudiant', 'Nom de l’étudiant'],
            ['className', 'Classe', 'Ex. Terminale A1'],
            ['subject', 'Matière', 'Ex. Philosophie'],
            ['teacher', 'Enseignant', 'Votre nom'],
            ['establishment', 'Établissement', 'Nom de l’établissement'],
          ].map(([field, label, placeholder]) => (
            <label key={field} className="block">
              <span className={labelClass}>{label}</span>
              <input value={meta[field]} onChange={set(field)} placeholder={placeholder} maxLength={120} className={inputClass} />
            </label>
          ))}
          <label className="block">
            <span className={labelClass}>Date de soumission</span>
            <input type="date" value={meta.submittedAt} onChange={set('submittedAt')} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Niveau</span>
            <select value={meta.level} onChange={set('level')} className={inputClass}>
              {Object.entries(levels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {meta.level === 'autre' && (
            <label className="block">
              <span className={labelClass}>Précisez le niveau</span>
              <input value={meta.levelLabel} onChange={set('levelLabel')} maxLength={60} placeholder="Ex. BTS 2e année" className={inputClass} />
            </label>
          )}
          <label className="block sm:col-span-2">
            <span className={labelClass}>Sujet (la consigne)</span>
            <textarea value={meta.topic} onChange={set('topic')} rows={2} maxLength={2000} placeholder="Copiez le sujet donné aux étudiants : il sert à vérifier que le devoir y répond." className={inputClass} />
          </label>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-display text-base font-bold text-ink">3. Analyses souhaitées</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {CHECK_OPTIONS.map((o) => (
            <label key={o.key} className={`flex cursor-pointer items-start gap-2.5 rounded-2xl border p-3 transition ${checks.includes(o.key) ? 'border-violet-400 bg-violet-600/5' : 'border-ink/10 bg-surface'}`}>
              <input type="checkbox" checked={checks.includes(o.key)} onChange={() => toggle(o.key)} className="mt-0.5 h-4 w-4 accent-violet-600" />
              <span>
                <span className="block text-sm font-semibold text-ink">{o.label}</span>
                <span className="block text-xs text-ink-soft">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {checks.includes('ai') && config.isgenai && (
          <label className={`mt-3 flex cursor-pointer items-start gap-2.5 rounded-2xl border p-3 transition ${isgenai ? 'border-violet-400 bg-violet-600/5' : 'border-ink/10 bg-surface'}`}>
            <input type="checkbox" checked={isgenai} onChange={(e) => setIsgenai(e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-600" />
            <span>
              <span className="block text-sm font-semibold text-ink">Demander aussi l’avis d’isGenAI (service externe gratuit)</span>
              <span className="block text-xs text-ink-soft">
                Cherche les déclarations d’usage d’une IA et les noms d’outils. Le texte (16 000 premiers caractères) est envoyé à isgenai.com en mode privé, sans reçu public ; isGenAI indique pouvoir le transmettre à son prestataire (DeepSeek). Sans cette case, le texte du devoir ne quitte pas le serveur.
              </span>
            </span>
          </label>
        )}

        {(checks.includes('style') || checks.includes('ai')) && (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-semibold text-ink">
              Travaux antérieurs du même étudiant <span className="font-normal text-ink-soft">(facultatif, jusqu’à {limits.maxPriorTexts} ; utilisés pour cette analyse seulement, jamais conservés)</span>
            </p>
            {priors.map((p, i) => (
              <div key={i} className="relative">
                <TextSource value={p} onChange={(v) => setPriors((list) => list.map((x, k) => (k === i ? v : x)))} rows={4} compact placeholder={`Travail antérieur n° ${i + 1}`} />
                <button type="button" onClick={() => setPriors((list) => list.filter((_, k) => k !== i))} className="absolute right-2 top-2 rounded-full bg-surface p-1 text-ink-soft shadow" aria-label="Retirer ce travail">
                  <X size={14} />
                </button>
              </div>
            ))}
            {priors.length < limits.maxPriorTexts && (
              <button type="button" onClick={() => setPriors((list) => [...list, ''])} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-violet-400 px-3 py-1.5 text-xs font-bold text-violet-600">
                <Plus size={14} /> Ajouter un travail antérieur
              </button>
            )}
            {checks.includes('style') && !usablePriors.length && <p className="text-xs text-ink-soft">Sans travail antérieur, la comparaison stylistique ne sera pas faite.</p>}
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={launch}
        disabled={busy || !words}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-brand py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/20 disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Lancer l’analyse
      </button>
    </div>
  )
}

export default AnalyzePanel
