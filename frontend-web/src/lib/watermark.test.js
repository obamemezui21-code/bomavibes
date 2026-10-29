import { describe, expect, it } from 'vitest'
import { watermarkLabel, watermarkTile } from './watermark.js'

describe('watermark', () => {
  it('writes the viewer first name and the start of their id', () => {
    expect(watermarkLabel('Aïcha', 'abcdefghijkl')).toBe('Aïcha · abcdefgh')
    expect(watermarkLabel('', 'uid12345678')).toBe('Membre · uid12345')
    expect(watermarkLabel('Jean', null)).toBe('Jean')
  })

  it('keeps long names short', () => {
    expect(watermarkLabel('A'.repeat(60), 'x').length).toBeLessThan(40)
  })

  it('escapes the name inside the SVG, so a name cannot break out of it', () => {
    const tile = decodeURIComponent(watermarkTile('<script>&"\'</script>'))
    expect(tile).toContain('&lt;script&gt;&amp;&quot;&apos;&lt;/script&gt;')
    expect(tile).not.toContain('<script>')
  })

  it('is a CSS url() of an SVG data URI', () => {
    expect(watermarkTile('Zola · 12345678')).toMatch(/^url\("data:image\/svg\+xml,%3Csvg/)
  })
})
