import { useState } from 'react'
import { AlertTriangle, BookOpen, Brain, CheckCircle2, ChevronDown, Download, FileSearch, GraduationCap, Info, Layers, PenLine, Target, Trash2 } from 'lucide-react'
import { BANDS } from '../../lib/eduCheckShared.js'
import { BandPill, Passage, Pill, ScoreBar } from './eduUi.jsx'

// One analysis: each dimension in its own card, never merged into a single
// score. A card opens its details: what was observed, why it was flagged,
// the passages in context, the limits.

const SOURCE_STATUS = {
  trouvee: { label: 'Trouvée', className: 'bg-mint-500/15 text-mint-600' },
  introuvable: { label: 'Introuvable', className: 'bg-coral-500/15 text-coral-600' },
  a_verifier: { label: 'À vérifier', className: 'bg-gold/20 text-[#7a5200] dark:text-gold' },
  incoherente: { label: 'Incohérente', className: 'bg-orange-500/15 text-orange-700 dark:text-orange-300' },
  indisponible: { label: 'Service indisponible', className: 'bg-ink/8 text-ink-soft' },
}

const ISSUE_TYPES = {
  orthographe_grammaire: 'Orthographe et grammaire',
  ponctuation: 'Ponctuation',
  typographie: 'Typographie',
  repetition: 'Répétitions',
  syntaxe: 'Syntaxe',
  clarte: 'Clarté',
}

function Limitations({ items }) {
  if (!items?.length) return null
  return (
    <div className="mt-3 rounded-xl bg-ink/[0.04] px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">Limites</p>
      <ul className="mt-1 space-y-1 text-xs text-ink-soft">
        {items.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  )
}

function Inconclusive({ reason }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-ink/[0.04] px-3 py-2 text-sm text-ink-soft">
      <Info size={16} className="mt-0.5 shrink-0" /> Analyse non concluante : {reason}
    </p>
  )
}

