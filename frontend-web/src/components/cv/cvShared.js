import { inputClass } from '../../lib/formStyles.js'
import { GABON_LANGUAGES } from '../../lib/gabonLanguages.js'

// Shared by the CV PNPE screens (pages/CvBuilder.jsx, components/cv/*).

export const NIVEAUX = ['maternel', 'courant', 'bon', 'moyen', 'notions']

export const LANGUES_MONDE = ['Français', 'Anglais', 'Espagnol', 'Portugais', 'Arabe', 'Chinois', 'Allemand', 'Italien', 'Lingala', 'Swahili']

// Languages of Gabon: lib/gabonLanguages.js, shared with the dating profile.
export const LANGUES_GABON = GABON_LANGUAGES

export const LANGUES = [...LANGUES_MONDE, ...LANGUES_GABON]

export const PERMIS = ['Aucun', 'Permis A', 'Permis B', 'Permis C', 'Permis D', 'Permis E']

// [for a man, for a woman]: shown after the member's profile.
export const JOB_TITLES = [
  ['Caissier', 'Caissière'],
  ['Vendeur', 'Vendeuse'],
  ['Commercial', 'Commerciale'],
  ['Secrétaire', 'Secrétaire'],
  ['Assistant administratif', 'Assistante administrative'],
  ['Comptable', 'Comptable'],
  ['Agent d’accueil', 'Hôtesse d’accueil'],
  ['Chauffeur livreur', 'Chauffeuse livreuse'],
  ['Agent de sécurité', 'Agente de sécurité'],
  ['Technicien de maintenance', 'Technicienne de maintenance'],
  ['Électricien', 'Électricienne'],
  ['Opérateur de production', 'Opératrice de production'],
  ['Magasinier', 'Magasinière'],
  ['Informaticien', 'Informaticienne'],
  ['Serveur', 'Serveuse'],
  ['Cuisinier', 'Cuisinière'],
  ['Infirmier', 'Infirmière'],
  ['Enseignant', 'Enseignante'],
  ['Agent d’entretien', 'Agente d’entretien'],
  ['Community manager', 'Community manager'],
]

export const ACTION_VERBS = ['Accueillir', 'Gérer', 'Vendre', 'Tenir', 'Assurer', 'Contrôler', 'Préparer', 'Organiser', 'Rédiger', 'Conseiller', 'Livrer', 'Nettoyer', 'Réparer', 'Installer', 'Superviser', 'Former', 'Saisir', 'Classer', 'Conduire', 'Encaisser']

export const DIPLOMAS = ['BEPC', 'Bac', 'CAP', 'BT', 'BTS', 'DUT', 'Licence', 'Master', 'Doctorat', 'Certificat', 'Attestation de formation']

export const SCHOOLS = [
  'Université Omar Bongo (UOB)',
  'Université des Sciences et Techniques de Masuku (USTM)',
  'Université des Sciences de la Santé (USS)',
  'Institut National des Sciences de Gestion (INSG)',
  'École Normale Supérieure (ENS)',
  'École Normale Supérieure de l’Enseignement Technique (ENSET)',
  'École Polytechnique de Masuku (EPM)',
]

const THIS_YEAR = new Date().getFullYear()
export const YEARS = Array.from({ length: THIS_YEAR - 1959 }, (_, i) => String(THIS_YEAR - i))

export const textareaClass = `${inputClass} min-h-24 resize-y leading-relaxed`

export const lines = (text) =>
  String(text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

export const capitalizeWord = (word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word)
