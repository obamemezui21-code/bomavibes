import { describe, expect, it } from 'vitest'
import { INVITES, INVITE_URL, inviteLinks, inviteMessage, withReferral } from './invite.js'

const link = (invite, id) => inviteLinks(invite).find((l) => l.id === id).href

describe('invite links', () => {
  it('puts the whole message in the WhatsApp link, encoded', () => {
    const href = new URL(link(INVITES.app, 'whatsapp'))
    expect(href.origin + href.pathname).toBe('https://wa.me/')
    expect(href.searchParams.get('text')).toBe(`${INVITES.app.text} ${INVITE_URL}`)
  })

  it('gives each network the text and the link where it expects them', () => {
    const telegram = new URL(link(INVITES.app, 'telegram')).searchParams
    expect(telegram.get('url')).toBe(INVITE_URL)
    expect(telegram.get('text')).toBe(INVITES.app.text)
    const x = new URL(link(INVITES.app, 'x')).searchParams
    expect(x.get('url')).toBe(INVITE_URL)
    expect(x.get('text')).toBe(INVITES.app.text)
    expect(new URL(link(INVITES.app, 'facebook')).searchParams.get('u')).toBe(INVITE_URL)
  })

  it('survives the characters that would break a link', () => {
    const invite = { text: 'Toi & moi ? 100 % #BomaVibes', url: 'https://bomavibes.tech/jouer?a=1&b=2' }
    expect(new URL(link(invite, 'whatsapp')).searchParams.get('text')).toBe(inviteMessage(invite))
    expect(new URL(link(invite, 'telegram')).searchParams.get('url')).toBe(invite.url)
  })

  it('opens the phone’s own apps for SMS and e-mail', () => {
    expect(link(INVITES.app, 'sms').startsWith('sms:')).toBe(true)
    expect(link(INVITES.app, 'email').startsWith('mailto:')).toBe(true)
    expect(decodeURIComponent(link(INVITES.app, 'email'))).toContain(INVITE_URL)
    expect(inviteLinks(INVITES.app).filter((l) => l.app).map((l) => l.id)).toEqual(['sms', 'email'])
  })

  it('adds the member’s code to the link, for every network', () => {
    const invite = withReferral(INVITES.games, 'ABCD2345')
    expect(invite.url).toBe('https://bomavibes.tech/jouer?ref=ABCD2345')
    expect(new URL(link(invite, 'facebook')).searchParams.get('u')).toBe(invite.url)
    expect(new URL(link(invite, 'whatsapp')).searchParams.get('text')).toContain('?ref=ABCD2345')
    expect(INVITES.games.url).toBe(`${INVITE_URL}/jouer`)
  })

  it('leaves the link alone without a code', () => {
    expect(withReferral(INVITES.app, null)).toBe(INVITES.app)
  })

  it('sends the games invitation to the page open without an account', () => {
    expect(INVITES.games.url).toBe(`${INVITE_URL}/jouer`)
    expect(decodeURIComponent(link(INVITES.games, 'whatsapp'))).toContain('/jouer')
  })
})
