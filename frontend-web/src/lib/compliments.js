// Compliments: a short note sent with a like. The server checks the same
// limit (backend/src/controllers/swipeController.js, parseCompliment).
export const COMPLIMENT_MAX = 200

export const COMPLIMENT_SUGGESTIONS = [
  'Ton sourire est magnifique 😊',
  'Tu as l’air de quelqu’un de passionnant',
  'On a des goûts en commun, ça me plaît !',
  'Ton profil m’a fait sourire',
]

// What a compliment answers, quoted in the chat and in "Qui t'a aimé·e".
export function complimentAbout(question, answer) {
  return question ? `${question} — ${answer}` : answer
}
