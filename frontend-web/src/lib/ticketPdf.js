// jsPDF and qrcode are loaded on demand (not static imports) so visitors who
// never download a ticket never pay for them in the main bundle — same
// lazy-loading philosophy as the per-route code splitting in App.jsx.
import logoUrl from '../assets/bomavibes-icon.webp'

const VIOLET_600 = [106, 70, 147] // #6a4693 — brand gradient start
const PINK_600 = [173, 47, 116] // #ad2f74 — brand gradient end
const INK = [38, 27, 40] // #261b28
const INK_SOFT = [99, 90, 101] // #635a65
const MINT_600 = [35, 122, 75] // #237a4b

function formatLongDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// jsPDF has no native gradient fill — faked with a run of thin vertical
// strips interpolated between two colors (the +0.4mm overlap avoids hairline
// white seams between strips from rounding).
function drawGradientRect(doc, x, y, w, h, [r1, g1, b1], [r2, g2, b2], steps = 48) {
  const stripW = w / steps
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    doc.setFillColor(Math.round(r1 + (r2 - r1) * t), Math.round(g1 + (g2 - g1) * t), Math.round(b1 + (b2 - b1) * t))
    doc.rect(x + stripW * i, y, stripW + 0.4, h, 'F')
  }
}

// Canvas re-encode so any source format (webp logo, whatever the QR lib
// hands back) becomes a plain PNG data URL jsPDF can embed reliably.
function loadImageAsPngDataUrl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = src
  })
}

export async function downloadTicketPdf(ticket) {
  const [{ jsPDF }, qrcodeModule, logoDataUrl] = await Promise.all([
    import('jspdf'),
    import('qrcode'),
    loadImageAsPngDataUrl(logoUrl).catch(() => null),
  ])
  const QRCode = qrcodeModule.default ?? qrcodeModule
  const qrDataUrl = await QRCode.toDataURL(`BOMAVIBES:${ticket.code}`, { margin: 0, width: 300, color: { dark: '#261b28' } })

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [210, 100] })
  const pageWidth = 210
  const pageHeight = 100
  const stubX = 142

  // Header band — brand gradient, logo badge, wordmark
  drawGradientRect(doc, 0, 0, pageWidth, 26, VIOLET_600, PINK_600)
  if (logoDataUrl) {
    doc.setFillColor(255, 255, 255)
    doc.circle(15, 13, 8, 'F')
    doc.addImage(logoDataUrl, 'PNG', 9, 7, 12, 12)
  }
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('BomaVibes', 28, 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text("Billet d'événement", 28, 18)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('RÉSERVATION CONFIRMÉE', pageWidth - 10, 14, { align: 'right' })

  // Body — event details
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(19)
  const titleLines = doc.splitTextToSize(ticket.event?.title || 'Événement', stubX - 20)
  doc.text(titleLines, 10, 42)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...INK_SOFT)
  let y = 42 + titleLines.length * 7 + 6
  if (ticket.event?.date) {
    doc.text(formatLongDate(ticket.event.date), 10, y)
    y += 7
  }
  if (ticket.event?.location) {
    doc.text(ticket.event.location, 10, y)
  }

  // Perforation with torn-edge notches
  doc.setFillColor(255, 255, 255)
  doc.circle(stubX, 26, 3.5, 'F')
  doc.circle(stubX, pageHeight, 3.5, 'F')
  doc.setDrawColor(210, 205, 212)
  doc.setLineDashPattern([2, 2], 0)
  doc.line(stubX, 30, stubX, pageHeight - 4)
  doc.setLineDashPattern([], 0)

  // Right stub
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...INK_SOFT)
  doc.text('PARTICIPANT', stubX + 8, 36)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...INK)
  doc.text(ticket.attendeeName || '—', stubX + 8, 43)

  doc.addImage(qrDataUrl, 'PNG', stubX + 8, 48, 28, 28)

  doc.setFont('courier', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...VIOLET_600)
  doc.text(ticket.code, stubX + 40, 62)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...INK_SOFT)
  doc.text('Scanne le QR ou présente ce code à l’entrée', stubX + 8, 82, { maxWidth: 52 })

  doc.setFillColor(...MINT_600)
  doc.roundedRect(stubX + 8, 87, 26, 6, 1.5, 1.5, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text('BILLET GRATUIT', stubX + 21, 91, { align: 'center' })

  const safeTitle = (ticket.event?.title || 'billet').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  doc.save(`bomavibes-${safeTitle}-${ticket.code}.pdf`)
}
