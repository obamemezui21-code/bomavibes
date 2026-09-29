import { CITY_COORDS } from './cityCoords.js'
import { COUNTRIES } from './geography.js'

// Profiles are only ever placed at their city's centre — never at a precise
// position — so the "Autour de moi" map can't be used to locate anyone.

function countryCodeOf(profile) {
  if (profile?.countryCode) return profile.countryCode
  const name = profile?.country?.toLowerCase()
  return name ? COUNTRIES.find((c) => c.name.toLowerCase() === name)?.code || null : null
}

export function coordsForProfile(profile, table = CITY_COORDS) {
  const code = countryCodeOf(profile)
  if (!code || !profile?.city) return null
  return table[`${code}|${profile.city}`] || null
}

// One group per city that has coordinates: { key, city, lat, lng, profiles }.
// Biggest groups first so the map's most useful pins are the ones listed first.
export function groupProfilesByCity(profiles, table = CITY_COORDS) {
  const groups = new Map()
  for (const profile of profiles) {
    const coords = coordsForProfile(profile, table)
    if (!coords) continue
    const key = `${countryCodeOf(profile)}|${profile.city}`
    if (!groups.has(key)) groups.set(key, { key, city: profile.city, lat: coords[0], lng: coords[1], profiles: [] })
    groups.get(key).profiles.push(profile)
  }
  return [...groups.values()].sort((a, b) => b.profiles.length - a.profiles.length)
}
