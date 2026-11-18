import { pdfText } from './cvPdf.js'

// EDU-CHECK — the analysis report as an A4 PDF, made on the teacher's
// device (jsPDF, loaded on demand). Every indicator stays separate; the
// limits of the detection are printed on the first page and every footer.

const PAGE_W = 210
const PAGE_H = 297
const M = 16
const W = PAGE_W - 2 * M
const INK = [38, 27, 40]
const SOFT = [99, 90, 101]
const ACCENT = [106, 70, 147]
const RULE = [221, 214, 226]
const WARN = [180, 83, 9]

const lh = (pt) => pt * 0.3528 * 1.35

const BAND_LABEL = { faible: 'Indice faible', limite: 'Indice limité', modere: 'Indice modéré', eleve: 'Indice élevé', tres_eleve: 'Indice très élevé' }
const SOURCE_STATUS = { trouvee: 'Trouvée', introuvable: 'Introuvable', a_verifier: 'À vérifier', incoherente: 'Incohérente', indisponible: 'Vérification indisponible' }

export function reportFileName(analysis) {
  const who = pdfText(analysis.meta?.student || 'devoir').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `EDU-CHECK-${who || 'devoir'}-${new Date(analysis.createdAt || Date.now()).toISOString().slice(0, 10)}.pdf`
}

