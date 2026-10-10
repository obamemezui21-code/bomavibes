import {
  Activity,
  BookOpen,
  Briefcase,
  Camera,
  ChefHat,
  Clapperboard,
  Coffee,
  Cpu,
  Dumbbell,
  Gamepad2,
  Globe,
  Leaf,
  Mountain,
  Music,
  Palette,
  PersonStanding,
  Plane,
  Rocket,
  Shirt,
  Sparkles,
  Tag,
  Trophy,
  Users,
} from 'lucide-react'

export const INTEREST_ICONS = {
  Danse: PersonStanding,
  Cuisine: ChefHat,
  Voyages: Plane,
  Musique: Music,
  Sport: Dumbbell,
  Cinéma: Clapperboard,
  Lecture: BookOpen,
  Photo: Camera,
  Nature: Leaf,
  Art: Palette,
  Café: Coffee,
  Randonnée: Mountain,
  Mode: Shirt,
  Business: Briefcase,
  Football: Trophy,
  Fitness: Activity,
  Technologie: Cpu,
  Entrepreneuriat: Rocket,
  'Jeux vidéo': Gamepad2,
  'Culture africaine': Globe,
  Spiritualité: Sparkles,
  Famille: Users,
}

export function iconForInterest(interest) {
  return INTEREST_ICONS[interest] || Tag
}

// Interest cards (components/InterestCard.jsx): a gradient per interest,
// until a photo is dropped in src/assets/interests/ named after the
// interest's slug (cinema.webp, jeux-video.webp, culture-africaine.webp…).
const INTEREST_GRADIENTS = {
  Danse: ['#f472b6', '#7c3aed'],
  Cuisine: ['#fb923c', '#be123c'],
  Voyages: ['#38bdf8', '#1e3a8a'],
  Musique: ['#a855f7', '#1e1b4b'],
  Sport: ['#22c55e', '#065f46'],
  Cinéma: ['#ef4444', '#450a0a'],
  Lecture: ['#d6a35c', '#78350f'],
  Photo: ['#64748b', '#0f172a'],
  Nature: ['#84cc16', '#14532d'],
  Art: ['#f59e0b', '#9d174d'],
  Café: ['#a16207', '#3b1d0b'],
  Randonnée: ['#2dd4bf', '#134e4a'],
  Mode: ['#ec4899', '#581c87'],
  Business: ['#475569', '#0b1120'],
  Football: ['#16a34a', '#052e16'],
  Fitness: ['#f97316', '#7f1d1d'],
  Technologie: ['#06b6d4', '#1e1b4b'],
  Entrepreneuriat: ['#eab308', '#7c2d12'],
  'Jeux vidéo': ['#8b5cf6', '#0c0a3e'],
  'Culture africaine': ['#f59e0b', '#14532d'],
  Spiritualité: ['#c4b5fd', '#4c1d95'],
  Famille: ['#fda4af', '#9f1239'],
}
const DEFAULT_GRADIENT = ['#8b5cf6', '#db2777']

export function interestSlug(interest) {
  return interest
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const INTEREST_PHOTOS = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/interests/*.{webp,jpg,jpeg,png}', { eager: true, import: 'default' })).map(
    ([path, url]) => [path.split('/').pop().replace(/\.\w+$/, ''), url],
  ),
)

export function interestVisual(interest) {
  const [from, to] = INTEREST_GRADIENTS[interest] || DEFAULT_GRADIENT
  return {
    Icon: iconForInterest(interest),
    gradient: `linear-gradient(145deg, ${from}, ${to})`,
    photo: INTEREST_PHOTOS[interestSlug(interest)] || null,
  }
}

export function matchPercent(myInterests, theirInterests) {
  if (!myInterests?.length || !theirInterests?.length) return null
  const shared = theirInterests.filter((i) => myInterests.includes(i)).length
  return Math.round((shared / Math.min(myInterests.length, theirInterests.length)) * 100)
}
