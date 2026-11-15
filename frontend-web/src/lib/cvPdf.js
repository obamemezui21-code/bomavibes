// The CV PNPE as an A4 PDF, made on the member's phone (jsPDF, loaded on
// demand like ticketPdf.js). The PNPE's mandatory sections, in its order:
// identity header, job sought, experience (newest first), training and
// diplomas, skills, languages.
//
// Deliberately without any BomaVibes mark: it goes to employers.

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 18
const WIDTH = PAGE_W - 2 * MARGIN
const DATE_COL = 40 // left column: periods and years

const INK = [38, 27, 40]
const SOFT = [99, 90, 101]
const ACCENT = [106, 70, 147]
const RULE = [221, 214, 226]

// jsPDF's built-in fonts only know Windows-1252 (Latin letters, French
// accents, « », – ’ œ €): anything else (emoji, other scripts) would print
// as garbage, so it is replaced or dropped.
const CP1252_EXTRAS = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')
export function pdfText(text) {
  return Array.from(String(text ?? '').normalize('NFC'))
    .map((ch) => (ch.charCodeAt(0) <= 0xff || CP1252_EXTRAS.has(ch) ? ch : ch === '‑' || ch === '−' ? '-' : ''))
    .join('')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

const lineHeight = (pt) => pt * 0.3528 * 1.32

function period(debut, fin) {
  const [a, b] = [pdfText(debut), pdfText(fin)]
  if (a && b) return `${a} – ${b}`
  return a || b
}

// "Permis B" as typed, "B" → "Permis : B", "Aucun" → left off the CV.
export function permisLabel(permis) {
  const p = pdfText(permis)
  if (!p || /^(aucun|non|néant|neant|-)$/i.test(p)) return ''
  return /^permis/i.test(p) ? p : `Permis : ${p}`
}

export function cvFileName(nom) {
  const base = pdfText(nom).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `CV-${base || 'PNPE'}.pdf`
}

export async function buildCvPdf({ identite = {}, cv }) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGIN

  const font = (style, size, color = INK) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
  }
  const ensureSpace = (height) => {
    if (y + height > PAGE_H - MARGIN) {
      doc.addPage()
      y = MARGIN
    }
  }
  // Wrapped text at (x, y); returns its height.
  const write = (text, x, width, size) => {
    const lines = doc.splitTextToSize(pdfText(text), width)
    doc.text(lines, x, y, { baseline: 'top', lineHeightFactor: 1.32 })
    return lines.length * lineHeight(size)
  }
  const measure = (text, width) => doc.splitTextToSize(pdfText(text), width).length

  // ---- Header -------------------------------------------------------------
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, PAGE_W, 3, 'F')

  font('bold', 21)
  y += write(identite.nom || 'Nom et prénoms', MARGIN, WIDTH, 21) + 1
  if (cv.titrePoste) {
    font('bold', 12.5, ACCENT)
    y += write(cv.titrePoste, MARGIN, WIDTH, 12.5) + 2
  }

  font('normal', 9.5, SOFT)
  const place = [identite.ville, identite.quartier].map(pdfText).filter(Boolean).join(', ')
  const contact = [
    identite.telephones && `Tél. / WhatsApp : ${identite.telephones}`,
    identite.email,
    place,
  ].filter(Boolean)
  const admin = [identite.numeroPnpe && `N° PNPE : ${identite.numeroPnpe}`, permisLabel(identite.permis)].filter(Boolean)
  for (const row of [contact, admin]) {
    if (row.length) y += write(row.join('   |   '), MARGIN, WIDTH, 9.5)
  }
  y += 3
  doc.setDrawColor(...RULE)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  y += 2

  // ---- Sections -----------------------------------------------------------
  const section = (title) => {
    ensureSpace(20)
    y += 5
    font('bold', 11, ACCENT)
    doc.text(pdfText(title).toUpperCase(), MARGIN, y, { baseline: 'top' })
    y += lineHeight(11) + 0.8
    doc.setDrawColor(...ACCENT)
    doc.setLineWidth(0.5)
    doc.line(MARGIN, y, MARGIN + 18, y)
    y += 3.5
  }

  const bullets = (items, x, width) => {
    font('normal', 10)
    for (const item of items) {
      const h = measure(item, width - 4) * lineHeight(10)
      ensureSpace(h)
      doc.setFillColor(...ACCENT)
      doc.circle(x + 1, y + 1.9, 0.55, 'F')
      font('normal', 10)
      y += write(item, x + 4, width - 4, 10) + 0.6
    }
  }

  // Left: a period or a year. Right: title, then a softer second line.
  const entry = (when, title, subtitle) => {
    const rightX = MARGIN + DATE_COL
    const rightW = WIDTH - DATE_COL
    font('bold', 10.5)
    const titleH = measure(title, rightW) * lineHeight(10.5)
    font('normal', 9.5)
    const subH = subtitle ? measure(subtitle, rightW) * lineHeight(9.5) : 0
    ensureSpace(titleH + subH + 6)
    const top = y
    font('normal', 9.5, SOFT)
    write(when, MARGIN, DATE_COL - 4, 9.5)
    font('bold', 10.5)
    y += write(title, rightX, rightW, 10.5)
    if (subtitle) {
      font('italic', 9.5, SOFT)
      y += write(subtitle, rightX, rightW, 9.5)
    }
    y = Math.max(y, top + lineHeight(9.5)) + 1
    return { rightX, rightW }
  }

  if (cv.experiences?.length) {
    section('Expériences professionnelles')
    for (const e of cv.experiences) {
      const { rightX, rightW } = entry(period(e.debut, e.fin), e.poste || e.entreprise, [e.entreprise, e.lieu].filter(Boolean).join(' – '))
      bullets(e.taches || [], rightX, rightW)
      y += 2.5
    }
  }

  const trainings = (items) => {
    for (const f of items) {
      entry(f.annee, f.intitule || f.etablissement, f.intitule ? f.etablissement : '')
      y += 1.5
    }
  }
  if (cv.formations?.length || cv.certifications?.length) {
    section('Formations et diplômes')
    trainings(cv.formations || [])
    if (cv.certifications?.length) {
      ensureSpace(12)
      y += 1
      font('bold', 10, SOFT)
      doc.text(pdfText('Certificats et formations qualifiantes'), MARGIN, y, { baseline: 'top' })
      y += lineHeight(10) + 2
      trainings(cv.certifications)
    }
  }

  if (cv.competencesTechniques?.length || cv.savoirFaire?.length) {
    section('Compétences')
    const group = (label, items) => {
      if (!items?.length) return
      ensureSpace(12)
      font('bold', 10)
      doc.text(pdfText(label), MARGIN, y, { baseline: 'top' })
      y += lineHeight(10) + 1
      bullets(items, MARGIN, WIDTH)
      y += 2
    }
    group('Compétences techniques', cv.competencesTechniques)
    group('Savoir-faire', cv.savoirFaire)
  }

  if (cv.langues?.length) {
    section('Langues')
    bullets(
      cv.langues.map((l) => (l.niveau ? `${l.langue} (${l.niveau})` : l.langue)),
      MARGIN,
      WIDTH,
    )
  }

  // Page numbers, only when there is more than one page.
  const pages = doc.getNumberOfPages()
  if (pages > 1) {
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i)
      font('normal', 8.5, SOFT)
      doc.text(`${i} / ${pages}`, PAGE_W - MARGIN, PAGE_H - 10, { align: 'right' })
    }
  }
  return doc
}

export async function downloadCvPdf(data) {
  const doc = await buildCvPdf(data)
  doc.save(cvFileName(data.identite?.nom))
}
