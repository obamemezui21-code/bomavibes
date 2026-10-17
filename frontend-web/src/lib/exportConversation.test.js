import { describe, expect, it } from 'vitest'
import { conversationToText, exportFileName, formatStamp } from './exportConversation.js'

const people = { myId: 'me', myName: 'Jean', otherName: 'Aïcha' }

describe('conversationToText', () => {
  it('writes one dated line per message with the sender', () => {
    const text = conversationToText(
      [
        { senderId: 'me', type: 'text', text: 'Salut !', date: new Date(2026, 9, 17, 9, 5) },
        { senderId: 'her', type: 'image', fileUrl: 'https://x/p.jpg', date: new Date(2026, 9, 17, 9, 6) },
        { senderId: 'her', type: 'text', text: 'Ligne 1\nLigne 2', date: new Date(2026, 9, 17, 9, 7), edited: true },
      ],
      people,
    )
    expect(text).toContain('[17/10/2026 09:05] Jean : Salut !')
    expect(text).toContain('[17/10/2026 09:06] Aïcha : 📷 Photo — https://x/p.jpg')
    expect(text).toContain('[17/10/2026 09:07] Aïcha : Ligne 1\n    Ligne 2 (modifié)')
    expect(text).toContain('3 messages')
  })
})

describe('exportFileName', () => {
  it('drops accents and odd characters', () => {
    expect(exportFileName('Aïcha N.', new Date(2026, 9, 17))).toBe('BomaVibes_Aicha_N_2026-10-17.txt')
  })
})

describe('formatStamp', () => {
  it('pads day, month, hours and minutes', () => {
    expect(formatStamp(new Date(2026, 0, 3, 7, 4))).toBe('03/01/2026 07:04')
  })
})
