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

// The spoiler-free grid people share (with the hints taken, if any).
export function shareText({ day, marks, won, hints = 0 }) {
  const [, month, date] = day.split('-')
  const score = (won ? `${marks.length}/${MAX_TRIES}` : `X/${MAX_TRIES}`) + (hints ? ` · 💡 ${hints}` : '')
  const grid = marks.map((m) => [...m].map((c) => EMOJI[c]).join('')).join('\n')
  return `Le Mot du Jour BomaVibes ${date}/${month} — ${score}\n\n${grid}\n\nbomavibes.tech/mot-du-jour`
}

// ── Hints ────────────────────────────────────────────────────────────────
// On top of the category shown from the start, a stuck player can ask for up
// to MAX_HINTS more, one at a time (the server keeps the word: it sends each
// hint only once asked for, motDuJourController.js):
//   1 light   a first clue on the word        (text written for each word)
//   2 medium  a much more precise clue        (text written for each word)
//   3 strong  the first letter                (letterPattern, level 3)
//   4 partial about half the letters, in place (letterPattern, level 4)
export const MAX_HINTS = 4

export const HINT_LABELS = ['Indice léger', 'Indice intermédiaire', 'Indice fort', 'Révélation partielle']

/**
 * The letters a hint shows, "_" for the others: level 3 shows the first
 * letter (G____), level 4 every other letter from the first (G_B_N), so at
 * least two letters always stay to find.
 */
export function letterPattern(answer, level) {
  return [...answer].map((letter, i) => (i === 0 || (level >= 4 && i % 2 === 0) ? letter : '_')).join('')
}

/**
 * Ngori for a win: the quick-win or normal reward, less hintCost for each hint
 * beyond the free ones (never under minHintedReward), plus the streak bonus.
 * @param {{ tries: number, hintsUsed?: number, streak: number }} game
 * @param {{ winReward, quickWinReward, quickWinTries, streakLength, streakBonus,
 *   freeHints?, hintCost?, minHintedReward? }} rewards
 */
export function rewardFor({ tries, hintsUsed = 0, streak }, rewards) {
  const base = tries <= rewards.quickWinTries ? rewards.quickWinReward : rewards.winReward
  const paidHints = Math.max(0, hintsUsed - (rewards.freeHints ?? MAX_HINTS))
  const reward = paidHints ? Math.max(rewards.minHintedReward ?? 1, base - paidHints * (rewards.hintCost ?? 0)) : base
  return reward + (streak > 0 && streak % rewards.streakLength === 0 ? rewards.streakBonus : 0)
}
