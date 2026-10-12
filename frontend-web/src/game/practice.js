// Practice mode, shared by the games: a run played for training only. It
// never reaches the server (no Ngori, no daily cap, no leaderboard), so its
// seed is drawn here and its result is the engine's own replay of the
// gestures, computed in the browser.
export function practiceSeed() {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]
}

export const practiceId = () => `practice-${Date.now()}`
