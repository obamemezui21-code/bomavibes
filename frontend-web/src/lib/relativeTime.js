// Same tiering style as ConversationsContext.jsx's formatLastSeen, generalized
// for feed posts/comments which need day/week granularity too, not just "today".
export function formatRelativeTime(timestamp, now = Date.now()) {
  const ms = timestamp?.toMillis?.() ?? null
  if (!ms) return ''
  const diffMin = Math.floor((now - ms) / 60000)
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `Il y a ${diffMin} min`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `Il y a ${diffHour} h`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `Il y a ${diffDay} j`
  return new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
