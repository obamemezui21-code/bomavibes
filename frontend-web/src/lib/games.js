import kevinPortrait from '../assets/game/kevin.webp'
import aichaPortrait from '../assets/game/aicha.webp'
import motoKevin from '../assets/game/moto-kevin.webp'
import motoAicha from '../assets/game/moto-aicha.webp'

// Every game of the "Jeux" module (pages/Games.jsx), in display order. A new
// game only needs its entry here (and its route in App.jsx) to show up.
//   pictures: Kévin's then Aïcha's, as shown on the card (round: portraits in medallions)
//   dailyCap: Ngori it can earn per day (each game has its own cap)
//   isNew: shows a "Nouveau" badge
export const GAMES = [
  {
    id: 'vibe-check',
    name: 'Vibe Check',
    tagline: 'Le match à l’aveugle',
    description: '8 questions « ceci ou cela » par jour. Découvre avec qui tu as le plus de vibe, photo cachée, et matche sur la personnalité !',
    path: '/vibe-check',
    pictures: [kevinPortrait, aichaPortrait],
    round: true,
    gradient: 'from-[#3b0f5c] via-[#7e3a7f] to-[#dd88cf]',
    accent: 'text-heart-300',
    dailyCap: 3,
    isNew: true,
  },
  {
    id: 'mot-du-jour',
    name: 'Le Mot du Jour',
    tagline: 'Un mot à trouver chaque jour',
    description: 'Devine le mot du jour en 6 essais : nature, villes, cuisine et expressions du Gabon. Le même pour tout le monde !',
    path: '/mot-du-jour',
    pictures: [kevinPortrait, aichaPortrait],
    round: true,
    gradient: 'from-[#0b4d33] via-[#13784a] to-[#1d5fa8]',
    accent: 'text-[#fcd116]',
    dailyCap: 3,
    isNew: true,
  },
  {
    id: 'moto-boma',
    name: 'Moto Boma',
    tagline: 'Course de moto dans Libreville',
    description: 'Faufile-toi entre les voitures et les bus, nitro à fond, et bats le chrono. Défie tes matchs en duel fantôme !',
    path: '/moto-boma',
    pictures: [motoKevin, motoAicha],
    gradient: 'from-[#12081f] via-[#3b0f5c] to-[#0e7490]',
    accent: 'text-cyan-300',
    dailyCap: 5,
    isNew: true,
  },
  {
    id: 'ngori-run',
    name: 'NGORI RUN',
    tagline: 'Course à pied au bord de mer',
    description: 'Cours, saute, glisse, esquive les taxis et ramasse des Ngori de Louis jusqu’au Cap Estérias.',
    path: '/ngori-run',
    pictures: [kevinPortrait, aichaPortrait],
    round: true,
    gradient: 'from-[#2a0f45] via-[#5b1f6e] to-[#e9467d]',
    accent: 'text-gold',
    dailyCap: 5,
  },
]
