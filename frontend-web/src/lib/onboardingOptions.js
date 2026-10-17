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
  'Sortie', 'Discussion',
]

export const RELIGIONS = [
  'Christianisme', 'Islam', 'Judaïsme', 'Bouddhisme', 'Hindouisme',
  'Spiritualité', 'Autre', 'Sans religion',
]

export const LIFESTYLE_GROUPS = [
  { key: 'sport', label: 'Sport', options: ['Sportif régulier', 'Occasionnel', 'Débutant'] },
  { key: 'travel', label: 'Voyage', options: ['Aime voyager', 'Préfère rester local', 'Découvrir de nouvelles cultures'] },
  { key: 'smoking', label: 'Tabac', options: ['Non-fumeur', 'Fumeur occasionnel', 'Fumeur'] },
  { key: 'alcohol', label: 'Alcool', options: ['Jamais', 'Occasionnel', 'Régulier'] },
]

export const CHILDREN_OPTIONS = ["Pas d'enfant", "A des enfants", "Pas d'enfant, en veut", "A des enfants, en veut d'autres"]

// Profile prompts (question + short answer) shown on the profile sheet.
export const PROFILE_PROMPTS = [
  'Mon dimanche idéal à Libreville…',
  'Le plat qui me fait craquer…',
  'On va bien s\'entendre si…',
  'Ma plus grande fierté…',
  'Le son que je mets en boucle…',
  'Mon premier rendez-vous idéal…',
  'Je ne peux pas vivre sans…',
  'Ce qui me fait rire à coup sûr…',
  'Mon coin préféré au Gabon…',
  'Un truc que peu de gens savent sur moi…',
  'Dans 5 ans, je me vois…',
  'Mon red flag à moi…',
  'Le meilleur conseil qu\'on m\'ait donné…',
  'Je cherche quelqu\'un qui…',
]
export const MAX_PROFILE_PROMPTS = 3
export const PROMPT_ANSWER_MAX = 200

// Voice prompt: one recorded answer (VOICE_PROMPT_MAX_SECONDS at most) on
// the profile, set through the backend (voiceController.uploadVoicePrompt).
export const VOICE_PROMPTS = [
  'Dis bonjour avec ta plus belle voix…',
  'Raconte ton meilleur souvenir de vacances…',
  'Une expression de chez toi que tu adores…',
  'Ce qui te fait rire à coup sûr…',
  'Ton premier rendez-vous idéal…',
  'Chante-nous un petit morceau…',
]
export const VOICE_PROMPT_MAX_SECONDS = 30
