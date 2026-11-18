import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, BookOpen, CheckCircle2, ChevronDown, Cpu, Download, FileSearch, Fingerprint, GraduationCap, Info, Layers, PenLine, ScanText, ShieldCheck, Sparkles, Target, Trash2 } from 'lucide-react'
import { BANDS, LEVEL_TONES, scoreColor, styleLevel } from '../../lib/eduCheckShared.js'
import { Passage, Pill, ScoreBar } from './eduUi.jsx'
import { Console, Dot, EngineCard, MetricTile } from './resultUi.jsx'

// One analysis. The AI question has three separate answers, side by side on
// the console and never added up: A. evidence in the text (provenance),
// B. a language model's estimate, C. the style indices. The other dimensions
// follow, each in its own tile. A card or tile opens its details: what was
// observed, why, the passages, the engine, the limits.

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

const FINDING_KINDS = {
  declaration: { label: 'Déclaration', color: '#ff6b5e' },
  trace: { label: 'Trace d’outil', color: '#ff6b5e' },
  leftover: { label: 'Phrase d’assistant', color: '#ffc83d' },
}

const ENGINE_STATUS = {
  ok: { label: 'Utilisé', color: '#2fd083' },
  unavailable: { label: 'Indisponible', color: '#ffc83d' },
  not_requested: { label: 'Non demandé', color: '#8b8198' },
  off: { label: 'Désactivé', color: '#8b8198' },
}

const dateTime = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : null)

