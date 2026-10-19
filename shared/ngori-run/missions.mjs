// NGORI RUN — the daily missions, shared by the app and the server.
//
// Every day the same three missions for everyone (one easy, one medium, one
// hard), picked from the date. Progress only moves on runs the server has
// replayed (ngoriRunController.js), so the figures come from the engine's
// summarize(): a mission can't be ticked off by a forged request.
//
// metric: a field of summarize() (games = 1 per run)
// mode:   'sum' adds up over the day's runs, 'max' needs it in a single run

export const MISSION_TIERS = ['Facile', 'Moyenne', 'Difficile']

export const MISSIONS = [
  { id: 'games3', tier: 0, metric: 'games', mode: 'sum', goal: 3, emoji: '🎮', label: 'Joue 3 courses' },
  { id: 'dist800', tier: 0, metric: 'distance', mode: 'max', goal: 800, emoji: '🏃', label: 'Cours 800 m en une course' },
  { id: 'coins15', tier: 0, metric: 'coins', mode: 'sum', goal: 15, emoji: '🪙', label: 'Ramasse 15 Ngori sur la route' },
  { id: 'fly2', tier: 0, metric: 'flights', mode: 'sum', goal: 2, emoji: '🦅', label: "Envole-toi 2 fois en oiseau" },
  { id: 'combo8', tier: 0, metric: 'bestCombo', mode: 'max', goal: 8, emoji: '🔥', label: 'Fais un combo de 8' },

  { id: 'river1', tier: 1, metric: 'rivers', mode: 'sum', goal: 1, emoji: '🌊', label: 'Traverse une rivière' },
  { id: 'dist1500', tier: 1, metric: 'distance', mode: 'max', goal: 1500, emoji: '🏁', label: 'Cours 1 500 m en une course' },
  { id: 'total3k', tier: 1, metric: 'distance', mode: 'sum', goal: 3000, emoji: '👟', label: 'Cours 3 km au total' },
  { id: 'power3', tier: 1, metric: 'powerups', mode: 'sum', goal: 3, emoji: '⚡', label: 'Attrape 3 bonus' },
  { id: 'combo12', tier: 1, metric: 'bestCombo', mode: 'max', goal: 12, emoji: '🔥', label: 'Fais un combo de 12' },

  { id: 'river3', tier: 2, metric: 'rivers', mode: 'sum', goal: 3, emoji: '🐊', label: 'Traverse 3 rivières' },
  { id: 'dist2500', tier: 2, metric: 'distance', mode: 'max', goal: 2500, emoji: '🚀', label: 'Cours 2 500 m en une course' },
  { id: 'total6k', tier: 2, metric: 'distance', mode: 'sum', goal: 6000, emoji: '🗺️', label: 'Cours 6 km au total' },
  { id: 'smash3', tier: 2, metric: 'smashes', mode: 'sum', goal: 3, emoji: '🏍️', label: 'Renverse 3 obstacles à moto' },
  { id: 'combo20', tier: 2, metric: 'bestCombo', mode: 'max', goal: 20, emoji: '💥', label: 'Fais un combo de 20' },
]

// FNV-1a, then mulberry32 steps: the same pick on every device and on Node.
function hash(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0
  return h
}
function nextRandom(seed) {
  let t = (seed + 0x6d2b79f5) >>> 0
  const next = t
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [(t ^ (t >>> 14)) >>> 0, next]
}

// day: 'YYYY-MM-DD' (UTC, like the game's daily cap). One mission per tier,
// never two on the same metric and mode (no "800 m" next to "1 500 m").
// The hard one is drawn first so each hard mission comes up as often as the
// others (the ones left over after that rule would otherwise come up more).
export function missionsFor(day) {
  let seed = hash(`ngori-run:${day}`)
  const picked = []
  for (let tier = MISSION_TIERS.length - 1; tier >= 0; tier--) {
    const pool = MISSIONS.filter((m) => m.tier === tier && !picked.some((p) => p.metric === m.metric && p.mode === m.mode))
    let roll
    ;[roll, seed] = nextRandom(seed)
    picked.unshift(pool[roll % pool.length])
  }
  return picked
}

// The mission's progress once `run` (a summarize() result) is added.
export function progressAfter(mission, progress, run) {
  const value = mission.metric === 'games' ? 1 : run[mission.metric] || 0
  const next = mission.mode === 'sum' ? (progress || 0) + value : Math.max(progress || 0, value)
  return Math.min(next, mission.goal)
}

// The day's missions as the app shows them.
// saved: { progress: { [id]: number }, done: [id…] } for that day, or nothing.
export function missionsView(day, saved, rewards) {
  return missionsFor(day).map((m) => {
    const progress = saved?.progress?.[m.id] || 0
    return { id: m.id, tier: m.tier, metric: m.metric, mode: m.mode, goal: m.goal, emoji: m.emoji, label: m.label, reward: rewards[m.tier], progress, done: progress >= m.goal }
  })
}
