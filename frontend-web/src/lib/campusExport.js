// BomaVibes Campus — a report (campusReports.js) as a PDF, an Excel file or a
// print. Made on the person's device; jsPDF is loaded on demand.
import { pdfText } from './cvPdf.js'
import { XLSX_TYPE, buildXlsx } from './xlsx.js'

const INK = [38, 27, 40]
const SOFT = [99, 90, 101]
const PLUM = [75, 22, 76]
const RULE = [206, 196, 212]
const HEAD = [244, 236, 244]
const ALERT = [192, 36, 31]
const M = 12

// A report, or several one after the other ({ reports }).
export async function buildPdf(what) {
  const { jsPDF } = await import('jspdf')
  const reports = what.reports || [what]
  const orientation = (r) => (r.landscape ? 'landscape' : 'portrait')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: orientation(reports[0]) })
  reports.forEach((report, i) => {
    if (i) doc.addPage('a4', orientation(report))
    drawReport(doc, report)
  })
  return doc
}

function drawReport(doc, report) {
  const firstPage = doc.getNumberOfPages()
  const PW = doc.internal.pageSize.getWidth()
  const PH = doc.internal.pageSize.getHeight()
  const W = PW - 2 * M
  const BOTTOM = PH - 14
  let y = M

  const font = (style, size, color = INK) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
  }

  // Header of the first page: institution, class, title.
  font('bold', 10, PLUM)
  doc.text(pdfText(report.orgName || report.org), M, y, { baseline: 'top' })
  font('normal', 9, SOFT)
  doc.text(pdfText(`Classe : ${report.className}`), PW - M, y, { baseline: 'top', align: 'right' })
  y += 7
  font('bold', 16)
  doc.text(pdfText(report.title), M, y, { baseline: 'top' })
  y += 8
  if (report.subtitle) {
    const alert = report.subtitle === report.subtitle.toUpperCase() && /[A-Z]/.test(report.subtitle)
    font('bold', 11, alert ? ALERT : PLUM)
    doc.text(pdfText(report.subtitle), M, y, { baseline: 'top' })
    y += 6
  }
  // Details, two by two.
  const half = W / 2
  for (let i = 0; i < report.meta.length; i += 2) {
    let tall = 0
    report.meta.slice(i, i + 2).forEach(([label, value], k) => {
      const x = M + k * half
      font('bold', 9, SOFT)
      const l = pdfText(`${label} : `)
      doc.text(l, x, y, { baseline: 'top' })
      const lw = doc.getTextWidth(`${l} `)
      font('normal', 9)
      const lines = doc.splitTextToSize(pdfText(value), half - lw - 3)
      lines.forEach((line, n) => doc.text(line, x + lw, y + n * 4.2, { baseline: 'top' }))
      tall = Math.max(tall, lines.length * 4.2)
    })
    y += tall + 0.8
  }
  y += 3

  const box = (cx, cy, size, checked) => {
    doc.setDrawColor(...SOFT)
    doc.setLineWidth(0.25)
    doc.rect(cx - size / 2, cy - size / 2, size, size)
    if (checked) {
      const d = size / 2 - 0.5
      doc.setDrawColor(...INK)
      doc.setLineWidth(0.6)
      doc.line(cx - d, cy - d, cx + d, cy + d)
      doc.line(cx - d, cy + d, cx + d, cy - d)
    }
  }

  for (const table of report.tables) {
    if (table.title) {
      if (y > BOTTOM - 24) {
        doc.addPage()
        y = M
      }
      font('bold', 11, PLUM)
      doc.text(pdfText(table.title), M, y, { baseline: 'top' })
      y += 6.5
    }
    if (!table.rows.length) {
      font('italic', 9.5, SOFT)
      doc.text(pdfText(table.empty || 'Aucune donnée.'), M, y, { baseline: 'top' })
      y += 9
      continue
    }
    const total = table.columns.reduce((n, c) => n + c.width, 0)
    const widths = table.columns.map((c) => (c.width / total) * W)
    const xs = widths.map((_, i) => M + widths.slice(0, i).reduce((n, w) => n + w, 0))
    const size = 8.5
    const line = 3.7
    const minRow = table.roomy ? 6.6 : 5.2
    // Lines of their own inside a cell (the timetable): more room around them.
    const pad = table.airy ? 6 : 1.4

    const head = () => {
      doc.setFillColor(...HEAD)
      doc.rect(M, y, W, 6.6, 'F')
      table.columns.forEach((c, i) => {
        // A narrow column's title is set smaller rather than cut.
        font('bold', 8.5, PLUM)
        const label = pdfText(c.label)
        let s = 8.5
        while (s > 6 && doc.getTextWidth(label) > widths[i] - 1.6) doc.setFontSize((s -= 0.5))
        const center = c.align === 'center'
        doc.text(label, center ? xs[i] + widths[i] / 2 : xs[i] + 1.2, y + 3.3, { baseline: 'middle', align: center ? 'center' : 'left' })
      })
      y += 6.6
    }
    head()
    for (const row of table.rows) {
      font('normal', size)
      const cells = row.map((v, i) => {
        const c = table.columns[i]
        if (c.type === 'mark') return null
        const text = c.type === 'pct' ? (v === null || v === undefined ? '–' : `${(v * 100).toFixed(1).replace('.', ',')} %`) : pdfText(v)
        return doc.splitTextToSize(text, widths[i] - 2.2)
      })
      const h = Math.max(minRow, ...cells.map((c) => (c ? c.length * line + (c.length > 1 ? pad : 1.4) : 0)))
      if (y + h > BOTTOM) {
        doc.addPage()
        y = M
        head()
        font('normal', size)
      }
      cells.forEach((lines, i) => {
        const c = table.columns[i]
        if (!lines) return box(xs[i] + widths[i] / 2, y + h / 2, 3.4, row[i] === true)
        const center = c.align === 'center'
        const top = y + h / 2 - ((lines.length - 1) * line) / 2
        lines.forEach((t, n) => doc.text(t, center ? xs[i] + widths[i] / 2 : xs[i] + 1.2, top + n * line, { baseline: 'middle', align: center ? 'center' : 'left' }))
      })
      y += h
      doc.setDrawColor(...RULE)
      doc.setLineWidth(0.15)
      doc.line(M, y, M + W, y)
    }
    y += 6
  }

  for (const note of report.notes) {
    font('italic', 8, SOFT)
    const lines = doc.splitTextToSize(pdfText(note), W)
    if (y + lines.length * 3.6 > BOTTOM) {
      doc.addPage()
      y = M
    }
    doc.text(lines, M, y, { baseline: 'top' })
    y += lines.length * 3.6 + 2
  }
  if (report.signatures.length) {
    if (y + 24 > BOTTOM) {
      doc.addPage()
      y = M
    }
    const w = Math.min(W / report.signatures.length, W / 2)
    report.signatures.forEach((s, i) => {
      font('bold', 9)
      doc.text(pdfText(`${s} :`), M + i * w, y + 2, { baseline: 'top' })
      doc.setDrawColor(...RULE)
      doc.line(M + i * w, y + 20, M + i * w + w - 14, y + 20)
    })
  }

  const pages = doc.getNumberOfPages()
  for (let p = firstPage; p <= pages; p++) {
    doc.setPage(p)
    font('normal', 8, SOFT)
    doc.text(pdfText(`BomaVibes Campus – ${report.org} – ${report.className} – ${report.title}${report.footer ? ` – ${report.footer}` : ''}`), M, PH - 8, { baseline: 'middle' })
    doc.text(`${p - firstPage + 1} / ${pages - firstPage + 1}`, PW - M, PH - 8, { baseline: 'middle', align: 'right' })
  }
}

