// NGORI RUN's route through Libreville: up the coast from the Bord de mer to
// Cap Estérias, then a "Tour de Libreville" back south. Purely cosmetic —
// districts are derived from the distance run, the simulation never sees
// them, so nothing here can change a score.

// [metres from the start, district name]
export const DISTRICTS = [
  [0, 'Bord de mer'],
  [300, 'Louis'],
  [700, 'Batterie IV'],
  [1200, 'La Sablière'],
  [1800, 'Les Charbonnages'],
  [2500, 'Okala'],
  [3300, 'Angondjé'],
  [4200, 'Cap Estérias'],
  [5100, 'Glass'], // just after the 5 km bonus, so the two announcements don't overlap
  [5800, 'Oloumi'],
  [6600, 'Owendo'],
]

export function districtAt(metres) {
  let name = DISTRICTS[0][1]
  for (const [from, district] of DISTRICTS) {
    if (metres >= from) name = district
    else break
  }
  return name
}

// Green direction signs along the road: familiar places, not businesses.
export const DIRECTION_SIGNS = [
  '← Mont-Bouët',
  'Nzeng-Ayong 3 km →',
  'Akanda →',
  'Owendo 15 km',
  'Aéroport →',
  '← Port-Môle',
  'Nombakélé →',
  '← Lalala',
  'PK8 →',
  '← Plaine Orety',
  'Pointe Denis ⛴',
  '← Centre-ville',
]

// Shop signs on the buildings: generic local names, never real brands.
export const SHOP_SIGNS = [
  'MAQUIS',
  'CHEZ TANTINE',
  'POISSON BRAISÉ',
  'BROCHETTES',
  'NYEMBWE',
  'ATANGA',
  'MAQUIS DU COIN',
  'SUNSET LOUNGE',
]
