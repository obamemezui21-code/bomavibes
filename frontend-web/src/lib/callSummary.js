// Call history entries in a conversation (messages of type 'call', written
// by the caller when a call ends — see CallContext.jsx).
//
// message.call = { type: 'audio' | 'video', outcome, duration (seconds) }
// outcome: 'completed' | 'missed' | 'cancelled' | 'declined' | 'busy' | 'failed'

const MISSED_FOR_CALLEE = ['missed', 'cancelled', 'busy']

export function formatCallDuration(seconds) {
  const total = Math.max(0, Math.round(seconds || 0))
  if (total < 60) return `${total} s`
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')}`
  return s ? `${m} min ${s} s` : `${m} min`
}

// Label from the viewer's point of view: the caller sees "sortant" /
// "sans réponse", the person called sees "entrant" / "manqué".
export function callLabel(call, fromMe) {
  const kind = call?.type === 'video' ? 'vidéo' : 'audio'
  switch (call?.outcome) {
    case 'completed':
      return `Appel ${kind} ${fromMe ? 'sortant' : 'entrant'}`
    case 'declined':
      return `Appel ${kind} refusé`
    case 'busy':
      return fromMe ? 'Occupé·e sur un autre appel' : `Appel ${kind} manqué`
    case 'failed':
      return `Appel ${kind} interrompu`
    case 'missed':
    case 'cancelled':
    default:
      return fromMe ? `Appel ${kind} sans réponse` : `Appel ${kind} manqué`
  }
}

export function isMissedCall(call, fromMe) {
  return !fromMe && MISSED_FOR_CALLEE.includes(call?.outcome)
}

// Neutral one-liner stored as the conversation's last message (seen by both
// sides, so it can't say "sortant"/"entrant").
export function callPreview(call) {
  const icon = call?.type === 'video' ? '🎥' : '📞'
  const kind = call?.type === 'video' ? 'vidéo' : 'audio'
  if (call?.outcome === 'completed') return `${icon} Appel ${kind} · ${formatCallDuration(call.duration)}`
  if (call?.outcome === 'declined') return `${icon} Appel ${kind} refusé`
  if (call?.outcome === 'failed') return `${icon} Appel ${kind} interrompu`
  return `${icon} Appel ${kind} manqué`
}
