import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PREVIEW_PAGES, pageWithPreview, previewTags } from '../../linkPreviews.js'
import { INVITES } from './invite.js'

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const page = PREVIEW_PAGES.find((p) => p.path === 'jouer')
const tag = (text, name) => text.match(new RegExp(`(?:property|name)="${name}" content="([^"]*)"`))?.[1]

describe('link previews', () => {
  it('gives the games link its own title and picture', () => {
    const built = pageWithPreview(html, page)
    expect(tag(built, 'og:image')).toBe('https://bomavibes.tech/og/ngori-run.jpg')
    expect(tag(built, 'og:url')).toBe('https://bomavibes.tech/jouer/')
    expect(tag(built, 'og:title')).toContain('NGORI RUN')
    expect(tag(built, 'twitter:card')).toBe('summary_large_image')
    expect(built).toContain('<title>NGORI RUN')
  })

  it('leaves no default tag behind, and keeps the app running', () => {
    const built = pageWithPreview(html, page)
    expect(built.match(/property="og:image"/g)).toHaveLength(1)
    expect(built).not.toContain('og/bomavibes.jpg')
    expect(built).toContain('<div id="root"></div>')
    expect(built).toContain('src="/src/main.jsx"')
    expect(built).toContain('bomavibes-theme')
  })

  it('shows a picture for the app link too', () => {
    expect(tag(html, 'og:image')).toBe('https://bomavibes.tech/og/bomavibes.jpg')
    expect(tag(html, 'og:url')).toBe('https://bomavibes.tech/')
  })

  it('has the pictures it announces', () => {
    for (const image of ['/og/ngori-run.jpg', '/og/bomavibes.jpg']) {
      expect(existsSync(new URL(`../../public${image}`, import.meta.url)), image).toBe(true)
    }
  })

  it('sends the games invitation straight to the page with the picture', () => {
    expect(INVITES.games.url).toBe('https://bomavibes.tech/jouer/')
  })

  it('escapes what would break a tag', () => {
    const tags = previewTags({ path: 'x', title: 'A "B" & <C>', description: 'd', image: '/i.jpg' })
    expect(tags).toContain('A &quot;B&quot; &amp; &lt;C>')
  })
})
