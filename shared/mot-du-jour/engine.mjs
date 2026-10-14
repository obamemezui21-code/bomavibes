// LE MOT DU JOUR — the rules, shared by the app (pages/MotDuJour.jsx) and the
// server (backend/src/controllers/motDuJourController.js). The words
// themselves live only on the server (backend/src/config/motDuJourWords.js):
// the app never knows today's word before the game is over.

export const MAX_TRIES = 6
export const MIN_LENGTH = 5
export const MAX_LENGTH = 8

// Marks, one letter per position: C = right place, P = in the word elsewhere,
// A = not in the word (or already all accounted for).
export const CORRECT = 'C'
export const PRESENT = 'P'
export const ABSENT = 'A'

// "Okoumé" → "OKOUME": capitals A-Z only, accents dropped, anything else removed.
export function normalizeWord(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/Œ/g, 'OE')
    .replace(/Æ/g, 'AE')
    .replace(/[^A-Z]/g, '')
}

export function isValidGuess(guess, length) {
  return typeof guess === 'string' && guess.length === length && /^[A-Z]+$/.test(guess)
}

// Wordle marking: exact matches first, then each remaining letter of the
// guess is "present" only while the answer still has an unmatched copy of it.
export function markGuess(guess, answer) {
  const marks = Array(answer.length).fill(ABSENT)
  const left = {}
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) marks[i] = CORRECT
    else left[answer[i]] = (left[answer[i]] || 0) + 1
  }
  for (let i = 0; i < answer.length; i++) {
    if (marks[i] === CORRECT) continue
    if (left[guess[i]] > 0) {
      marks[i] = PRESENT
      left[guess[i]]--
    }
  }
  return marks.join('')
}

const RANK = { [ABSENT]: 1, [PRESENT]: 2, [CORRECT]: 3 }

// Best mark seen so far for each letter, to colour the keyboard.
export function keyboardMarks(guesses, marks) {
  const keys = {}
  guesses.forEach((guess, g) => {
    for (let i = 0; i < guess.length; i++) {
      const mark = marks[g][i]
      if (!keys[guess[i]] || RANK[mark] > RANK[keys[guess[i]]]) keys[guess[i]] = mark
    }
  })
  return keys
}

const EMOJI = { [CORRECT]: '🟩', [PRESENT]: '🟨', [ABSENT]: '⬛' }

// The spoiler-free grid people share.
export function shareText({ day, marks, won }) {
  const [, month, date] = day.split('-')
  const score = won ? `${marks.length}/${MAX_TRIES}` : `X/${MAX_TRIES}`
  const grid = marks.map((m) => [...m].map((c) => EMOJI[c]).join('')).join('\n')
  return `Le Mot du Jour BomaVibes ${date}/${month} — ${score}\n\n${grid}\n\nbomavibes.tech/mot-du-jour`
}
