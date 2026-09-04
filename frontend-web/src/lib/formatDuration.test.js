import { describe, expect, it } from 'vitest'
import { formatDuration } from './formatDuration.js'

describe('formatDuration', () => {
  it('formats whole minutes and seconds as m:ss', () => {
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(600)).toBe('10:00')
  })

  it('pads seconds under 10', () => {
    expect(formatDuration(9)).toBe('0:09')
  })

  it('rounds fractional seconds', () => {
    expect(formatDuration(59.6)).toBe('1:00')
  })

  it('clamps negative/undefined/NaN input to 0:00', () => {
    expect(formatDuration(-5)).toBe('0:00')
    expect(formatDuration(undefined)).toBe('0:00')
    expect(formatDuration(NaN)).toBe('0:00')
  })
})
