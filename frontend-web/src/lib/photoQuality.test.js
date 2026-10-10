import { describe, expect, it } from 'vitest'
import { isHdSize } from './photoQuality.js'

describe('isHdSize', () => {
  it('accepts photos whose shorter side reaches 720 px', () => {
    expect(isHdSize(720, 1280)).toBe(true)
    expect(isHdSize(1280, 720)).toBe(true)
    expect(isHdSize(3024, 4032)).toBe(true)
  })

  it('rejects smaller photos, whatever the longer side', () => {
    expect(isHdSize(719, 2000)).toBe(false)
    expect(isHdSize(640, 480)).toBe(false)
    expect(isHdSize(2048, 683)).toBe(false)
  })
})
