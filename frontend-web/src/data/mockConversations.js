function avatar(seed, backgroundColor) {
  return `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${backgroundColor}`
}

export const mockConversations = [
  {
    id: 'aicha',
    profile: { firstName: 'Aïcha', city: 'Libreville', photo: avatar('Aicha', 'ffd5a1') },
    matchedAt: '2026-07-28T09:12:00Z',
    online: true,
    isNewMatch: false,
    unreadCount: 0,
    messages: [
      { id: 1, fromMe: false, text: "Coucou ! Merci pour le match 😊", time: '09:14' },
      { id: 2, fromMe: true, text: 'Salut Aïcha ! Avec plaisir, ton profil m\'a tout de suite plu', time: '09:20' },
      { id: 3, fromMe: false, text: 'Haha merci ! Tu es plutôt danse ou cuisine ?', time: '09:22' },
      { id: 4, fromMe: true, text: 'Cuisine à 100% mais je suis prêt à apprendre à danser 😄', time: '09:24' },
      { id: 5, fromMe: false, text: 'Ça se propose bien ça ! On se motive pour un café cette semaine ?', time: '09:31' },
    ],
  },
  {
    id: 'belinda',
    profile: { firstName: 'Belinda', city: 'Franceville', photo: avatar('Belinda', 'f6c9d0') },
    matchedAt: '2026-07-31T07:45:00Z',
    online: false,
    isNewMatch: true,
    unreadCount: 0,
    messages: [],
  },
  {
    id: 'larissa',
    profile: { firstName: 'Larissa', city: 'Oyem', photo: avatar('Larissa', 'ead1fb') },
    matchedAt: '2026-07-25T18:00:00Z',
    online: true,
    isNewMatch: false,
    unreadCount: 2,
    messages: [
      { id: 1, fromMe: false, text: 'Salut ! J\'ai vu que tu aimais aussi voyager', time: 'Hier' },
      { id: 2, fromMe: true, text: 'Toujours partant pour de nouvelles destinations. Toi c\'était où le dernier ?', time: 'Hier' },
      { id: 3, fromMe: false, text: "Sao Tomé, magnifique. Et toi ?", time: 'Hier' },
    ],
  },
  {
    id: 'nadege',
    profile: { firstName: 'Nadège', city: 'Libreville', photo: avatar('Nadege', 'bcd4f6') },
    matchedAt: '2026-07-20T12:00:00Z',
    online: false,
    isNewMatch: false,
    unreadCount: 1,
    messages: [
      { id: 1, fromMe: true, text: 'Bonjour Nadège, comment vas-tu ?', time: 'Lun' },
      { id: 2, fromMe: false, text: 'Salut, très bien et toi ? 🙂', time: 'Lun' },
    ],
  },
]
