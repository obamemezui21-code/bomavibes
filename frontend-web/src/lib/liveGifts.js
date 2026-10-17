// Gifts sent to the host of a live, paid in Ngori — mirror of GIFTS in
// backend/src/controllers/liveController.js (the server is the source of truth).
export const LIVE_GIFTS = [
  { id: 'rose', emoji: '🌹', name: 'Rose', cost: 1 },
  { id: 'coeur', emoji: '💖', name: 'Cœur', cost: 3 },
  { id: 'feu', emoji: '🔥', name: 'Feu', cost: 5 },
  { id: 'couronne', emoji: '👑', name: 'Couronne', cost: 10 },
]

export const giftById = (id) => LIVE_GIFTS.find((g) => g.id === id) || null