export async function buildEduCheckPdf(analysis, { disclaimer }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const r = analysis.result || {}
  const meta = analysis.meta || {}
  let y = M

  const font = (style, size, color = INK) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
  }
  const space = (h) => {
    if (y + h > PAGE_H - M - 12) {
      doc.addPage()
      y = M
    }
  }
  const write = (text, { size = 10, style = 'normal', color = INK, x = M, width = W, gap = 1.5 } = {}) => {
    font(style, size, color)
    const lines = doc.splitTextToSize(pdfText(text), width)
    for (const line of lines) {
      space(lh(size))
      doc.text(line, x, y, { baseline: 'top' })
      y += lh(size)
    }
    y += gap
  }
  const heading = (text) => {
    space(14)
    y += 3
    font('bold', 12.5, ACCENT)
    doc.text(pdfText(text), M, y, { baseline: 'top' })
    y += lh(12.5) + 1
    doc.setDrawColor(...RULE)
    doc.line(M, y, PAGE_W - M, y)
    y += 3
  }
  const bullet = (text, opts = {}) => {
    font('normal', 9.5, opts.color || INK)
    const lines = doc.splitTextToSize(pdfText(text), W - 5)
    lines.forEach((line, i) => {
      space(lh(9.5))
      if (i === 0) doc.text('•', M + 1, y, { baseline: 'top' })
      doc.text(line, M + 5, y, { baseline: 'top' })
      y += lh(9.5)
    })
    y += 0.8
  }
  const passage = (p) => {
    if (!p) return
    const text = `« ${p.before || ''}[${p.match || ''}]${p.after || ''} »`
    write(text, { size: 8.5, color: SOFT, x: M + 5, width: W - 5, gap: 1 })
  }

  // ---- Header ---------------------------------------------------------------
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, PAGE_W, 3, 'F')
  font('bold', 18)
  doc.text('Rapport d’analyse de devoir', M, y, { baseline: 'top' })
  y += 8
  write('EDU-CHECK — assistant de vérification des devoirs', { size: 9.5, color: SOFT, gap: 3 })

  const rows = [
    ['Établissement', meta.establishment],
    ['Étudiant', meta.student],
    ['Classe', meta.className],
    ['Matière', meta.subject],
    ['Enseignant', meta.teacher],
    ['Niveau', r.level?.label || meta.levelLabel],
    ['Date de soumission', meta.submittedAt ? new Date(`${meta.submittedAt}T00:00:00`).toLocaleDateString('fr-FR') : ''],
    ['Analyse du', new Date(analysis.createdAt || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })],
    ['Longueur', `${r.words ?? analysis.words} mots`],
  ].filter(([, v]) => v)
  for (const [k, v] of rows) {
    font('bold', 9.5, SOFT)
    doc.text(pdfText(k), M, y, { baseline: 'top' })
    font('normal', 9.5)
    const lines = doc.splitTextToSize(pdfText(v), W - 42)
    doc.text(lines, M + 42, y, { baseline: 'top' })
    y += lines.length * lh(9.5) + 0.6
  }
  if (meta.topic) {
    y += 1
    write(`Sujet : ${meta.topic}`, { size: 9.5, style: 'italic' })
  }

  // The limits come first: nobody should read a figure without them.
  y += 2
  const box = doc.splitTextToSize(pdfText(disclaimer), W - 8)
  const boxH = box.length * lh(9) + 6
  space(boxH)
  doc.setFillColor(255, 247, 232)
  doc.setDrawColor(...WARN)
  doc.roundedRect(M, y, W, boxH, 2, 2, 'FD')
  font('bold', 9, WARN)
  doc.text(box, M + 4, y + 3, { baseline: 'top' })
  y += boxH + 3

  // ---- Summary: each indicator on its own ------------------------------------
  heading('Synthèse des indicateurs (jamais additionnés)')
  const summary = [
    ['Caractéristiques compatibles avec une assistance IA', r.ai ? (r.ai.status === 'ok' ? `${r.ai.score}/100 — ${BAND_LABEL[r.ai.band]} (fiabilité ${r.ai.reliability})` : `Analyse non concluante — ${r.ai.reason}`) : 'Non demandé'],
    ['Qualité rédactionnelle', r.quality ? (r.quality.status === 'ok' ? `${r.quality.score}/100 — ${r.quality.label}` : `Non concluant — ${r.quality.reason}`) : 'Non demandé'],
    ['Cohérence du contenu', r.coherence ? (r.coherence.status === 'ok' ? `${r.coherence.score}/100 — ${r.coherence.label}` : `Non concluant — ${r.coherence.reason}`) : 'Non demandé'],
    ['Respect du sujet', r.coherence?.topic ? `${r.coherence.topic.covered}/${r.coherence.topic.keyWords} mots clés du sujet présents (${r.coherence.topic.coverage} %)` : r.coherence ? 'Sujet non renseigné' : 'Non demandé'],
    ['Vérification des sources', r.sources ? `${r.sources.summary} ${r.sources.toVerify} point(s) à vérifier.` : 'Non demandé'],
    ['Similarité avec les travaux antérieurs', r.style?.status === 'ok' ? `${r.style.similarity}/100 — ${r.style.label} (${r.style.priorCount} travail/travaux)` : r.style?.reason || 'Non demandé'],
    ['Niveau académique', r.academicLevel?.status === 'ok' ? r.academicLevel.summary : r.academicLevel?.reason || 'Non demandé'],
  ]
  for (const [k, v] of summary) {
    write(k, { size: 10, style: 'bold', gap: 0.3 })
    write(v, { size: 9.5, color: SOFT, gap: 2 })
  }
  write('L’indice IA est un indicateur heuristique, pas une probabilité : il ne dit pas « X % de chances » qu’un devoir ait été produit par une IA.', { size: 8.5, style: 'italic', color: SOFT })

  // ---- AI-writing indicators ---------------------------------------------------
  if (r.ai?.status === 'ok') {
    heading('Indices de rédaction assistée : éléments observés')
    for (const s of r.ai.signals) {
      write(`${s.label} — ${s.value}/100`, { size: 10, style: 'bold', gap: 0.3 })
      write(s.observed, { size: 9.5, gap: 0.5 })
      write(s.explanation, { size: 8.5, color: SOFT, gap: 0.8 })
      s.passages?.slice(0, 2).forEach(passage)
      y += 1.5
    }
    if (r.ai.limitations?.length) {
      write('Limites de cette mesure', { size: 9.5, style: 'bold', gap: 0.5 })
      r.ai.limitations.forEach((l) => bullet(l, { color: SOFT }))
    }
  }

  // ---- Quality ---------------------------------------------------------------
  if (r.quality?.status === 'ok') {
    heading('Qualité rédactionnelle')
    write(`${r.quality.stats.words} mots, ${r.quality.stats.sentences} phrases, ${r.quality.stats.paragraphs} paragraphes ; ${r.quality.stats.averageSentence} mots par phrase en moyenne.`, { size: 9.5 })
    write(r.quality.argumentation, { size: 9.5 })
    r.quality.paragraphNotes.forEach((n) => bullet(n))
    const important = r.quality.issues.filter((i) => i.severity === 'important').slice(0, 12)
    const minor = r.quality.issues.filter((i) => i.severity !== 'important')
    if (important.length) {
      write('Fautes relevées', { size: 9.5, style: 'bold', gap: 0.5 })
      important.forEach((i) => {
        bullet(i.message)
        passage(i)
      })
    }
    if (minor.length) write(`${minor.length} remarque(s) de ponctuation, de typographie ou de construction (détail dans EDU-CHECK).`, { size: 9, color: SOFT })
    r.quality.limitations.forEach((l) => bullet(l, { color: SOFT }))
  }

  // ---- Sources -----------------------------------------------------------------
  if (r.sources?.status === 'ok') {
    heading('Vérification des sources')
    write(r.sources.summary, { size: 9.5 })
    r.sources.references.forEach((ref) => {
      write(ref.raw, { size: 9, gap: 0.3 })
      write(`${SOURCE_STATUS[ref.verification?.status] || 'À vérifier'} — ${ref.verification?.detail || ''}`, {
        size: 8.5,
        color: ref.verification?.status === 'trouvee' ? [35, 122, 75] : WARN,
        x: M + 5,
        width: W - 5,
        gap: 1.5,
      })
    })
    if (r.sources.issues.length) {
      write('Points à examiner', { size: 9.5, style: 'bold', gap: 0.5 })
      r.sources.issues.slice(0, 20).forEach((i) => {
        bullet(i.message)
        if (i.match) passage(i)
      })
    }
    r.sources.limitations.forEach((l) => bullet(l, { color: SOFT }))
  }

  // ---- Coherence ---------------------------------------------------------------
  if (r.coherence?.status === 'ok') {
    heading('Cohérence du devoir')
    r.coherence.findings.forEach((f) => {
      bullet(`${f.title} : ${f.detail}`, { color: f.level === 'attention' ? WARN : INK })
      f.passages?.slice(0, 2).forEach(passage)
    })
    r.coherence.limitations.forEach((l) => bullet(l, { color: SOFT }))
  }

  // ---- Style ---------------------------------------------------------------------
  if (r.style?.status === 'ok') {
    heading('Comparaison avec les travaux antérieurs')
    write(`${r.style.label} (${r.style.similarity}/100).`, { size: 9.5 })
    r.style.notable.forEach((n) => bullet(n))
    r.style.limitations.forEach((l) => bullet(l, { color: SOFT }))
  }

  // ---- Level ---------------------------------------------------------------------
  if (r.academicLevel?.status === 'ok') {
    heading(`Niveau académique : ${r.academicLevel.levelLabel}`)
    write(r.academicLevel.summary, { size: 9.5 })
    const verdict = { conforme: 'dans les repères', en_dessous: 'en dessous des repères', au_dessus: 'au-dessus des repères' }
    r.academicLevel.criteria.forEach((c) => bullet(`${c.label} : ${c.value} — ${verdict[c.verdict]}${c.note ? `. ${c.note}` : ''}`))
    r.academicLevel.limitations.forEach((l) => bullet(l, { color: SOFT }))
  }

  // ---- Recommendations -------------------------------------------------------------
  heading('Recommandations pédagogiques')
  ;(r.recommendations || []).forEach((x) => bullet(x))

  heading('Limites de la détection')
  ;[
    disclaimer,
    'Aucun outil ne détecte de façon fiable l’utilisation d’une IA. Les indices décrivent des caractéristiques du texte, que des écrits entièrement humains peuvent présenter (textes très structurés, relus, corrigés).',
    'Ce rapport ne doit déclencher aucune sanction automatique. Il sert à préparer un échange avec l’étudiant.',
    'Analyse locale, sans modèle d’IA : les contradictions et la justesse des idées ne sont pas évaluées.',
  ].forEach((l) => bullet(l))

  // ---- Footers -------------------------------------------------------------------
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    font('normal', 7.5, SOFT)
    doc.text(pdfText('EDU-CHECK · Indicateurs à interpréter par l’enseignant — ne permettent pas d’établir avec certitude l’usage d’une IA.'), M, PAGE_H - 9)
    doc.text(`${i} / ${pages}`, PAGE_W - M, PAGE_H - 9, { align: 'right' })
  }
  return doc
}

export async function downloadEduCheckPdf(analysis, options) {
  const doc = await buildEduCheckPdf(analysis, options)
  doc.save(reportFileName(analysis))
}
