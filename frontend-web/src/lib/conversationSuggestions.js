// Bomavibes conversation-helper engine — powers the "Idées pour continuer
// la conversation" bar in the chat. Available for the whole conversation,
// not just before the first message: helps break the ice AND revives
// a conversation that's stalling.
//
// Architecture:
//   - BY_INTEREST: interest-linked question pools, keyed by the exact tag
//     strings from lib/interests.js, each tagged with a CATEGORY.
//   - GENERIC: category-only pools used as filler / for matches with no
//     shared interests.
//   - CATEGORIES: the filter chips shown in the UI.
//   - getSuggestions(): selection algorithm. Personalizes off interests
//     shared by both profiles, prioritizing them over generic questions;
//     supports category filtering; accepts `excludeTexts` (already-sent
//     messages + already-shown suggestions, see suggestionHistory.js) to
//     avoid repeats; `seed` lets the caller force a different pick (the
//     🔄 refresh button bumps it).
//
// To add a question: append it to an existing pool below (BY_INTEREST or
// GENERIC). To add a whole new interest: add a `TagName: {...}` entry to
// BY_INTEREST (tag must match lib/interests.js). To add a new category:
// add it to CATEGORY + CATEGORIES, then start tagging questions with it —
// nothing else in this file or in Chat.jsx needs to change.

export const CATEGORY = {
  CONNAITRE: 'connaitre',
  INTERET: 'interet',
  VOYAGE: 'voyage',
  FUN: 'fun',
  PROFOND: 'profond',
}

export const CATEGORIES = [
  { id: CATEGORY.CONNAITRE, label: 'Faire connaissance', icon: '❤️' },
  { id: CATEGORY.INTERET, label: 'Centres d’intérêt', icon: '🎵' },
  { id: CATEGORY.VOYAGE, label: 'Voyage', icon: '✈️' },
  { id: CATEGORY.FUN, label: 'Fun', icon: '😂' },
  { id: CATEGORY.PROFOND, label: 'Profond', icon: '🧠' },
]