function Limitations({ items }) {
  if (!items?.length) return null
  return (
    <div className="mt-4 rounded-2xl border border-ink/8 bg-ink/[0.03] px-3.5 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">Limites de l’analyse</p>
      <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-ink-soft">
        {items.map((l) => (
          <li key={l} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-soft/60" />
            {l}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Inconclusive({ reason }) {
  return (
    <p className="flex items-start gap-2 rounded-2xl bg-ink/[0.04] px-3.5 py-2.5 text-sm text-ink-soft">
      <Info size={16} className="mt-0.5 shrink-0" /> Analyse non concluante : {reason}
    </p>
  )
}

function EngineLine({ name, date, extra }) {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink-soft">
      <span className="inline-flex items-center gap-1.5">
        <Cpu size={12} /> {name}
      </span>
      {date && <span>· {dateTime(date)}</span>}
      {extra}
    </p>
  )
}

function ProvenanceDetails({ p, analysedAt }) {
  return (
    <div>
      <p className="text-sm text-ink">
        {p.level === 'aucune'
          ? 'Aucune déclaration, trace d’outil ni phrase d’assistant n’a été trouvée dans le texte.'
          : p.level === 'faible'
            ? 'Des outils d’IA sont seulement nommés dans le texte : ce n’est pas une preuve d’utilisation.'
            : `${p.findings.length} élément${p.findings.length > 1 ? 's' : ''} trouvé${p.findings.length > 1 ? 's' : ''} dans le texte${p.tools.length ? `, qui nomme${p.findings.length > 1 ? 'nt' : ''} : ${p.tools.join(', ')}` : ''}.`}
      </p>
      <p className="mt-1 text-xs text-ink-soft">Des preuves lues dans le texte, pas une estimation : pas de score. L’outil n’est nommé que si la preuve le nomme.</p>

      {p.findings.length > 0 && (
        <ul className="mt-3 space-y-2">
          {p.findings.map((f, i) => {
            const k = FINDING_KINDS[f.kind] || FINDING_KINDS.leftover
            return (
              <li key={i} className="rounded-2xl border border-ink/8 bg-surface p-3">
                <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink">
                  <span className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider" style={{ background: `${k.color}22`, color: k.color }}>
                    {k.label}
                  </span>
                  {f.label}
                  {f.tools?.length > 0 && <span className="text-xs font-normal text-ink-soft">· {f.tools.join(', ')}</span>}
                </p>
                <Passage p={f.passage} />
              </li>
            )
          })}
        </ul>
      )}

      {p.mentions?.length > 0 && (
        <p className="mt-3 text-xs text-ink-soft">
          Outils nommés dans le texte (contexte, pas une preuve) : {p.mentions.map((m) => `${m.tool} (${m.count})`).join(', ')}.
        </p>
      )}

      {p.isgenai && (
        <div className="mt-4 rounded-2xl border border-ink/8 bg-surface p-3">
          <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink">
            <ShieldCheck size={15} className="text-violet-600" /> Avis d’isGenAI : {p.isgenai.headline || p.isgenai.label}
            {p.isgenai.confidence && <span className="text-xs font-normal text-ink-soft">· confiance {p.isgenai.confidence}</span>}
          </p>
          {p.isgenai.summary && <p className="mt-1 text-xs text-ink-soft">{p.isgenai.summary}</p>}
          {p.isgenai.evidence?.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {p.isgenai.evidence.map((e, i) => (
                <li key={i} className="text-xs text-ink">
                  • {e.summary} <span className="text-ink-soft">(force : {e.strength})</span>
                  {e.snippet && <span className="mt-0.5 block rounded-lg bg-ink/[0.04] px-2 py-1 italic text-ink-soft">« {e.snippet} »</span>}
                </li>
              ))}
            </ul>
          )}
          {p.isgenai.caveats?.map((c) => (
            <p key={c} className="mt-1 text-[11px] text-ink-soft">{c}</p>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {p.engines?.map((e) => {
          const st = ENGINE_STATUS[e.status] || ENGINE_STATUS.off
          return (
            <div key={e.key} className="flex items-start gap-2.5 rounded-2xl border border-ink/8 bg-surface px-3 py-2.5">
              <span className="mt-1.5">
                <Dot color={st.color} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-ink">
                  {e.name} <span className="font-normal text-ink-soft">· {st.label}</span>
                </span>
                <span className="block text-xs text-ink-soft">{e.note}</span>
              </span>
            </div>
          )
        })}
      </div>
      <EngineLine name="Moteurs de provenance" date={p.checkedAt || analysedAt} />
      <Limitations items={p.limitations} />
    </div>
  )
}

// The homework as a strip of passages, coloured by the model's estimate.
function PassageMap({ passages }) {
  const [sel, setSel] = useState(() => {
    const flagged = passages.findIndex((p) => p.band !== 'faible')
    return flagged >= 0 ? flagged : 0
  })
  const p = passages[sel]
  return (
    <div className="mt-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">Carte du devoir · passages lus par le modèle</p>
      <div className="mt-2 flex h-9 gap-1 overflow-hidden rounded-xl">
        {passages.map((x, i) => {
          const t = LEVEL_TONES[x.band]
          return (
            <button
              key={x.index}
              type="button"
              onClick={() => setSel(i)}
              aria-label={`Passage ${x.index + 1} : ${t.label}`}
              aria-pressed={sel === i}
              className="relative min-w-6 transition hover:brightness-110"
              style={{ flexGrow: x.words, background: `${t.color}${sel === i ? 'ee' : '88'}`, boxShadow: sel === i ? `inset 0 0 0 2px #0b0614, 0 0 14px ${t.glow}` : 'none' }}
            >
              <span className="font-mono text-[10px] font-bold text-[#0b0614]">{x.index + 1}</span>
            </button>
          )
        })}
      </div>
      {p && (
        <div className="mt-2 rounded-2xl border border-ink/8 bg-surface p-3">
          <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink">
            Passage {p.index + 1} <span style={{ color: LEVEL_TONES[p.band].color }}>· {LEVEL_TONES[p.band].label}</span>
            <span className="font-mono text-xs font-normal text-ink-soft">score {p.score} · {p.words} mots</span>
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{p.preview}…</p>
          {p.band !== 'faible' && <p className="mt-1.5 text-xs font-semibold text-orange-600">Passage à relire avec l’étudiant : lui demander de l’expliquer, avec ses brouillons.</p>}
        </div>
      )}
    </div>
  )
}

function ModelDetails({ ml }) {
  if (ml.status === 'unavailable') {
    return (
      <div>
        <p className="flex items-start gap-2 rounded-2xl bg-ink/[0.04] px-3.5 py-2.5 text-sm text-ink-soft">
          <Info size={16} className="mt-0.5 shrink-0" /> {ml.reason}
        </p>
        <p className="mt-2 text-xs text-ink-soft">Les preuves de provenance et l’analyse stylistique restent disponibles.</p>
      </div>
    )
  }
  if (ml.status !== 'ok') return <Inconclusive reason={ml.reason} />
  return (
    <div>
      <p className="text-sm text-ink">
        Estimation du modèle : <strong style={{ color: LEVEL_TONES[ml.band].color }}>{ml.label}</strong>
        <span className="ml-2 font-mono text-xs text-ink-soft">
          score médian {ml.score} · seuils {ml.thresholds.high} / {ml.thresholds.moderate}
        </span>
      </p>
      <p className="mt-1 text-xs text-ink-soft">Plus le score est bas, plus le texte est prévisible pour un modèle de langage. Ce n’est pas une probabilité.</p>
      <ul className="mt-2 space-y-1 text-sm text-ink">
        {ml.observations.map((o) => (
          <li key={o}>• {o}</li>
        ))}
      </ul>
      {ml.passages?.length > 0 && <PassageMap passages={ml.passages} />}
      <EngineLine name={ml.engine} date={ml.checkedAt} />
      <Limitations items={ml.limitations} />
    </div>
  )
}

function StyleAiDetails({ ai }) {
  if (ai.status !== 'ok') return <Inconclusive reason={ai.reason} />
  return (
    <div>
      <p className="text-sm text-ink">
        Indice de caractéristiques stylistiques compatibles avec une assistance IA : <strong>{ai.score}/100</strong> — fiabilité {ai.reliability}.
      </p>
      <p className="mt-1 text-xs text-ink-soft">Indicateur heuristique, et non une probabilité. Chaque élément ci-dessous est un indice, jamais une preuve.</p>
      {ai.observations.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">Raisons observées</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-ink">
            {ai.observations.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 space-y-2.5">
        {ai.signals.map((s) => (
          <details key={s.key} className="group rounded-2xl border border-ink/8 bg-surface p-3" open={s.value >= 50}>
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{s.label}</span>
              <span className="w-24">
                <ScoreBar value={s.value} tone={s.value >= 60 ? 'coral' : s.value >= 40 ? 'gold' : 'mint'} />
              </span>
              <span className="w-9 text-right font-mono text-xs font-bold text-ink-soft">{s.value}</span>
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
      <EngineLine name="Analyse stylistique locale BomaVibes (règles, sans modèle)" />
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
        <p key={n} className="mt-1 text-sm text-ink">
          • {n}
        </p>
      ))}
      {shown.length > 0 && (
        <ul className="mt-3 space-y-2">
          {shown.map((i, k) => (
            <li key={k} className="rounded-2xl border border-ink/8 bg-surface p-2.5">
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
              <li key={i} className="rounded-2xl border border-ink/8 bg-surface p-2.5">
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
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">Points à examiner</p>
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
          <li key={f.key} className="rounded-2xl border border-ink/8 bg-surface p-2.5">
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

function DetailPanel({ item }) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence mode="wait">
      {item && (
        <motion.section
          key={item.key}
          initial={{ opacity: 0, y: reduce ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -4 }}
          transition={{ duration: reduce ? 0 : 0.25 }}
          className="rounded-[28px] border border-ink/8 bg-surface-soft p-4 sm:p-5"
          aria-live="polite"
        >
          <h3 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-ink">
            {item.icon && <item.icon size={18} className="text-violet-600" />} {item.title}
          </h3>
          {item.body}
        </motion.section>
      )}
    </AnimatePresence>
  )
}

function AnalysisResult({ analysis, onDownload, onDelete, downloading }) {
  const r = analysis.result
  const [open, setOpen] = useState(r?.provenance ? 'provenance' : r?.ai ? 'ai' : null)
  if (!r) return null
  const meta = analysis.meta || {}
  const toggle = (key) => setOpen((o) => (o === key ? null : key))
  const analysedAt = analysis.finishedAt || analysis.createdAt

  // A, B, C — never added up.
  const engines = [
    r.provenance && {
      key: 'provenance',
      letter: 'A',
      icon: Fingerprint,
      title: 'Preuves de provenance',
      kicker: 'Déclarations · traces · métadonnées',
      level: r.provenance.level,
      value: r.provenance.label,
      engine: r.provenance.engines?.filter((e) => e.status === 'ok').map((e) => e.name).join(' + ') || 'Recherche locale',
      note: r.provenance.tools?.length ? `Outil nommé par la preuve : ${r.provenance.tools.join(', ')}` : null,
      body: <ProvenanceDetails p={r.provenance} analysedAt={analysedAt} />,
    },
    r.ml && {
      key: 'ml',
      letter: 'B',
      icon: Cpu,
      title: 'Estimation ML',
      kicker: 'Modèle de langage, sur le serveur',
      level: r.ml.status === 'ok' ? r.ml.band : 'off',
      value: r.ml.status === 'ok' ? r.ml.label : r.ml.status === 'unavailable' ? 'Moteur non activé' : 'Non concluant',
      engine: r.ml.status === 'ok' ? r.ml.engine : 'Binoculars · non utilisé',
      note: r.ml.status === 'ok' ? `${r.ml.passages.filter((p) => p.band !== 'faible').length}/${r.ml.passages.length} passage(s) à vérifier` : null,
      body: <ModelDetails ml={r.ml} />,
    },
    r.ai && {
      key: 'ai',
      letter: r.provenance ? 'C' : '',
      icon: ScanText,
      title: 'Analyse stylistique',
      kicker: 'Uniformité · formules · transitions',
      level: r.ai.status === 'ok' ? styleLevel(r.ai.score) : 'off',
      value: r.ai.status === 'ok' ? `${r.ai.score}/100` : 'Non concluant',
      engine: 'Règles locales, sans modèle',
      note: r.ai.status === 'ok' ? BANDS[r.ai.band]?.label : null,
      body: <StyleAiDetails ai={r.ai} />,
    },
  ].filter(Boolean)

  const tiles = [
    r.quality && {
      key: 'quality',
      icon: PenLine,
      title: 'Qualité rédactionnelle',
      value: r.quality.status === 'ok' ? `${r.quality.score}/100` : 'Non concluant',
      ring: r.quality.status === 'ok' ? r.quality.score : null,
      sub: r.quality.status === 'ok' ? r.quality.label : null,
      body: <QualityDetails quality={r.quality} />,
    },
    r.coherence && {
      key: 'coherence',
      icon: Layers,
      title: 'Cohérence du contenu',
      value: r.coherence.status === 'ok' ? `${r.coherence.score}/100` : 'Non concluant',
      ring: r.coherence.status === 'ok' ? r.coherence.score : null,
      sub: r.coherence.status === 'ok' ? r.coherence.label : null,
      body: <CoherenceDetails coherence={r.coherence} />,
    },
    r.coherence?.status === 'ok' && {
      key: 'topic',
      icon: Target,
      title: 'Respect du sujet',
      value: r.coherence.topic ? `${r.coherence.topic.coverage} %` : 'Sujet non renseigné',
      ring: r.coherence.topic ? r.coherence.topic.coverage : null,
      sub: r.coherence.topic ? `${r.coherence.topic.covered}/${r.coherence.topic.keyWords} mots clés du sujet` : null,
      body: <CoherenceDetails coherence={{ ...r.coherence, findings: r.coherence.findings.filter((f) => f.key === 'topic' || f.key === 'off_topic') }} />,
    },
    r.sources && {
      key: 'sources',
      icon: FileSearch,
      title: 'Sources',
      value: `${r.sources.references.length} référence${r.sources.references.length > 1 ? 's' : ''}`,
      sub: r.sources.toVerify ? `${r.sources.toVerify} point(s) à vérifier` : 'Rien à signaler',
      body: <SourcesDetails sources={r.sources} />,
    },
    r.style &&
      r.style.status !== 'not_requested' && {
        key: 'style',
        icon: BookOpen,
        title: 'Travaux antérieurs',
        value: r.style.status === 'ok' ? `${r.style.similarity}/100` : 'Non concluant',
        ring: r.style.status === 'ok' ? r.style.similarity : null,
        sub: r.style.status === 'ok' ? r.style.label : null,
        body: <StyleDetails style={r.style} />,
      },
    r.academicLevel &&
      r.academicLevel.status !== 'not_requested' && {
        key: 'level',
        icon: GraduationCap,
        title: `Niveau${r.academicLevel.levelLabel ? ` · ${r.academicLevel.levelLabel}` : ''}`,
        value: r.academicLevel.status === 'ok' ? `${r.academicLevel.criteria.filter((c) => c.verdict !== 'en_dessous').length}/${r.academicLevel.criteria.length} critères` : 'Non concluant',
        sub: r.academicLevel.status === 'ok' ? 'dans les repères du niveau' : null,
        body: <LevelDetails level={r.academicLevel} />,
      },
  ].filter(Boolean)

  const openItem = [...engines, ...tiles].find((x) => x.key === open)
  const engineOpen = engines.some((e) => e.key === open)
  const ref = String(analysis.id || '').slice(0, 8).toUpperCase()

  return (
    <div className="space-y-4">
      <Console>
        <div className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.2em] text-[#d9a6ff]">
                <Sparkles size={13} /> Rapport EDU-CHECK {ref && <span className="text-white/35">· #{ref}</span>}
              </p>
              <h2 className="mt-1.5 truncate font-display text-2xl font-black text-white sm:text-3xl">{meta.student || 'Devoir sans nom'}</h2>
              <p className="mt-1 text-xs text-white/55">
                {[meta.className, meta.subject, meta.teacher, `${r.words} mots`].filter(Boolean).join(' · ')}
              </p>
              {analysedAt && <p className="mt-0.5 font-mono text-[11px] text-white/40">Analysé le {dateTime(analysedAt)}</p>}
              {meta.topic && <p className="mt-2 line-clamp-2 max-w-2xl text-xs italic text-white/50">Sujet : {meta.topic}</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={onDownload}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#2b1a2c] shadow-lg shadow-white/10 transition hover:bg-white/90 disabled:opacity-60"
              >
                <Download size={14} /> {downloading ? 'Préparation…' : 'Rapport PDF'}
              </button>
              {onDelete && (
                <button type="button" onClick={onDelete} className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-[#ff8a80] transition hover:bg-white/10" aria-label="Supprimer l’analyse">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {r.document && r.document.kind !== 'redige' && (
            <p className="mt-4 flex items-start gap-2 rounded-2xl border border-[#4cc3ff]/25 bg-[#4cc3ff]/10 px-3 py-2 text-xs text-white/80">
              <Info size={15} className="mt-0.5 shrink-0 text-[#4cc3ff]" />
              <span>
                {r.document.proseShare} % du document est du texte rédigé ({r.document.proseWords} mots)
                {r.document.codeLines ? `, ${r.document.codeLines} lignes de code` : ''}
                {r.document.tableLines ? `, ${r.document.tableLines} lignes de tableau` : ''}. Le code, les tableaux, les listes et les titres sont écartés des indices.
              </span>
            </p>
          )}

          {engines.length > 0 && (
            <>
              <div className="mt-5 flex flex-wrap items-end justify-between gap-2">
                <h3 className="font-display text-sm font-bold uppercase tracking-[.14em] text-white/80">Détection IA · {engines.length} moteur{engines.length > 1 ? 's' : ''} indépendant{engines.length > 1 ? 's' : ''}</h3>
                <p className="text-[11px] text-white/40">Trois résultats distincts, jamais additionnés.</p>
              </div>
              <div className={`mt-3 grid gap-3 ${engines.length === 3 ? 'md:grid-cols-3' : engines.length === 2 ? 'sm:grid-cols-2' : ''}`}>
                {engines.map((e, i) => (
                  <EngineCard key={e.key} index={i} letter={e.letter || '·'} title={e.title} kicker={e.kicker} level={e.level} value={e.value} engine={e.engine} note={e.note} active={open === e.key} onClick={() => toggle(e.key)} />
                ))}
              </div>
            </>
          )}

          {r.attention?.length > 0 && (
            <p className="mt-4 flex items-start gap-2 rounded-2xl border border-[#ffc83d]/25 bg-[#ffc83d]/10 px-3 py-2 text-xs text-white/85">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#ffc83d]" />
              <span>
                <strong className="text-[#ffc83d]">Attention pédagogique</strong> — {r.attention.join(', ')}. Jamais une preuve de triche : un échange avec l’étudiant s’impose avant toute décision.
              </span>
            </p>
          )}
          {analysis.status === 'inconclusive' && (
            <p className="mt-4 flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
              <Info size={15} className="mt-0.5 shrink-0" /> Données insuffisantes pour conclure sur ce devoir (texte trop court, langue non prise en charge ou trop peu structuré).
            </p>
          )}
        </div>
      </Console>

      {engineOpen && <DetailPanel item={openItem} />}

      {tiles.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((t, i) => (
            <MetricTile key={t.key} index={i} icon={t.icon} title={t.title} value={t.value} ring={t.ring} ringColor={t.ring != null ? (t.key === 'style' ? '#0b84d6' : scoreColor(t.ring)) : undefined} sub={t.sub} active={open === t.key} onClick={() => toggle(t.key)} />
          ))}
        </div>
      )}

      {!engineOpen && <DetailPanel item={openItem} />}

      <section className="rounded-[28px] border border-ink/8 bg-surface p-4 sm:p-5">
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <GraduationCap size={18} className="text-violet-600" /> Recommandations pédagogiques
        </h3>
        <ol className="mt-3 space-y-2.5">
          {r.recommendations.map((x, i) => (
            <li key={x} className="flex gap-3 text-sm text-ink">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-brand font-mono text-[11px] font-bold text-white">{i + 1}</span>
              <span className="pt-0.5">{x}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-ink-soft">
        <ShieldCheck size={13} className="text-mint-500" />
        Aucun score n’est une preuve. Aucun service payant. Le texte du devoir ne quitte le serveur que si vous avez demandé l’avis d’isGenAI (seules les références partent vers Crossref et OpenAlex).
      </p>
    </div>
  )
}

export default AnalysisResult
