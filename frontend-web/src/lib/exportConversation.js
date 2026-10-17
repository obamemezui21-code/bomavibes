// "Télécharger la conversation": the whole chat as a plain-text file, one
// line per message, like WhatsApp's export.
import { messagePreviewText } from './messagePreview.js'

const pad = (n) => String(n).padStart(2, '0')

export function formatStamp(date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// The text of one message; media keep their link so they can still be opened.
function body(m) {
  const link = m.fileUrl || m.audioUrl || m.stickerUrl || null
  if (m.type === 'text' || !m.type) return m.text || ''
  if (m.type === 'compliment') return `💬 Compliment${m.about ? ` (sur « ${m.about} »)` : ''} : ${m.text || ''}`
  if (m.type === 'venue-invite' && m.venue) return `📍 Invitation à un rendez-vous : ${m.venue.name}`
  if (m.type === 'location' && m.location) {
    return `📍 Position : https://maps.google.com/?q=${m.location.lat},${m.location.lng}`
  }
  const preview = messagePreviewText(m)
  return link ? `${preview} — ${link}` : preview
}

/**
 * @param {object[]} messages - { senderId, type, text, date, … } oldest first
 * @param {{ myId: string, myName: string, otherName: string }} people
 * @returns {string}
 */
export function conversationToText(messages, { myId, myName, otherName }) {
  const lines = [
    `Conversation BomaVibes entre ${myName || 'Moi'} et ${otherName || 'mon match'}`,
    `Exportée le ${formatStamp(new Date())} — ${messages.length} message${messages.length > 1 ? 's' : ''}`,
    '',
  ]
  for (const m of messages) {
    const who = m.senderId === myId ? myName || 'Moi' : otherName || 'Match'
    const text = body(m).replace(/\r?\n/g, '\n    ')
    lines.push(`[${formatStamp(m.date)}] ${who} : ${text}${m.edited ? ' (modifié)' : ''}`)
  }
  return lines.join('\n') + '\n'
}

export function exportFileName(otherName, date = new Date()) {
  const safe =
    (otherName || 'match')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'match'
  return `BomaVibes_${safe}_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.txt`
}
