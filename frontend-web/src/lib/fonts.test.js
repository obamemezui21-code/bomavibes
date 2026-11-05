import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_FONT, FONTS, FONT_CATEGORIES, FONT_STORAGE_KEY, appFont, fontById, fontsByCategory, loadAllFonts, loadFont } from './fonts.js'

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')

const ruleOf = (id) => css.match(new RegExp(`\\[data-font='${id}'\\]\\s*\\{([^}]*)\\}`))?.[1]

describe('writing styles', () => {
  it('has a CSS rule setting both fonts for every style', () => {
    for (const font of FONTS) {
      const rule = ruleOf(font.id)
      expect(rule, font.id).toBeTruthy()
      expect(rule).toContain('--font-sans:')
      expect(rule).toContain('--font-display:')
    }
  })

  it('offers something in every category, and only those', () => {
    for (const { category, fonts } of fontsByCategory()) expect(fonts.length, category).toBeGreaterThan(0)
    expect(FONTS.every((f) => FONT_CATEGORIES.includes(f.category))).toBe(true)
    expect(new Set(FONTS.map((f) => f.id)).size).toBe(FONTS.length)
  })

  it('keeps today’s look by default and downloads nothing for it', () => {
    expect(fontById(DEFAULT_FONT).load).toBeUndefined()
    expect(ruleOf(DEFAULT_FONT)).toContain('Inter Variable')
    expect(ruleOf(DEFAULT_FONT)).toContain('Outfit Variable')
  })

  it('falls back to the default for an unknown or tampered choice', () => {
    expect(fontById('nope').id).toBe(DEFAULT_FONT)
    expect(fontById(null).id).toBe(DEFAULT_FONT)
  })

  it('applies the choice before the first paint', () => {
    expect(html).toContain(FONT_STORAGE_KEY)
    expect(html).toContain('data-font')
  })

  it('reaches the counters written in font-mono', () => {
    expect(css).toMatch(/html\[data-font\]:not\(\[data-font='default'\]\)\s*\{\s*--font-mono: var\(--font-sans\)/)
  })

  it('reaches the text drawn in every game', () => {
    // flags.js draws logos: artwork, not text to read.
    const games = new URL('../game/', import.meta.url)
    const files = readdirSync(games, { recursive: true }).filter((f) => /\.jsx?$/.test(f) && !/\.test\./.test(f) && !/flags\.js$/.test(f))
    const hardCoded = files.flatMap((f) =>
      readFileSync(new URL(String(f).replaceAll('\\', '/'), games), 'utf8')
        .split('\n')
        .filter((line) => /\.font = /.test(line) && !line.includes('appFont('))
        .map((line) => `${f}: ${line.trim()}`),
    )
    expect(hardCoded).toEqual([])
  })

  it('keeps the games’ own font in the default style', () => {
    expect(appFont()).toBe('system-ui, sans-serif')
    expect(appFont('monospace')).toBe('monospace')
  })

  it('never fails when a font can’t be downloaded', async () => {
    await expect(loadFont('nope')).resolves.toBeUndefined()
    await expect(loadAllFonts()).resolves.toHaveLength(FONTS.length)
  })
})
