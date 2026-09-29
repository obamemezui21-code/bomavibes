import { describe, expect, it } from 'vitest'
import { callLabel, callPreview, formatCallDuration, isMissedCall } from './callSummary.js'

describe('formatCallDuration', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatCallDuration(0)).toBe('0 s')
    expect(formatCallDuration(45)).toBe('45 s')
    expect(formatCallDuration(60)).toBe('1 min')
    expect(formatCallDuration(252)).toBe('4 min 12 s')
    expect(formatCallDuration(3900)).toBe('1 h 05')
  })

  it('tolerates missing values', () => {
    expect(formatCallDuration(undefined)).toBe('0 s')
    expect(formatCallDuration(-3)).toBe('0 s')
  })
})

describe('callLabel', () => {
  it('depends on who is looking', () => {
    const done = { type: 'video', outcome: 'completed', duration: 30 }
    expect(callLabel(done, true)).toBe('Appel vidéo sortant')
    expect(callLabel(done, false)).toBe('Appel vidéo entrant')

    const missed = { type: 'audio', outcome: 'missed' }
    expect(callLabel(missed, true)).toBe('Appel audio sans réponse')
    expect(callLabel(missed, false)).toBe('Appel audio manqué')
  })

  it('treats a call cancelled before answer as missed for the callee', () => {
    expect(callLabel({ type: 'audio', outcome: 'cancelled' }, false)).toBe('Appel audio manqué')
    expect(isMissedCall({ outcome: 'cancelled' }, false)).toBe(true)
    expect(isMissedCall({ outcome: 'cancelled' }, true)).toBe(false)
    expect(isMissedCall({ outcome: 'completed' }, false)).toBe(false)
  })
})

describe('callPreview', () => {
  it('stays neutral for the conversation list', () => {
    expect(callPreview({ type: 'video', outcome: 'completed', duration: 252 })).toBe('🎥 Appel vidéo · 4 min 12 s')
    expect(callPreview({ type: 'audio', outcome: 'missed' })).toBe('📞 Appel audio manqué')
    expect(callPreview({ type: 'audio', outcome: 'busy' })).toBe('📞 Appel audio manqué')
  })
})
