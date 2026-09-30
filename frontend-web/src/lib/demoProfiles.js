// Illustrative profiles for the public site (Hero, Découverte, app mockups,
// Welcome). Stock photos (Pexels) of models, not members — the Découverte
// section says so on screen. Sources live in src/assets/faces; the optimised
// crops in src/assets/people are what the site actually ships.
import aicha from '../assets/people/aicha.webp'
import ayo from '../assets/people/ayo.webp'
import grace from '../assets/people/grace.webp'
import ines from '../assets/people/ines.webp'
import kofi from '../assets/people/kofi.webp'
import mariam from '../assets/people/mariam.webp'
import nadege from '../assets/people/nadege.webp'
import serge from '../assets/people/serge.webp'
import zola from '../assets/people/zola.webp'

export const DEMO_PROFILES = {
  zola: { name: 'Zola', age: 26, city: 'Libreville', country: 'GA', photo: zola, match: 94, verified: true, interests: ['Voyages', 'Afrobeats', 'Cuisine'] },
  kofi: { name: 'Kofi', age: 33, city: 'Abidjan', country: 'CI', photo: kofi, match: 88, verified: true, interests: ['Entrepreneuriat', 'Football', 'Culture'] },
  mariam: { name: 'Mariam', age: 25, city: 'Dakar', country: 'SN', photo: mariam, match: 91, verified: true, interests: ['Mode', 'Danse', 'Famille'] },
  aicha: { name: 'Aïcha', age: 27, city: 'Paris', country: 'FR', photo: aicha, match: 89, verified: true, interests: ['Cinéma', 'Nature', 'Photo'] },
  serge: { name: 'Serge', age: 31, city: 'Port-Gentil', country: 'GA', photo: serge, match: 86, verified: false, interests: ['Musique', 'Randonnée', 'Café'] },
  ines: { name: 'Inès', age: 28, city: 'Douala', country: 'CM', photo: ines, match: 92, verified: true, interests: ['Art', 'Pagne', 'Lecture'] },
  nadege: { name: 'Nadège', age: 29, city: 'Libreville', country: 'GA', photo: nadege, match: 90, verified: true, interests: ['Voyages', 'Sport', 'Brunch'] },
  grace: { name: 'Grâce', age: 24, city: 'Brazzaville', country: 'CG', photo: grace, match: 87, verified: false, interests: ['Études', 'Rumba', 'Séries'] },
  ayo: { name: 'Ayo', age: 26, city: 'Lomé', country: 'TG', photo: ayo, match: 85, verified: true, interests: ['Poésie', 'Mode', 'Plage'] },
}

// Order used by the Découverte grid.
export const DISCOVER_ORDER = ['zola', 'kofi', 'mariam', 'aicha', 'serge', 'ines']
