// Tracks which suggestion texts have already been shown/used per
// conversation, in localStorage, so getSuggestions() can avoid repeating
// itself across the whole conversation — not just within one render.
// Isolated on purpose: swapping this for a backend-synced store later
// (e.g. so history follows the user across devices) only touches this
// file, not the selection engine or the chat UI.
const STORAGE_PREFIX = 'bomavibes_suggestion_history_'
const MAX_ENTRIES = 60

export function getSuggestionHistory(matchId) {
  if (!matchId) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + matchId)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addToSuggestionHistory(matchId, texts) {
  if (!matchId || !texts?.length) return
  try {
    const existing = getSuggestionHistory(matchId)
    const next = [...existing, ...texts].slice(-MAX_ENTRIES)
    window.localStorage.setItem(STORAGE_PREFIX + matchId, JSON.stringify(next))
  } catch {
    // localStorage unavailable (private mode, quota exceeded) — history
    // just won't persist across reloads, not worth failing over for.
  }
}
