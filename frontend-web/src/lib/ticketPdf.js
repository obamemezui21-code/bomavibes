// jsPDF is loaded on demand (not a static import) so visitors who never
// download a ticket never pay for it in the main bundle — same
// lazy-loading philosophy as the per-route code splitting in App.jsx.

function formatLongDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export async function downloadTicketPdf(ticket) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [210, 100] })

  const pageWidth = 210
  const pageHeight = 100

  // Header band
  doc.setFillColor(139, 92, 246) // violet-500
  doc.rect(0, 0, pageWidth, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('BomaVibes', 10, 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text("Billet d'événement", pageWidth - 10, 14, { align: 'right' })

  // Event info
  doc.setTextColor(20, 20, 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(ticket.event?.title || 'Événement', 10, 38)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(90, 90, 90)
  let y = 48
  if (ticket.event?.date) {
    doc.text(formatLongDate(ticket.event.date), 10, y)
    y += 7
  }
  if (ticket.event?.location) {
    doc.text(ticket.event.location, 10, y)
  }

  // Perforation line
  doc.setDrawColor(200, 200, 200)
  doc.setLineDashPattern([2, 2], 0)
  doc.line(140, 5, 140, pageHeight - 5)
  doc.setLineDashPattern([], 0)

  // Attendee + code (right stub)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(140, 140, 140)
  doc.text('PARTICIPANT', 150, 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(20, 20, 20)
  doc.text(ticket.attendeeName || '—', 150, 28)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(140, 140, 140)
  doc.text('CODE BILLET', 150, 50)
  doc.setFont('courier', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(139, 92, 246)
  doc.text(ticket.code, 150, 62)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text('Réservation gratuite — présente ce billet à l’entrée.', 150, pageHeight - 8)

  const safeTitle = (ticket.event?.title || 'billet').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  doc.save(`bomavibes-${safeTitle}-${ticket.code}.pdf`)
}
