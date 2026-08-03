import {
  BookOpen,
  Briefcase,
  Camera,
  ChefHat,
  Clapperboard,
  Coffee,
  Dumbbell,
  Leaf,
  Mountain,
  Music,
  Palette,
  PersonStanding,
  Plane,
  Shirt,
  Tag,
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
}

export function iconForInterest(interest) {
  return INTEREST_ICONS[interest] || Tag
}

export function matchPercent(myInterests, theirInterests) {
  if (!myInterests?.length || !theirInterests?.length) return null
  const shared = theirInterests.filter((i) => myInterests.includes(i)).length
  return Math.round((shared / Math.min(myInterests.length, theirInterests.length)) * 100)
}
