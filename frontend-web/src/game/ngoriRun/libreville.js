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

// Approximate centre of each district (lat, lng) — only used to drop each
// Coins Chics venue into the right stretch of the route. Rough on purpose.
export const DISTRICT_COORDS = {
  'Bord de mer': [0.392, 9.447],
  Louis: [0.414, 9.437],
  'Batterie IV': [0.432, 9.43],
  'La Sablière': [0.455, 9.412],
  'Les Charbonnages': [0.47, 9.41],
  Okala: [0.5, 9.425],
  Angondjé: [0.535, 9.4],
  'Cap Estérias': [0.62, 9.32],
  Glass: [0.375, 9.445],
  Oloumi: [0.36, 9.452],
  Owendo: [0.29, 9.5],
}

// Public landmarks, no brands: a brown tourist sign at that distance (m),
// plus a drawing for some of them.
export const LANDMARKS = [
  { at: 70, text: 'Palais du Bord de mer 🏛️' },
  { at: 150, text: 'Port-Môle ⚓', visual: 'boats' },
  // visual 'monument': a picture from assets/game/monuments.webp standing
  // on the city side instead of the buildings (renderer.js MONUMENTS).
  { at: 230, text: 'Cathédrale Sainte-Marie ⛪', visual: 'monument', monument: 0 },
  { at: 550, text: 'Pointe Denis ⛴' },
  { at: 1350, text: 'Plage de la Sablière 🏖️' },
  { at: 1550, text: 'Arboretum Raponda Walker 🌳' },
  { at: 2050, text: 'Aéroport Léon Mba ✈️', visual: 'plane' },
  { at: 3500, text: "Stade de l'Amitié 🏟️", visual: 'stadium' },
  { at: 4350, text: 'Plage du Cap Estérias 🏖️' },
  { at: 5400, text: 'Église Saint-Michel de Nkembo ⛪' },
  { at: 5650, text: 'Marché de Mont-Bouët 🛍️', visual: 'monument', monument: 1 },
  { at: 6750, text: "Port d'Owendo ⚓", visual: 'cranes' },
]

// Roadside stalls on the seafront promenade. `sprite` is the stall's
// picture in assets/game/roadside.webp (see renderer.js ROADSIDE); `call`
// is what the vendor shouts as you run past (spoken by the browser's
// voice, if it has one).
export const VENDOR_STALLS = [
  { kind: 'manioc', sprite: 0, label: 'BÂTONS DE MANIOC', call: 'Bâton de manioc ! Bâton !' },
  { kind: 'plantain', sprite: 1, label: 'BANANES PLANTAIN', call: 'Banane plantain, bon prix !' },
  { kind: 'grill', sprite: 2, label: 'COUPÉ-COUPÉ', call: 'Coupé-coupé ! Viens goûter !' },
  { kind: 'fruits', sprite: 3, label: 'FRUITS', call: 'Mangues, bananes, bon prix !' },
  { kind: 'grill', sprite: 4, label: 'BROCHETTES', call: 'Brochettes, brochettes !' },
]

// People strolling on the promenade, halfway between two stalls.
export const PASSERSBY = [
  { kind: 'basin', sprite: 5 }, // beignets in a basin carried on the head
  { kind: 'football', sprite: 6 },
  { kind: 'mama', sprite: 7 }, // waving from her stool
]

// A stall every STALL_EVERY m, a passer-by between each pair, except
// where a landmark sign, a district arch or a Coins Chics billboard
// ([{ at }]) already stands.
export const STALL_EVERY = 55
const STALL_OFFSET = 30

const isFree = (at, billboards) =>
  !LANDMARKS.some((l) => Math.abs(l.at - at) < 10) &&
  !DISTRICTS.some(([from]) => Math.abs(from - at) < 12) &&
  !billboards.some((b) => Math.abs(b.at - at) < 10)

