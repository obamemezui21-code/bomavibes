// Ephemeral messages — a conversation setting either member can turn on
// (backend/src/services/ephemeral.js has the same durations). While it's on,
// every new message carries an expiresAt: the app hides it then, and the
// server deletes it, with its photo, file or voice note.

const HOUR_S = 60 * 60

export const EPHEMERAL_OPTIONS = [
  { ttl: 0, label: 'Désactivés', hint: 'Les messages restent dans la conversation.' },
  { ttl: 24 * HOUR_S, label: '24 heures', hint: 'Les nouveaux messages disparaissent 24 heures après l’envoi.' },
  { ttl: 7 * 24 * HOUR_S, label: '7 jours', hint: 'Les nouveaux messages disparaissent 7 jours après l’envoi.' },
]

// What the conversation list and notifications show instead of the content.
export const EPHEMERAL_PREVIEW = '⏳ Message éphémère'

export function ephemeralLabel(ttl) {
  return EPHEMERAL_OPTIONS.find((o) => o.ttl === ttl)?.label || ''
}

// When a message sent now should disappear, or null when the setting is off.
export function expiryFor(ttl, now) {
  return ttl > 0 ? new Date(now + ttl * 1000) : null
}

export function isExpired(message, now) {
  return !!message.expiresAt && message.expiresAt.getTime() <= now
}

// "5 h", "2 j", "12 min" — shown next to the time of an ephemeral message.
export function remainingLabel(expiresAt, now) {
  const minutes = Math.max(1, Math.ceil((expiresAt.getTime() - now) / 60000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.ceil(minutes / 60)
  if (hours < 48) return `${hours} h`
  return `${Math.ceil(hours / 24)} j`
}

// The notice the server posts in the conversation when the setting changes.
export function ephemeralNotice(ttl, byMe, firstName) {
  const who = byMe ? 'Vous avez' : `${firstName || 'Votre match'} a`
  if (!ttl) return `${who} désactivé les messages éphémères.`
  return `${who} activé les messages éphémères : les nouveaux messages disparaissent après ${ephemeralLabel(ttl)}.`
}
