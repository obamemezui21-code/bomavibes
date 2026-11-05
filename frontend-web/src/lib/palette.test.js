import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The colours of index.css, read as the app uses them: text on the backgrounds
// and white on the fills. 4.5 is the usual minimum for reading text, 3 for
// icons and bold labels.
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
const darkAt = css.indexOf('html.dark {')

function colors(block) {
  return Object.fromEntries([...block.matchAll(/--color-([a-z0-9-]+): (#[0-9a-fA-F]{6});/g)].map(([, name, hex]) => [name, hex]))
}
const light = colors(css.slice(0, darkAt))
const dark = { ...light, ...colors(css.slice(darkAt, css.indexOf('\n}', darkAt))) }

function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

const WHITE = '#ffffff'

describe('colour palette', () => {
  it('keeps white text readable on the brand gradient', () => {
    for (const stop of ['brand-1', 'brand-2', 'brand-3']) {
      expect(contrast(WHITE, light[stop]), stop).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps the same gradient in both themes', () => {
    for (const stop of ['brand-1', 'brand-2', 'brand-3']) expect(dark[stop]).toBe(light[stop])
  })

  it('keeps accent text readable in the light theme', () => {
    for (const name of ['violet-500', 'violet-600', 'pink-500', 'pink-600', 'mint-600', 'coral-500', 'coral-600', 'heart-600']) {
      expect(contrast(light[name], light.surface), name).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(light.ink, light['surface-soft'])).toBeGreaterThanOrEqual(7)
  })

  it('keeps accent text readable in the dark theme', () => {
    for (const name of ['violet-500', 'violet-600', 'pink-400', 'pink-500', 'pink-600', 'mint-500', 'sky-400', 'coral-500', 'heart-500', 'gold']) {
      expect(contrast(dark[name], dark['surface-soft']), name).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(dark.ink, dark['surface-soft'])).toBeGreaterThanOrEqual(7)
    expect(contrast(dark['ink-soft'], dark['surface-tint'])).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps white labels and icons visible on solid fills', () => {
    for (const name of ['violet-500', 'violet-600', 'violet-950', 'pink-500', 'coral-500', 'mint-500']) {
      expect(contrast(WHITE, light[name]), `light ${name}`).toBeGreaterThanOrEqual(3)
      expect(contrast(WHITE, dark[name]), `dark ${name}`).toBeGreaterThanOrEqual(3)
    }
  })
})
