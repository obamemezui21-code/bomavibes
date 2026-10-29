import { describe, expect, it } from 'vitest'
import { ephemeralLabel, ephemeralNotice, expiryFor, isExpired, remainingLabel } from './ephemeral.js'

const HOUR = 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 29, 12)

describe('ephemeral messages', () => {
  it('a message sent while the setting is on expires after the chosen duration', () => {
    expect(expiryFor(24 * 3600, NOW).getTime()).toBe(NOW + 24 * HOUR)
    expect(expiryFor(7 * 24 * 3600, NOW).getTime()).toBe(NOW + 7 * 24 * HOUR)
    expect(expiryFor(0, NOW)).toBeNull()
  })

  it('hides a message once its time is up, never an ordinary one', () => {
    expect(isExpired({ expiresAt: new Date(NOW - 1) }, NOW)).toBe(true)
    expect(isExpired({ expiresAt: new Date(NOW) }, NOW)).toBe(true)
    expect(isExpired({ expiresAt: new Date(NOW + 1000) }, NOW)).toBe(false)
    expect(isExpired({ expiresAt: null }, NOW)).toBe(false)
    expect(isExpired({}, NOW)).toBe(false)
  })

  it('says how long a message has left', () => {
    expect(remainingLabel(new Date(NOW + 30 * 1000), NOW)).toBe('1 min')
    expect(remainingLabel(new Date(NOW + 45 * 60 * 1000), NOW)).toBe('45 min')
    expect(remainingLabel(new Date(NOW + 5 * HOUR), NOW)).toBe('5 h')
    expect(remainingLabel(new Date(NOW + 24 * HOUR), NOW)).toBe('24 h')
    expect(remainingLabel(new Date(NOW + 7 * 24 * HOUR), NOW)).toBe('7 j')
    expect(remainingLabel(new Date(NOW - 1000), NOW)).toBe('1 min')
  })

  it('tells both members who changed the setting', () => {
    expect(ephemeralLabel(24 * 3600)).toBe('24 heures')
    expect(ephemeralNotice(24 * 3600, true, 'Aïcha')).toBe(
      'Vous avez activé les messages éphémères : les nouveaux messages disparaissent après 24 heures.',
    )
    expect(ephemeralNotice(0, false, 'Aïcha')).toBe('Aïcha a désactivé les messages éphémères.')
    expect(ephemeralNotice(7 * 24 * 3600, false, '')).toContain('Votre match a activé')
  })
})