const BY_INTEREST = {
  Voyages: {
    category: CATEGORY.VOYAGE,
    questions: [
      { icon: '✈️', text: 'Quel est le plus beau pays que tu as visité ?' },
      { icon: '🧳', text: 'Ta prochaine destination de rêve, c’est laquelle ?' },
      { icon: '🗺️', text: 'Quel endroit aimerais-tu absolument visiter ?' },
    ],
  },
  Randonnée: {
    category: CATEGORY.VOYAGE,
    questions: [{ icon: '⛰️', text: 'La plus belle randonnée que tu aies faite ?' }],
  },
  Nature: {
    category: CATEGORY.VOYAGE,
    questions: [{ icon: '🌿', text: 'Montagne, plage ou forêt — ton terrain de jeu préféré ?' }],
  },
  Sport: {
    category: CATEGORY.INTERET,
    questions: [{ icon: '🏋️', text: 'Quel sport te passionne le plus ?' }],
  },
  Fitness: {
    category: CATEGORY.INTERET,
    questions: [{ icon: '💪', text: 'Salle de sport, course ou yoga — ton entraînement préféré ?' }],
  },
  Football: {
    category: CATEGORY.INTERET,
    questions: [{ icon: '⚽', text: 'Quelle équipe tu supportes à fond ?' }],
  },
  Cuisine: {
    category: CATEGORY.INTERET,
    questions: [
      { icon: '🍝', text: 'Quel est ton plat préféré à préparer ?' },
      { icon: '🍲', text: 'Le meilleur repas que tu aies mangé récemment, c’était où ?' },
    ],
  },
  Cinéma: {
    category: CATEGORY.INTERET,
    questions: [
      { icon: '🎬', text: 'Quel film pourrais-tu regarder encore et encore ?' },
      { icon: '🍿', text: 'Plutôt cinéma ou soirée film à la maison ?' },
    ],
  },
  Musique: {
    category: CATEGORY.INTERET,
    questions: [
      { icon: '🎵', text: 'Quel artiste tourne en boucle chez toi en ce moment ?' },
      { icon: '🎧', text: 'Quel est ton style de musique préféré ?' },
    ],
  },
  Lecture: {
    category: CATEGORY.INTERET,
    questions: [{ icon: '📚', text: 'Le dernier livre qui t’a marqué·e, c’était quoi ?' }],
  },
  Danse: {
    category: CATEGORY.INTERET,
    questions: [{ icon: '💃', text: 'Tu danses plutôt sur quel style de musique ?' }],
  },
  Photo: {
    category: CATEGORY.INTERET,
    questions: [{ icon: '📸', text: 'Ta plus belle photo, tu l’as prise où ?' }],
  },
  Art: {
    category: CATEGORY.INTERET,
    questions: [{ icon: '🎨', text: 'Un artiste ou une œuvre qui t’inspire particulièrement ?' }],
  },
  Café: {
    category: CATEGORY.INTERET,
    questions: [{ icon: '☕', text: 'Tu commandes quoi en arrivant dans un café ?' }],
  },
  Mode: {
    category: CATEGORY.INTERET,
    questions: [{ icon: '👗', text: 'Comment décrirais-tu ton style en trois mots ?' }],
  },
  Business: {
    category: CATEGORY.INTERET,
    questions: [{ icon: '💼', text: 'Sur quel projet tu travailles en ce moment ?' }],
  },
  Technologie: {
    category: CATEGORY.INTERET,
    questions: [{ icon: '💻', text: 'La dernière techno qui t’a bluffé·e ?' }],
  },
  Entrepreneuriat: {
    category: CATEGORY.INTERET,
    questions: [{ icon: '🚀', text: 'Si tu lançais un projet demain, ce serait quoi ?' }],
  },
  'Jeux vidéo': {
    category: CATEGORY.INTERET,
    questions: [{ icon: '🎮', text: 'Ton jeu du moment, c’est lequel ?' }],
  },
  'Culture africaine': {
    category: CATEGORY.INTERET,
    questions: [{ icon: '🌍', text: 'Une tradition ou un lieu que tu adores partager ?' }],
  },
  Spiritualité: {
    category: CATEGORY.PROFOND,
    questions: [{ icon: '✨', text: 'Qu’est-ce qui te ressource le plus au quotidien ?' }],
  },
  Famille: {
    category: CATEGORY.CONNAITRE,
    questions: [{ icon: '👨‍👩‍👧', text: 'Le meilleur souvenir en famille qui te vient en tête ?' }],
  },
}

const GENERIC = {
  [CATEGORY.CONNAITRE]: [
    { icon: '🌟', text: 'Quelle est la meilleure décision que tu as prise cette année ?' },
    { icon: '💫', text: 'Quel est ton plus grand rêve ?' },
    { icon: '😄', text: 'Qu’est-ce qui te fait rire facilement ?' },
    { icon: '🏡', text: 'Tu es plutôt casanier·ère ou toujours dehors ?' },
  ],
  [CATEGORY.VOYAGE]: [{ icon: '🗺️', text: 'Si tu pouvais partir demain n’importe où, tu irais où ?' }],
  [CATEGORY.FUN]: [
    { icon: '🌙', text: 'Tu préfères les soirées tranquilles ou les aventures improvisées ?' },
    { icon: '😂', text: 'Quelle est la chose la plus drôle qui t’est arrivée récemment ?' },
    { icon: '🎭', text: 'Un talent caché que personne ne soupçonne chez toi ?' },
  ],
  [CATEGORY.PROFOND]: [
    { icon: '🤝', text: 'Quelle qualité apprécies-tu le plus chez quelqu’un ?' },
    { icon: '🔥', text: 'Qu’est-ce qui te motive le plus en ce moment ?' },
    { icon: '🧭', text: 'Où est-ce que tu te vois dans quelques années ?' },
  ],
  [CATEGORY.INTERET]: [{ icon: '🎨', text: 'Qu’est-ce que tu fais pour te changer les idées ?' }],
}

