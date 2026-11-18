import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Loader2, Search } from 'lucide-react'
import { deleteAnalysis, fetchAnalyses, fetchAnalysis, fetchDashboard } from '../../firebase/eduCheck.js'
import { downloadEduCheckPdf } from '../../lib/eduCheckPdf.js'
import { useToast } from '../../context/ToastContext.jsx'
import { inputClass } from '../../lib/formStyles.js'
import AnalysisResult from './AnalysisResult.jsx'
import { BandPill } from './eduUi.jsx'
import { BANDS } from '../../lib/eduCheckShared.js'

// Historique et tableau de bord: only what this account may see (its own
// analyses; a lead also sees their institution's).

const STATUS = { pending: 'En attente', running: 'En cours', done: 'Terminé', inconclusive: 'Non concluant', failed: 'Échec' }
const EMPTY = { student: '', className: '', subject: '', teacher: '', from: '', to: '', band: '' }

function Stat({ value, label, tone = 'text-ink' }) {
  return (
    <div className="rounded-2xl border border-ink/8 bg-surface p-3">
      <p className={`font-display text-2xl font-black ${tone}`}>{value}</p>
      <p className="text-xs text-ink-soft">{label}</p>
    </div>
  )
}

function HistoryPanel({ config }) {
  const { showToast } = useToast()
  const [filters, setFilters] = useState(EMPTY)
  const [list, setList] = useState(null)
  const [dash, setDash] = useState(null)
  const [open, setOpen] = useState(null)
  const [loadingId, setLoadingId] = useState(null)
  const [downloading, setDownloading] = useState(false)

  const load = useCallback(
    async (f) => {
      try {
        const [a, d] = await Promise.all([fetchAnalyses(f), fetchDashboard()])
        setList(a)
        setDash(d)
      } catch (err) {
        showToast(err.message, 'error')
      }
    },
    [showToast],
  )

  useEffect(() => {
    load(EMPTY)
  }, [load])

  async function show(id) {
    setLoadingId(id)
    try {
      setOpen(await fetchAnalysis(id))
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoadingId(null)
    }
  }

  async function remove() {
    if (!window.confirm('Supprimer définitivement cette analyse et le texte du devoir ?')) return
    try {
      await deleteAnalysis(open.id)
      showToast('Analyse supprimée.', 'success')
      setOpen(null)
      load(filters)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function download() {
    setDownloading(true)
    try {
      await downloadEduCheckPdf(open, { disclaimer: config.disclaimer })
    } catch {
      showToast('Impossible de créer le PDF.', 'error')
    } finally {
      setDownloading(false)
    }
  }

  if (open) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setOpen(null)} className="inline-flex items-center gap-1.5 text-sm font-bold text-violet-600">
          <ArrowLeft size={16} /> Retour à l’historique
        </button>
        {open.result ? (
          <AnalysisResult analysis={open} onDownload={download} onDelete={remove} downloading={downloading} />
        ) : (
          <p className="text-sm text-ink-soft">{open.status === 'failed' ? open.error || 'Cette analyse a échoué.' : 'Analyse encore en cours : revenez dans un instant.'}</p>
        )}
      </div>
    )
  }

  const set = (field) => (e) => setFilters((f) => ({ ...f, [field]: e.target.value }))
  const top = Math.max(1, ...(dash?.monthly || []).map((m) => m.count))

  return (
    <div className="space-y-5">
      {dash && (
        <section>
          <h2 className="mb-2 font-display text-base font-bold text-ink">
            Tableau de bord <span className="text-xs font-normal text-ink-soft">({dash.scope === 'etablissement' ? 'votre établissement' : 'vos analyses'})</span>
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat value={dash.analysed} label="Devoirs analysés" />
            <Stat value={dash.conclusive} label="Analyses concluantes" tone="text-mint-600" />
            <Stat value={dash.sourcesToVerify} label="Sources à vérifier" tone="text-orange-600" />
            <Stat value={dash.attention} label="Attention pédagogique" tone="text-coral-600" />
          </div>
          <div className="mt-3 rounded-2xl border border-ink/8 bg-surface p-3">
            <p className="text-xs font-semibold text-ink-soft">Évolution mensuelle</p>
            <div className="mt-2 flex h-24 items-end gap-2">
              {dash.monthly.map((m) => (
                <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-ink-soft">{m.count || ''}</span>
                  <div className="w-full rounded-t-lg bg-violet-600/80" style={{ height: `${Math.max(3, (m.count / top) * 64)}px` }} />
                  <span className="text-[10px] text-ink-soft">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-display text-base font-bold text-ink">Historique</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            load(filters)
          }}
          className="grid gap-2 sm:grid-cols-4"
        >
          {[
            ['student', 'Étudiant'],
            ['className', 'Classe'],
            ['subject', 'Matière'],
            ['teacher', 'Enseignant'],
          ].map(([f, label]) => (
            <input key={f} value={filters[f]} onChange={set(f)} placeholder={label} aria-label={label} className={inputClass} />
          ))}
          <input type="date" value={filters.from} onChange={set('from')} aria-label="Depuis le" className={inputClass} />
          <input type="date" value={filters.to} onChange={set('to')} aria-label="Jusqu’au" className={inputClass} />
          <select value={filters.band} onChange={set('band')} aria-label="Niveau d’indice" className={inputClass}>
            <option value="">Tous les indices</option>
            {Object.entries(BANDS).map(([k, b]) => (
              <option key={k} value={k}>
                {b.label} {b.range && `(${b.range})`}
              </option>
            ))}
          </select>
          <button type="submit" className="inline-flex items-center justify-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white">
            <Search size={15} /> Filtrer
          </button>
        </form>

        {!list && <p className="mt-4 text-sm text-ink-soft">Chargement…</p>}
        {list && !list.analyses.length && <p className="mt-4 text-sm text-ink-soft">Aucune analyse pour le moment.</p>}
        {list?.analyses.length > 0 && (
          <ul className="mt-3 divide-y divide-ink/8 rounded-3xl border border-ink/8 bg-surface">
            {list.analyses.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => show(a.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-ink/[0.03]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{a.meta.student || 'Devoir sans nom'}</span>
                    <span className="block truncate text-xs text-ink-soft">
                      {[a.meta.className, a.meta.subject, a.meta.teacher, a.createdAt && new Date(a.createdAt).toLocaleDateString('fr-FR')].filter(Boolean).join(' · ')}
                      {!a.mine && ' · autre enseignant'}
                    </span>
                  </span>
                  {loadingId === a.id ? (
                    <Loader2 size={16} className="animate-spin text-violet-600" />
                  ) : a.summary?.aiBand ? (
                    <span className="flex flex-wrap items-center gap-2">
                      {['elevee', 'moderee'].includes(a.summary.provenance) && (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${a.summary.provenance === 'elevee' ? 'bg-coral-500/15 text-coral-600' : 'bg-gold/20 text-[#7a5200] dark:text-gold'}`}>Preuve de provenance</span>
                      )}
                      {['elevee', 'moderee'].includes(a.summary.mlBand) && <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[11px] font-bold text-orange-700 dark:text-orange-300">Estimation ML {a.summary.mlBand === 'elevee' ? 'élevée' : 'modérée'}</span>}
                      {a.summary.aiScore != null && <span className="text-xs font-bold text-ink">Style {a.summary.aiScore}/100</span>}
                      <BandPill band={a.summary.aiBand} />
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-ink-soft">{STATUS[a.status]}</span>
                  )}
                  {a.summary?.sourcesToVerify > 0 && <span className="text-xs font-semibold text-orange-600">{a.summary.sourcesToVerify} source(s) à vérifier</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-ink-soft">Les analyses et le texte des devoirs sont supprimés automatiquement après {config.limits.retentionDays} jours.</p>
      </section>
    </div>
  )
}

export default HistoryPanel