function AiDetails({ ai }) {
  if (ai.status !== 'ok') return <Inconclusive reason={ai.reason} />
  return (
    <div>
      <p className="text-sm text-ink">
        Indice de caractéristiques compatibles avec une assistance IA : <strong>{ai.score}/100</strong> — fiabilité {ai.reliability}.
      </p>
      <p className="mt-1 text-xs text-ink-soft">Indicateur heuristique, et non une probabilité. Chaque élément ci-dessous est un indice, jamais une preuve.</p>
      {ai.observations.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Éléments observés</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-ink">
            {ai.observations.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 space-y-3">
        {ai.signals.map((s) => (
          <details key={s.key} className="group rounded-2xl border border-ink/8 bg-surface p-3" open={s.value >= 50}>
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{s.label}</span>
              <span className="w-24"><ScoreBar value={s.value} tone={s.value >= 60 ? 'coral' : s.value >= 40 ? 'gold' : 'mint'} /></span>
              <span className="w-9 text-right text-xs font-bold text-ink-soft">{s.value}</span>
              <ChevronDown size={16} className="text-ink-soft transition group-open:rotate-180" />
            </summary>
            <p className="mt-2 text-sm text-ink">{s.observed}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">{s.explanation}</p>
            {s.passages?.map((p, i) => (
              <Passage key={i} p={p} />
            ))}
          </details>
        ))}
      </div>
      <Limitations items={ai.limitations} />
    </div>
  )
}

function QualityDetails({ quality }) {
  const [all, setAll] = useState(false)
  if (quality.status !== 'ok') return <Inconclusive reason={quality.reason} />
  const issues = [...quality.issues].sort((a, b) => (a.severity === 'important' ? -1 : 0) - (b.severity === 'important' ? -1 : 0))
  const shown = all ? issues : issues.slice(0, 12)
  return (
    <div>
      <p className="text-sm text-ink">
        {quality.stats.words} mots · {quality.stats.sentences} phrases · {quality.stats.paragraphs} paragraphes · {quality.stats.averageSentence} mots par phrase.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {Object.entries(quality.counts).map(([type, n]) => (
          <Pill key={type} className="bg-ink/8 text-ink-soft">
            {ISSUE_TYPES[type] || type} : {n}
          </Pill>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink">{quality.argumentation}</p>
      {quality.paragraphNotes.map((n) => (
        <p key={n} className="mt-1 text-sm text-ink">• {n}</p>
      ))}
      {shown.length > 0 && (
        <ul className="mt-3 space-y-2">
          {shown.map((i, k) => (
            <li key={k} className="rounded-xl border border-ink/8 bg-surface p-2.5">
              <p className={`text-[13px] font-semibold ${i.severity === 'important' ? 'text-coral-600' : 'text-ink'}`}>{i.message}</p>
              <Passage p={i} />
            </li>
          ))}
        </ul>
      )}
      {issues.length > 12 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-xs font-bold text-violet-600">
          {all ? 'Voir moins' : `Voir les ${issues.length} remarques`}
        </button>
      )}
      <Limitations items={quality.limitations} />
    </div>
  )
}

function SourcesDetails({ sources }) {
  return (
    <div>
      <p className="text-sm text-ink">{sources.summary}</p>
      {sources.references.length > 0 && (
        <ul className="mt-3 space-y-2">
          {sources.references.map((ref, i) => {
            const st = SOURCE_STATUS[ref.verification?.status] || SOURCE_STATUS.a_verifier
            return (
              <li key={i} className="rounded-xl border border-ink/8 bg-surface p-2.5">
                <div className="flex items-start gap-2">
                  <Pill className={`${st.className} shrink-0`}>{st.label}</Pill>
                  <p className="min-w-0 break-words text-[13px] text-ink">{ref.raw}</p>
                </div>
                {ref.verification?.detail && <p className="mt-1 text-xs text-ink-soft">{ref.verification.detail}</p>}
                {ref.missing?.length > 0 && <p className="mt-0.5 text-xs text-[#7a5200] dark:text-gold">Manque : {ref.missing.join(', ')}</p>}
              </li>
            )
          })}
        </ul>
      )}
      {sources.issues.filter((i) => i.type !== 'reference_incomplete').length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">Points à examiner</p>
          <ul className="mt-1 space-y-2">
            {sources.issues
              .filter((i) => i.type !== 'reference_incomplete')
              .map((i, k) => (
                <li key={k} className="text-[13px] text-ink">
                  • {i.message}
                  {i.match && <Passage p={i} />}
                </li>
              ))}
          </ul>
        </div>
      )}
      <Limitations items={sources.limitations} />
    </div>
  )
}

function CoherenceDetails({ coherence }) {
  if (coherence.status !== 'ok') return <Inconclusive reason={coherence.reason} />
  return (
    <div>
      <ul className="space-y-2">
        {coherence.findings.map((f) => (
          <li key={f.key} className="rounded-xl border border-ink/8 bg-surface p-2.5">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              {f.level === 'attention' ? <AlertTriangle size={14} className="text-orange-500" /> : f.level === 'ok' ? <CheckCircle2 size={14} className="text-mint-500" /> : <Info size={14} className="text-sky-500" />}
              {f.title}
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">{f.detail}</p>
            {f.passages?.map((p, i) => (
              <Passage key={i} p={p} />
            ))}
          </li>
        ))}
      </ul>
      <Limitations items={coherence.limitations} />
    </div>
  )
}

function StyleDetails({ style }) {
  if (style.status !== 'ok') return <Inconclusive reason={style.reason} />
  return (
    <div>
      <p className="text-sm text-ink">
        Similarité avec {style.priorCount} travail{style.priorCount > 1 ? 'x' : ''} antérieur{style.priorCount > 1 ? 's' : ''} : <strong>{style.similarity}/100</strong>.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-ink-soft">
            <tr>
              <th className="py-1 pr-2 font-semibold">Habitude</th>
              <th className="py-1 pr-2 font-semibold">Avant</th>
              <th className="py-1 pr-2 font-semibold">Ce devoir</th>
              <th className="py-1 font-semibold">Écart</th>
            </tr>
          </thead>
          <tbody>
            {style.changes.map((c) => (
              <tr key={c.key} className="border-t border-ink/8 text-ink">
                <td className="py-1.5 pr-2">{c.label}</td>
                <td className="py-1.5 pr-2">{c.before}</td>
                <td className="py-1.5 pr-2">{c.now}</td>
                <td className={`py-1.5 font-bold ${Math.abs(c.change) >= 40 ? 'text-orange-600' : 'text-ink-soft'}`}>
                  {c.change > 0 ? '+' : ''}
                  {c.change} %
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {style.newVocabulary?.length > 0 && <p className="mt-2 text-xs text-ink-soft">Vocabulaire nouveau : {style.newVocabulary.join(', ')}</p>}
      <Limitations items={style.limitations} />
    </div>
  )
}

function LevelDetails({ level }) {
  if (level.status !== 'ok') return <Inconclusive reason={level.reason} />
  const verdict = { conforme: ['Dans les repères', 'text-mint-600'], en_dessous: ['En dessous', 'text-orange-600'], au_dessus: ['Au-dessus', 'text-sky-600'] }
  return (
    <div>
      <p className="text-sm text-ink">{level.summary}</p>
      <ul className="mt-2 space-y-1.5">
        {level.criteria.map((c) => (
          <li key={c.label} className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
            <span className="text-ink">
              {c.label} <span className="text-ink-soft">({c.value})</span>
            </span>
            <span className={`font-bold ${verdict[c.verdict][1]}`}>{verdict[c.verdict][0]}</span>
            {c.note && <span className="w-full text-xs text-ink-soft">{c.note}</span>}
          </li>
        ))}
      </ul>
      <Limitations items={level.limitations} />
    </div>
  )
}

const tone = (score) => (score >= 80 ? 'mint' : score >= 60 ? 'gold' : 'coral')

function AnalysisResult({ analysis, onDownload, onDelete, downloading }) {
  const r = analysis.result
  const [open, setOpen] = useState(r?.ai ? 'ai' : null)
  if (!r) return null
  const meta = analysis.meta || {}

  const cards = [
    r.ai && {
      key: 'ai',
      icon: Brain,
      title: 'Indice de rédaction assistée par IA',
      value: r.ai.status === 'ok' ? `${r.ai.score}/100` : 'Non concluant',
      extra: r.ai.status === 'ok' ? <BandPill band={r.ai.band} /> : <BandPill band="non_concluant" />,
      bar: r.ai.status === 'ok' ? <ScoreBar value={r.ai.score} tone={r.ai.score > 60 ? 'coral' : r.ai.score > 40 ? 'gold' : 'mint'} /> : null,
      body: <AiDetails ai={r.ai} />,
    },
    r.quality && {
      key: 'quality',
      icon: PenLine,
      title: 'Qualité rédactionnelle',
      value: r.quality.status === 'ok' ? `${r.quality.score}/100` : 'Non concluant',
      extra: r.quality.status === 'ok' ? <span className="text-xs text-ink-soft">{r.quality.label}</span> : null,
      bar: r.quality.status === 'ok' ? <ScoreBar value={r.quality.score} tone={tone(r.quality.score)} /> : null,
      body: <QualityDetails quality={r.quality} />,
    },
    r.coherence && {
      key: 'coherence',
      icon: Layers,
      title: 'Cohérence du contenu',
      value: r.coherence.status === 'ok' ? `${r.coherence.score}/100` : 'Non concluant',
      extra: r.coherence.status === 'ok' ? <span className="text-xs text-ink-soft">{r.coherence.label}</span> : null,
      bar: r.coherence.status === 'ok' ? <ScoreBar value={r.coherence.score} tone={tone(r.coherence.score)} /> : null,
      body: <CoherenceDetails coherence={r.coherence} />,
    },
    r.coherence?.status === 'ok' && {
      key: 'topic',
      icon: Target,
      title: 'Respect du sujet',
      value: r.coherence.topic ? `${r.coherence.topic.coverage} %` : 'Sujet non renseigné',
      extra: r.coherence.topic ? <span className="text-xs text-ink-soft">{r.coherence.topic.covered}/{r.coherence.topic.keyWords} mots clés du sujet</span> : null,
      bar: r.coherence.topic ? <ScoreBar value={r.coherence.topic.coverage} tone={tone(r.coherence.topic.coverage)} /> : null,
      body: <CoherenceDetails coherence={{ ...r.coherence, findings: r.coherence.findings.filter((f) => f.key === 'topic' || f.key === 'off_topic') }} />,
    },
    r.sources && {
      key: 'sources',
      icon: FileSearch,
      title: 'Vérification des sources',
      value: `${r.sources.references.length} réf.`,
      extra: <span className={`text-xs font-semibold ${r.sources.toVerify ? 'text-orange-600' : 'text-mint-600'}`}>{r.sources.toVerify ? `${r.sources.toVerify} point(s) à vérifier` : 'Rien à signaler'}</span>,
      body: <SourcesDetails sources={r.sources} />,
    },
    r.style && r.style.status !== 'not_requested' && {
      key: 'style',
      icon: BookOpen,
      title: 'Similarité avec les travaux antérieurs',
      value: r.style.status === 'ok' ? `${r.style.similarity}/100` : 'Non concluant',
      extra: r.style.status === 'ok' ? <span className="text-xs text-ink-soft">{r.style.label}</span> : null,
      bar: r.style.status === 'ok' ? <ScoreBar value={r.style.similarity} tone="sky" /> : null,
      body: <StyleDetails style={r.style} />,
    },
    r.academicLevel && r.academicLevel.status !== 'not_requested' && {
      key: 'level',
      icon: GraduationCap,
      title: `Niveau académique${r.academicLevel.levelLabel ? ` · ${r.academicLevel.levelLabel}` : ''}`,
      value: r.academicLevel.status === 'ok' ? `${r.academicLevel.criteria.filter((c) => c.verdict !== 'en_dessous').length}/${r.academicLevel.criteria.length}` : 'Non concluant',
      extra: r.academicLevel.status === 'ok' ? <span className="text-xs text-ink-soft">critères dans les repères</span> : null,
      body: <LevelDetails level={r.academicLevel} />,
    },
  ].filter(Boolean)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-ink">{meta.student || 'Devoir sans nom'}</h2>
          <p className="text-xs text-ink-soft">
            {[meta.className, meta.subject, meta.teacher, `${r.words} mots`, analysis.createdAt && new Date(analysis.createdAt).toLocaleDateString('fr-FR')].filter(Boolean).join(' · ')}
          </p>
          {meta.topic && <p className="mt-1 line-clamp-2 text-xs italic text-ink-soft">Sujet : {meta.topic}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={onDownload} disabled={downloading} className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60">
            <Download size={14} /> {downloading ? 'Préparation…' : 'Rapport PDF'}
          </button>
          {onDelete && (
            <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 rounded-full border border-ink/12 px-3 py-2 text-xs font-bold text-coral-600 hover:bg-coral-500/5" aria-label="Supprimer l’analyse">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* The disclaimer stays at the top of the page (pages/EduCheck.jsx) and in the PDF. */}
      {analysis.status === 'inconclusive' && <Inconclusive reason="les données sont insuffisantes pour conclure sur ce devoir (texte trop court, langue non prise en charge ou trop peu structuré)." />}

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon
          const isOpen = open === c.key
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setOpen(isOpen ? null : c.key)}
              aria-expanded={isOpen}
              className={`rounded-2xl border p-3.5 text-left transition ${isOpen ? 'border-violet-400 bg-violet-600/5' : 'border-ink/8 bg-surface hover:border-violet-300'}`}
            >
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
                <Icon size={15} className="text-violet-600" /> {c.title}
              </span>
              <span className="mt-1.5 flex flex-wrap items-baseline gap-2">
                <span className="font-display text-2xl font-black text-ink">{c.value}</span>
                {c.extra}
              </span>
              {c.bar && <span className="mt-2 block">{c.bar}</span>}
              <span className="mt-2 block text-[11px] font-semibold text-violet-600">{isOpen ? 'Masquer le détail' : 'Voir le détail'}</span>
            </button>
          )
        })}
      </div>

      {open && (
        <section className="rounded-3xl border border-ink/8 bg-surface-soft p-4" aria-live="polite">
          <h3 className="mb-3 font-display text-base font-bold text-ink">{cards.find((c) => c.key === open)?.title}</h3>
          {cards.find((c) => c.key === open)?.body}
        </section>
      )}

      <section className="rounded-3xl border border-ink/8 bg-surface p-4">
        <h3 className="font-display text-base font-bold text-ink">Recommandations pédagogiques</h3>
        <ul className="mt-2 space-y-1.5 text-sm text-ink">
          {r.recommendations.map((x) => (
            <li key={x}>• {x}</li>
          ))}
        </ul>
        {r.attention?.length > 0 && <p className="mt-2 text-xs font-semibold text-orange-600">Attention pédagogique : {r.attention.join(', ')}.</p>}
      </section>

      <p className="text-[11px] text-ink-soft">
        Repères de l’indice : {Object.entries(BANDS).filter(([k]) => k !== 'non_concluant').map(([, b]) => `${b.range} ${b.label.toLowerCase()}`).join(' · ')}. Analyse locale, sans modèle d’IA ni service payant.
      </p>
    </div>
  )
}

export default AnalysisResult
