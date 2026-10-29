import kevinPortrait from '../assets/game/kevin.webp'
import aichaPortrait from '../assets/game/aicha.webp'
import motoKevin from '../assets/game/moto-kevin.webp'
import motoAicha from '../assets/game/moto-aicha.webp'
import commandoMboumba from '../assets/game/commando-mboumba.webp'
import commandoMoussavou from '../assets/game/commando-moussavou.webp'
import commandoCover from '../assets/game/commando-cover.webp'

// Every game of the "Jeux" module (pages/Games.jsx), in display order. A new
// game only needs its entry here (and its route in App.jsx) to show up.
//   pictures: Kévin's then Aïcha's, as shown on the card (round: portraits in medallions)
//   dailyCap: Ngori it can earn per day (each game has its own cap)
//   isNew: shows a "Nouveau" badge
//   cover: optional artwork filling the card (the pictures are then left out)
export const GAMES = [
  {
    id: 'perles-punu',
    name: 'Perles Punu',
    tagline: 'Tir de perles le long du fleuve',
    description: 'Le masque Punu lance des perles : fais-en éclater 3 de la même couleur avant qu’elles n’atteignent la chute, de la Lopé à Kongou !',
    path: '/perles-punu',
    pictures: [],
    cover: '/perles/cover.svg',
    gradient: 'from-[#1f2a14] via-[#4c6a27] to-[#d98e1f]',
    accent: 'text-amber-300',
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
  {
    id: 'escadrille-ogooue',
    name: 'Escadrille Ogooué',
    tagline: 'Combat aérien au-dessus du Gabon',
    description: 'Pilote ton chasseur de la côte aux Monts de Cristal, abats drones, hélicos et avions pirates du Serpent Noir… jusqu’au Condor Noir !',
    path: '/escadrille-ogooue',
    pictures: [],
    cover: '/escadrille/cover.svg',
    gradient: 'from-[#0b2233] via-[#0e4d6e] to-[#1d8fb8]',
    accent: 'text-sky-300',
    dailyCap: 5,
    isNew: true,
  },
  {
    id: 'oeil-de-panthere',
    name: 'Œil de Panthère',
    tagline: 'Tir de précision au fusil à lunette',
    description: 'Fusil à lunette en main, abats braconniers, monstres de la forêt et cibles dans la Lopé… sans toucher les animaux protégés !',
    path: '/oeil-de-panthere',
    pictures: [],
    cover: '/commando/bg-lope.webp',
    gradient: 'from-[#1a1208] via-[#3b2a12] to-[#7a3a12]',
    accent: 'text-amber-300',
    dailyCap: 5,
    isNew: true,
  },
  {
    id: 'commando-okoume',
    name: 'Commando Okoumé',
    tagline: 'Action rétro à travers le Gabon',
    description: 'Avance, saute, tire et démantèle le réseau du Serpent Noir, du port d’Owendo aux chutes de Kongou. Monte en grade jusqu’à Colonel !',
    path: '/commando-okoume',
    pictures: [commandoMboumba, commandoMoussavou],
    cover: commandoCover,
    round: true,
    gradient: 'from-[#14200c] via-[#2f4a17] to-[#7a2a1a]',
    accent: 'text-amber-300',
    dailyCap: 5,
    isNew: true,
  },
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

]
