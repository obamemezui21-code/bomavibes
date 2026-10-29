import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILTERS,
  NEW_MEMBER_MS,
  activeFilterCount,
  loadKey,
  matchesFilters,
  normalize,
  passesDistance,
  sortProfiles,
} from './discoverFilters.js'

const NOW = 1_800_000_000_000
const f = (changes) => ({ ...DEFAULT_FILTERS, ...changes })
const aicha = {
  id: 'a',
  age: 27,
  city: 'Libreville',
  neighborhood: 'Louis',
  country: 'Gabon',
  height: 168,
  relationshipStatus: 'Célibataire',
  datingGoal: 'Relation sérieuse',
  interests: ['Musique', 'Cuisine'],
  languages: ['Français', 'Fang'],
  religion: 'Christianisme',
  education: 'Master',
  jobTitle: 'Comptable',
  workplace: 'BGFIBank',
  photos: ['x.jpg'],
  verified: true,
  isTraveling: false,
  lastActiveAt: NOW - 60 * 1000,
  createdAtMs: NOW - 2 * 24 * 3600 * 1000,
}
const bare = { id: 'b' }

describe('Discover filters', () => {
  it('keeps everyone with the default filters', () => {
    expect(matchesFilters(aicha, DEFAULT_FILTERS, NOW)).toBe(true)
    expect(matchesFilters(bare, DEFAULT_FILTERS, NOW)).toBe(true)
  })

  it('filters on age, and leaves out unknown ages once a range is set', () => {
    expect(matchesFilters(aicha, f({ minAge: 25, maxAge: 30 }), NOW)).toBe(true)
    expect(matchesFilters(aicha, f({ minAge: 28 }), NOW)).toBe(false)
    expect(matchesFilters(bare, f({ maxAge: 40 }), NOW)).toBe(false)
  })

  it('filters on activity: online now, or active in the last 3 days', () => {
    expect(matchesFilters(aicha, f({ activity: 'online' }), NOW)).toBe(true)
    expect(matchesFilters({ ...aicha, lastActiveAt: NOW - 10 * 60 * 1000 }, f({ activity: 'online' }), NOW)).toBe(false)
    expect(matchesFilters({ ...aicha, lastActiveAt: NOW - 2 * 24 * 3600 * 1000 }, f({ activity: 'recent' }), NOW)).toBe(true)
    expect(matchesFilters({ ...aicha, lastActiveAt: NOW - 5 * 24 * 3600 * 1000 }, f({ activity: 'recent' }), NOW)).toBe(false)
    expect(matchesFilters(bare, f({ activity: 'recent' }), NOW)).toBe(false)
  })

  it('matches city, neighbourhood and job whatever the case and accents', () => {
    expect(normalize(' Libreville ')).toBe('libreville')
    expect(matchesFilters(aicha, f({ city: 'librev' }), NOW)).toBe(true)
    expect(matchesFilters(aicha, f({ neighborhood: 'LOUIS' }), NOW)).toBe(true)
    expect(matchesFilters({ ...aicha, city: 'Lambaréné' }, f({ city: 'lambarene' }), NOW)).toBe(true)
    expect(matchesFilters(aicha, f({ city: 'Franceville' }), NOW)).toBe(false)
    expect(matchesFilters(aicha, f({ job: 'bgfi' }), NOW)).toBe(true)
    expect(matchesFilters(aicha, f({ job: 'médecin' }), NOW)).toBe(false)
  })

  it('filters on height, leaving out unknown heights', () => {
    expect(matchesFilters(aicha, f({ minHeight: 160, maxHeight: 175 }), NOW)).toBe(true)
    expect(matchesFilters(aicha, f({ minHeight: 170 }), NOW)).toBe(false)
    expect(matchesFilters(bare, f({ maxHeight: 200 }), NOW)).toBe(false)
  })

  it('multi-choice filters keep a profile matching any of the choices', () => {
    expect(matchesFilters(aicha, f({ goals: ['Amitié', 'Relation sérieuse'] }), NOW)).toBe(true)
    expect(matchesFilters(aicha, f({ goals: ['Amitié'] }), NOW)).toBe(false)
    expect(matchesFilters(aicha, f({ interests: ['Sport', 'Cuisine'] }), NOW)).toBe(true)
    expect(matchesFilters(aicha, f({ languages: ['Anglais'] }), NOW)).toBe(false)
    expect(matchesFilters(aicha, f({ relationshipStatuses: ['Célibataire'] }), NOW)).toBe(true)
    expect(matchesFilters(aicha, f({ educations: ['Licence', 'Doctorat'] }), NOW)).toBe(false)
  })

  it('filters on religion, photo, verified, new and traveling members', () => {
    expect(matchesFilters(aicha, f({ religion: 'Islam' }), NOW)).toBe(false)
    expect(matchesFilters(bare, f({ withPhotoOnly: true }), NOW)).toBe(false)
    expect(matchesFilters(bare, f({ verifiedOnly: true }), NOW)).toBe(false)
    expect(matchesFilters(aicha, f({ newOnly: true }), NOW)).toBe(true)
    expect(matchesFilters({ ...aicha, createdAtMs: NOW - NEW_MEMBER_MS - 1 }, f({ newOnly: true }), NOW)).toBe(false)
    expect(matchesFilters(aicha, f({ travelingOnly: true }), NOW)).toBe(false)
  })

  it('distance: no maximum keeps everyone, a maximum leaves out unknown distances', () => {
    expect(passesDistance(null, DEFAULT_FILTERS)).toBe(true)
    expect(passesDistance(5, f({ maxDistanceKm: 10 }))).toBe(true)
    expect(passesDistance(15, f({ maxDistanceKm: 10 }))).toBe(false)
    expect(passesDistance(null, f({ maxDistanceKm: 10 }))).toBe(false)
  })

  it('sorts by distance, activity or newness, unknowns last, ties kept in order', () => {
    const a = { id: 'a', lastActiveAt: 5, createdAtMs: 1 }
    const b = { id: 'b', lastActiveAt: 9, createdAtMs: 3 }
    const c = { id: 'c' }
    const km = { a: 10, b: 2 }
    const ids = (list) => list.map((p) => p.id).join('')
    expect(ids(sortProfiles([a, b, c], 'relevance'))).toBe('abc')
    expect(ids(sortProfiles([a, b, c], 'distance', (p) => km[p.id] ?? null))).toBe('bac')
    expect(ids(sortProfiles([c, a, b], 'activity'))).toBe('bac')
    expect(ids(sortProfiles([c, a, b], 'new'))).toBe('bac')
  })

  it('counts the filters that are on', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0)
    expect(activeFilterCount(f({ minAge: 25, maxAge: 40 }))).toBe(1)
    expect(activeFilterCount(f({ maxDistanceKm: 20, goals: ['Amitié'], verifiedOnly: true, sort: 'new' }))).toBe(4)
    expect(activeFilterCount(f({ city: '  ' }))).toBe(0)
  })

  it('reloads profiles for a filter change, not for the sort or the distance', () => {
    expect(loadKey(f({ sort: 'new', maxDistanceKm: 5 }))).toBe(loadKey(DEFAULT_FILTERS))
    expect(loadKey(f({ goals: ['Amitié'] }))).not.toBe(loadKey(DEFAULT_FILTERS))
  })
})
