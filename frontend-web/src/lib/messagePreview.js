// Shared one-line preview text for a message — used for the conversation
// list's last-message line, the reply preview bar, and the quoted block
// rendered inside a reply. Keeps these three call sites in sync.
export function messagePreviewText(message) {
  if (!message) return ''
  if (message.type === 'voice') return '🎤 Message vocal'
  if (message.type === 'image') return '📷 Photo'
  if (message.type === 'file') return `📄 ${message.fileName || 'Document'}`
  if (message.type === 'sticker') return '😊 Sticker'
  if (message.type === 'post') return '📌 Publication partagée'
  return message.text || ''
}
