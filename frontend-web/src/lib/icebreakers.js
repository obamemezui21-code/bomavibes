// Icebreaker suggestions shown above the chat input for a brand-new match
// with no messages yet — helps people start with something better than
// "Salut, ça va ?". Personalized off interests shared by both profiles,
// with a universal fallback pool when there's no overlap.
//
// To add a question to an existing interest: append an entry to its array
// below (must use the exact tag strings from lib/interests.js — that's the
// same taxonomy users pick from in onboarding/profile).
// To support a brand-new interest tag: add a new `TagName: [...]` entry —
// nothing else needs to change, getIcebreakers() picks it up automatically.
// To add a universal fallback question: append to UNIVERSAL.
const BY_INTEREST = {
  Voyages: [
    { icon: '✈️', text: 'Quel est le plus beau pays que tu as visité ?' },
    { icon: '🧳', text: 'Ta prochaine destination de rêve, c’est laquelle ?' },
  ],
  Sport: [{ icon: '🏋️', text: 'Quel sport te passionne le plus ?' }],
  Fitness: [{ icon: '💪', text: 'Salle de sport, course ou yoga — ton entraînement préféré ?' }],
  Football: [{ icon: '⚽', text: 'Quelle équipe tu supportes à fond ?' }],
  Cuisine: [{ icon: '🍝', text: 'Quel est ton plat préféré à préparer ?' }],
  Cinéma: [{ icon: '🎬', text: 'Quel film pourrais-tu regarder encore et encore ?' }],
  Musique: [{ icon: '🎵', text: 'Quel artiste tourne en boucle chez toi en ce moment ?' }],
  Lecture: [{ icon: '📚', text: 'Le dernier livre qui t’a marqué·e, c’était quoi ?' }],
  Danse: [{ icon: '💃', text: 'Tu danses plutôt sur quel style de musique ?' }],
  Photo: [{ icon: '📸', text: 'Ta plus belle photo, tu l’as prise où ?' }],
  Nature: [{ icon: '🌿', text: 'Montagne, plage ou forêt — ton terrain de jeu préféré ?' }],
  Randonnée: [{ icon: '⛰️', text: 'La plus belle randonnée que tu aies faite ?' }],
  Art: [{ icon: '🎨', text: 'Un artiste ou une œuvre qui t’inspire particulièrement ?' }],
  Café: [{ icon: '☕', text: 'Tu commandes quoi en arrivant dans un café ?' }],
  Mode: [{ icon: '👗', text: 'Comment décrirais-tu ton style en trois mots ?' }],
  Business: [{ icon: '💼', text: 'Sur quel projet tu travailles en ce moment ?' }],
  Technologie: [{ icon: '💻', text: 'La dernière techno qui t’a bluffé·e ?' }],
  Entrepreneuriat: [{ icon: '🚀', text: 'Si tu lançais un projet demain, ce serait quoi ?' }],
  'Jeux vidéo': [{ icon: '🎮', text: 'Ton jeu du moment, c’est lequel ?' }],
  'Culture africaine': [{ icon: '🌍', text: 'Une tradition ou un lieu que tu adores partager ?' }],
  Spiritualité: [{ icon: '✨', text: 'Qu’est-ce qui te ressource le plus au quotidien ?' }],
  Famille: [{ icon: '👨‍👩‍👧', text: 'Le meilleur souvenir en famille qui te vient en tête ?' }],
}

const UNIVERSAL = [
  { icon: '🌟', text: 'Quelle est la meilleure décision que tu as prise cette année ?' },
  { icon: '🗺️', text: 'Si tu pouvais partir demain n’importe où, tu irais où ?' },
  { icon: '💫', text: 'Quel est ton plus grand rêve ?' },
  { icon: '🌙', text: 'Tu préfères les soirées tranquilles ou les aventures improvisées ?' },
]

// Small deterministic hash so the pick for a given match stays stable
// across re-renders/remounts instead of reshuffling every time, while
// still varying between different matches/interests.
function pickIndex(seed, length) {
  let h = 0
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) | 0
  }
  return Math.abs(h) % length
}

export function getIcebreakers({ matchId = 'default', myInterests = [], theirInterests = [], max = 4 } = {}) {
  const shared = theirInterests.filter((interest) => myInterests.includes(interest) && BY_INTEREST[interest])
  const suggestions = []
  const usedTexts = new Set()

  shared.forEach((interest) => {
    const pool = BY_INTEREST[interest]
    const pick = pool[pickIndex(`${matchId}-${interest}`, pool.length)]
    if (pick && !usedTexts.has(pick.text)) {
      suggestions.push(pick)
      usedTexts.add(pick.text)
    }
  })

  let i = pickIndex(matchId, UNIVERSAL.length)
  let guard = 0
  while (suggestions.length < max && guard < UNIVERSAL.length * 2) {
    const candidate = UNIVERSAL[i % UNIVERSAL.length]
    i += 1
    guard += 1
    if (!usedTexts.has(candidate.text)) {
      suggestions.push(candidate)
      usedTexts.add(candidate.text)
    }
  }

  return suggestions.slice(0, max)
}
