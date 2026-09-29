import { describe, expect, it } from 'vitest'
import { backgroundTextSize, hasCustomStyle, postBackground, postFont } from './postStyles.js'

describe('post style presets', () => {
  it('resolves known ids and ignores anything else', () => {
    expect(postBackground('plum')?.text).toBe('#ffffff')
    expect(postBackground('url(javascript:alert(1))')).toBeNull()
    expect(postBackground(undefined)).toBeNull()
    expect(postFont('script')?.family).toContain('Dancing Script')
    expect(postFont('comic-sans')).toBeNull()
  })

  it('only counts real styles', () => {
    expect(hasCustomStyle({})).toBe(false)
    expect(hasCustomStyle({ font: 'normal' })).toBe(false)
    expect(hasCustomStyle({ font: 'nope' })).toBe(false)
    expect(hasCustomStyle({ font: 'elegant' })).toBe(true)
    expect(hasCustomStyle({ background: 'ocean' })).toBe(true)
  })

  it('shrinks text as it gets longer', () => {
    expect(backgroundTextSize(20)).toContain('26px')
    expect(backgroundTextSize(100)).toContain('22px')
    expect(backgroundTextSize(180)).toContain('text-lg')
    expect(backgroundTextSize(280)).toContain('text-base')
  })
})