export function stallFor(k, billboards = []) {
  if (k < 0) return null
  const at = k * STALL_EVERY + STALL_OFFSET
  return isFree(at, billboards) ? { at, ...VENDOR_STALLS[k % VENDOR_STALLS.length] } : null
}

export function passerbyFor(k, billboards = []) {
  if (k < 0) return null
  const at = k * STALL_EVERY + STALL_OFFSET + Math.round(STALL_EVERY / 2)
  return isFree(at, billboards) ? { at, ...PASSERSBY[k % PASSERSBY.length] } : null
}

// Index of the stall at or just past `metres`.
export const stallIndexAt = (metres) => Math.ceil((metres - STALL_OFFSET) / STALL_EVERY)

// Stretches where the city gives way to forest on the right of the road.
export const FOREST_DISTRICTS = ['Angondjé', 'Cap Estérias']

// What the game shouts at the player, in Libreville's own words.
export const PHRASES = {
  start: ['Mbolo ! On y va 🇬🇦', 'Mbolo ! C’est parti 🇬🇦'],
  combo: ['Ékiééé !', 'Tu es fort !', 'Ça chauffe 🔥', 'Tu gères !'],
  bonus: ['Akiba !', 'On est ensemble !'],
  district: (name) => [`Bienvenue à ${name} 🔥`, `${name}, c’est comment ? 👋`, `On est à ${name} !`],
}

export const pick = (list, n) => list[Math.abs(n) % list.length]

const KM_PER_DEGREE = 111
const MAX_VENUE_KM = 15 // farther than this from every district: not in Libreville
const LOOP_FROM = 7200 // past Owendo the road goes on forever: venues come back in turn
const LOOP_EVERY = 600

function nearestDistrict(lat, lng) {
  let best = null
  let bestKm = Infinity
  for (const [name, [dlat, dlng]] of Object.entries(DISTRICT_COORDS)) {
    const km = Math.hypot(lat - dlat, lng - dlng) * KM_PER_DEGREE
    if (km < bestKm) {
      bestKm = km
      best = name
    }
  }
  return bestKm <= MAX_VENUE_KM ? best : null
}

const busyAt = (m) =>
  DISTRICTS.some(([from]) => Math.abs(from - m) < 80) || LANDMARKS.some(({ at }) => Math.abs(at - m) < 60)

// Places published Coins Chics venues as roadside billboards: spread evenly
// through the district they belong to (from their GPS position), then, past
// Owendo, every LOOP_EVERY m in turn. → [{ at (m), name, category, image }]
export function placeVenues(venues, loopUntil = 20000) {
  const byDistrict = new Map()
  const all = []
  for (const v of venues || []) {
    if (!v?.name || typeof v.lat !== 'number' || typeof v.lng !== 'number') continue
    const district = nearestDistrict(v.lat, v.lng)
    if (!district) continue
    const board = { name: v.name, category: v.category || '', image: v.image || null }
    all.push(board)
    if (!byDistrict.has(district)) byDistrict.set(district, [])
    byDistrict.get(district).push(board)
  }

  const placed = []
  DISTRICTS.forEach(([from, name], i) => {
    const boards = byDistrict.get(name)
    if (!boards) return
    const to = DISTRICTS[i + 1]?.[0] ?? LOOP_FROM
    const step = (to - from) / (boards.length + 1)
    boards.forEach((b, j) => {
      // Nearest free spot around the ideal one, without leaving the district.
      const ideal = Math.round(from + step * (j + 1))
      let at = ideal
      for (let d = 0; d <= step; d += 25) {
        const options = [ideal + d, ideal - d].filter((m) => m > from && m < to && !busyAt(m))
        if (options.length) {
          at = options[0]
          break
        }
      }
      placed.push({ ...b, at })
    })
  })
  if (all.length) {
    for (let at = LOOP_FROM, i = 0; at < loopUntil; at += LOOP_EVERY, i++) {
      if (!busyAt(at)) placed.push({ ...all[i % all.length], at })
    }
  }
  return placed.sort((a, b) => a.at - b.at)
}