function normalize(text) {
  return (text || '').trim().toLowerCase()
}

// Deterministic-but-seedable pick (not Math.random) so refreshing (seed++)
// reliably changes the result, and re-rendering without a refresh doesn't
// reshuffle the suggestions under the user.
function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

// Which shared interests have never surfaced a suggestion yet in this
// conversation — those are prioritized first, per "centres d'intérêt qui
// n'ont pas encore été abordés".
function rankSharedInterests(shared, excludedNorm) {
  return [...shared].sort((a, b) => {
    const aTouched = BY_INTEREST[a].questions.some((q) => excludedNorm.has(normalize(q.text)));
    const bTouched = BY_INTEREST[b].questions.some((q) => excludedNorm.has(normalize(q.text)));
    return aTouched === bTouched ? 0 : aTouched ? 1 : -1;
  })
}

function buildPool(theirInterests, myInterests, category, excludedNorm) {
  const shared = theirInterests.filter((i) => myInterests.includes(i) && BY_INTEREST[i])
  const relevantShared = category ? shared.filter((i) => BY_INTEREST[i].category === category) : shared
  const rankedShared = rankSharedInterests(relevantShared, excludedNorm)

  const personalized = []
  rankedShared.forEach((interest) => {
    const entry = BY_INTEREST[interest]
    entry.questions.forEach((q) => personalized.push({ ...q, category: entry.category, interest }))
  })

  const generic = []
  const categoriesToFill = category ? [category] : Object.values(CATEGORY)
  categoriesToFill.forEach((cat) => {
    ;(GENERIC[cat] || []).forEach((q) => generic.push({ ...q, category: cat, interest: null }))
  })

  // Shared-interest questions first (and among those, untouched interests
  // first), generic ones fill in the rest.
  return [...personalized, ...generic]
}

/**
 * @param {object} params
 * @param {string} params.matchId - stable per-conversation seed
 * @param {string[]} params.myInterests
 * @param {string[]} params.theirInterests
 * @param {string|null} params.category - filter to one category, or null for a smart blend
 * @param {string[]} params.excludeTexts - already-sent messages + already-shown suggestions
 * @param {number} params.seed - bump to force a different pick (refresh button)
 * @param {number} params.max - how many to return (2-5)
 */
export function getSuggestions({
  matchId = 'default',
  myInterests = [],
  theirInterests = [],
  category = null,
  excludeTexts = [],
  seed = 0,
  max = 4,
} = {}) {
  const excludedNorm = new Set(excludeTexts.map(normalize))
  const pool = buildPool(theirInterests, myInterests, category, excludedNorm)
  const available = pool.filter((q) => !excludedNorm.has(normalize(q.text)))
  // Long conversation exhausted the pool? Reuse rather than show nothing —
  // an occasional repeat beats an empty helper.
  const source = available.length >= max ? available : pool

  const start = source.length ? hashString(`${matchId}-${category || 'mix'}-${seed}`) % source.length : 0
  const ordered = source.slice(start).concat(source.slice(0, start))

  const picked = []
  const seenText = new Set()
  for (const q of ordered) {
    const key = normalize(q.text)
    if (seenText.has(key)) continue
    seenText.add(key)
    picked.push(q)
    if (picked.length >= max) break
  }
  return picked
}

// Which category chips are worth showing for this match — capped at 3 to
// stay compact (spec: "rester discret"). Shared-interest-backed categories
// surface first since they're the most relevant to these two people.
export function getRelevantCategories(myInterests = [], theirInterests = []) {
  const shared = theirInterests.filter((i) => myInterests.includes(i) && BY_INTEREST[i])
  const sharedCategoryIds = new Set(shared.map((i) => BY_INTEREST[i].category))
  const prioritized = CATEGORIES.filter((c) => sharedCategoryIds.has(c.id))
  const rest = CATEGORIES.filter((c) => !sharedCategoryIds.has(c.id))
  return [...prioritized, ...rest].slice(0, 3)
}