// Every table on one sheet per table, under the same heading as the PDF.
export function reportSheets(report) {
  return report.tables.map((table, i) => {
    const rows = [[{ v: report.orgName || report.org, style: 'label' }], [{ v: report.title, style: 'title' }]]
    if (report.subtitle) rows.push([{ v: report.subtitle, style: 'label' }])
    rows.push([{ v: 'Classe', style: 'label' }, null, report.className])
    for (const [label, value] of report.meta) rows.push([{ v: label, style: 'label' }, null, value])
    rows.push([])
    if (table.title) rows.push([{ v: table.title, style: 'label' }])
    rows.push(table.columns.map((c) => ({ v: c.label, style: 'head' })))
    const freeze = rows.length
    for (const row of table.rows) {
      rows.push(
        row.map((v, k) => {
          const type = table.columns[k].type
          if (type === 'mark') return v ? { v: 'X', style: 'center' } : ''
          if (type === 'pct') return typeof v === 'number' ? { v, style: 'pct' } : ''
          return typeof v === 'string' && v.includes('\n') ? { v, style: 'wrap' } : v
        }),
      )
    }
    if (!table.rows.length) rows.push([table.empty || 'Aucune donnée.'])
    if (i === report.tables.length - 1 && report.notes.length) rows.push([], ...report.notes.map((n) => [n]))
    return { name: table.title || report.title, rows, freeze, landscape: report.landscape, widths: table.columns.map((c) => Math.max(8, Math.round(c.width / 1.9))) }
  })
}

export const buildExcel = (report) => buildXlsx(reportSheets(report))

function save(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

export async function downloadPdf(report) {
  const doc = await buildPdf(report)
  save(doc.output('blob'), `${report.fileName}.pdf`)
}

export function downloadExcel(report) {
  save(new Blob([buildExcel(report)], { type: XLSX_TYPE }), `${report.fileName}.xlsx`)
}

// Prints the PDF itself, so what comes out is the same on every device. A
// phone's browser can't print a hidden page: there, the PDF opens instead.
export async function printReport(report) {
  const touch = window.matchMedia?.('(pointer: coarse)').matches
  // Opened during the click, or the browser blocks it.
  const tab = touch ? window.open('', '_blank') : null
  const doc = await buildPdf(report)
  if (touch) {
    const url = URL.createObjectURL(doc.output('blob'))
    if (tab) tab.location = url
    else save(doc.output('blob'), `${report.fileName}.pdf`)
    setTimeout(() => URL.revokeObjectURL(url), 120000)
    return
  }
  const url = URL.createObjectURL(doc.output('blob'))
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0'
  frame.src = url
  frame.onload = () => {
    try {
      frame.contentWindow.focus()
      frame.contentWindow.print()
    } catch {
      window.open(url, '_blank')
    }
  }
  document.body.append(frame)
  setTimeout(() => {
    frame.remove()
    URL.revokeObjectURL(url)
  }, 180000)
}
