// The "À la une" articles (backend headlinesService.js). Kept for a few minutes
// so going back and forth to Découvrir neither reloads them nor makes the
// slider blink; any failure just means no slider.
const KEEP_MS = 5 * 60 * 1000

let cache = null

export async function fetchHeadlines(now = Date.now()) {
  if (cache && now - cache.at < KEEP_MS) return cache.headlines
  try {
    const res = await fetch('/api/news/headlines')
    const body = res.ok ? await res.json() : null
    const headlines = Array.isArray(body?.headlines) ? body.headlines : []
    if (headlines.length) cache = { at: now, headlines }
    return headlines
  } catch {
    return cache?.headlines || []
  }
}
