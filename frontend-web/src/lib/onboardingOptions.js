// Extra selectable options for onboarding, kept as flat data so new
// entries can be appended without touching any component logic.

export const LANGUAGES = [
  'Français', 'Anglais', 'Portugais', 'Arabe', 'Espagnol',
  'Fang', 'Lingala', 'Wolof', 'Bambara', 'Swahili', 'Yoruba', 'Haoussa',
  'Éwé', 'Peul', 'Berbère', 'Kikongo', 'Douala', 'Malinké',
]

export const PERSONALITY_TRAITS = [
  'Ambitieux', 'Créatif', 'Sociable', 'Introverti', 'Aventurier', 'Romantique',
  'Humour', 'Calme', 'Curieux', 'Entrepreneur', 'Passionné', 'Familial',
  'Optimiste', 'Travailleur',
]

export const MAX_PERSONALITY_TRAITS = 5

export const DATING_GOALS = [
  'Relation sérieuse', 'Mariage', 'Faire connaissance', 'Amitié',
  'Relation à distance', 'Rencontres culturelles', 'Partager des passions',
]

export const LIFESTYLE_GROUPS = [
  { key: 'sport', label: 'Sport', options: ['Sportif régulier', 'Occasionnel', 'Débutant'] },
  { key: 'travel', label: 'Voyage', options: ['Aime voyager', 'Préfère rester local', 'Découvrir de nouvelles cultures'] },
  { key: 'smoking', label: 'Tabac', options: ['Non-fumeur', 'Fumeur occasionnel', 'Fumeur'] },
  { key: 'alcohol', label: 'Alcool', options: ['Jamais', 'Occasionnel', 'Régulier'] },
]
