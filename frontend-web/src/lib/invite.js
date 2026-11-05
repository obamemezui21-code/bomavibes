// Inviting friends: what the message says and the link each network opens with
// it. For a member, the link ends with their random invitation code (backend
// referralService.js), which shows nothing about them. The app never reads
// their contacts: they pick who to write to in the network itself.
// Instagram, TikTok and Snapchat have no link that opens a pre-filled message:
// those go through the phone's own share sheet, or the copied message.

export const INVITE_URL = 'https://bomavibes.tech'

export const INVITES = {
  app: {
    title: 'Invite tes amis',
    subtitle: 'Fais découvrir BomaVibes à qui tu veux.',
    text: 'Rejoins-moi sur BomaVibes, la rencontre africaine 💛',
    url: INVITE_URL,
  },
  // The games open without an account, so the friend can play straight away.
  // /jouer/ is the real file with the game's picture (linkPreviews.js).
  games: {
    title: 'Invite tes amis à jouer',
    subtitle: 'Ils peuvent jouer tout de suite, sans créer de compte.',
    text: 'Viens jouer avec moi sur BomaVibes : des jeux 100 % gabonais, sans créer de compte 🎮',
    url: `${INVITE_URL}/jouer/`,
  },
}

// The same invitation, with the member's code in its link.
export function withReferral(invite, code) {
  if (!code) return invite
  const url = new URL(invite.url)
  url.searchParams.set('ref', code)
  return { ...invite, url: url.href }
}

export function inviteMessage({ text, url }) {
  return `${text} ${url}`
}

// One link per network, in display order. `app` links leave the browser for
// the phone's own app (SMS, e-mail) instead of opening a new tab.
export function inviteLinks(invite) {
  const message = encodeURIComponent(inviteMessage(invite))
  const text = encodeURIComponent(invite.text)
  const url = encodeURIComponent(invite.url)
  return [
    { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${message}` },
    { id: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
    { id: 'telegram', label: 'Telegram', href: `https://t.me/share/url?url=${url}&text=${text}` },
    { id: 'x', label: 'X', href: `https://x.com/intent/tweet?text=${text}&url=${url}` },
    { id: 'sms', label: 'SMS', href: `sms:?&body=${message}`, app: true },
    { id: 'email', label: 'E-mail', href: `mailto:?subject=${encodeURIComponent('BomaVibes')}&body=${message}`, app: true },
  ]
}
