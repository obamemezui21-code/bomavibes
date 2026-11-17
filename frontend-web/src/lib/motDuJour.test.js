import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { MAX_HINTS, MAX_LENGTH, MIN_LENGTH, isValidGuess, keyboardMarks, letterPattern, markGuess, normalizeWord, rewardFor, shareText } from '../../../shared/mot-du-jour/engine.mjs'

const require = createRequire(import.meta.url)
const { WORDS } = require('../../../backend/src/config/motDuJourWords.js')
const { MOT_DU_JOUR } = require('../../../backend/src/config/ngori.js')

describe('normalizeWord', () => {
  it('drops accents, hyphens and case', () => {
    expect(normalizeWord('Okoumé')).toBe('OKOUME')
    expect(normalizeWord('Équateur')).toBe('EQUATEUR')
    expect(normalizeWord('rendez-vous')).toBe('RENDEZVOUS')
    expect(normalizeWord(undefined)).toBe('')
  })
})

describe('markGuess', () => {
  it('marks right place, wrong place and absent letters', () => {
    expect(markGuess('MBOLO', 'MBOLO')).toBe('CCCCC')
    expect(markGuess('GABON', 'AMOUR')).toBe('APAPA')
  })

  it('never marks more copies of a letter than the answer has', () => {
    expect(markGuess('MAMAN', 'AMOUR')).toBe('PPAAA')
    expect(markGuess('ALLEE', 'ELLES')).toBe('ACCCP')
    expect(markGuess('EEEEE', 'BISOU')).toBe('AAAAA')
  })
})

describe('isValidGuess', () => {
  it('needs exactly the right number of capital letters', () => {
    expect(isValidGuess('GABON', 5)).toBe(true)
    expect(isValidGuess('GABO', 5)).toBe(false)
    expect(isValidGuess('GAB0N', 5)).toBe(false)
  })
})

describe('keyboardMarks', () => {
  it('keeps the best mark seen for each letter', () => {
    const keys = keyboardMarks(['ALLEE', 'ELLES'], [markGuess('ALLEE', 'ELLES'), markGuess('ELLES', 'ELLES')])
    expect(keys).toEqual({ A: 'A', L: 'C', E: 'C', S: 'C' })
  })
})

describe('shareText', () => {
  it('shows the grid without the word', () => {
    const text = shareText({ day: '2026-10-15', marks: ['APAAA', 'CCCCC'], won: true })
    expect(text).toContain('15/10 — 2/6')
    expect(text).toContain('⬛🟨⬛⬛⬛\n🟩🟩🟩🟩🟩')
    expect(shareText({ day: '2026-10-15', marks: ['AAAAA'], won: false })).toContain('X/6')
    expect(text).not.toContain('💡')
    expect(shareText({ day: '2026-10-15', marks: ['CCCCC'], won: true, hints: 2 })).toContain('1/6 · 💡 2')
  })
})

describe('the word list', () => {
  it('has only playable, distinct words with a hint and a fact', () => {
    const answers = WORDS.map((w) => normalizeWord(w.word))
    for (const [i, answer] of answers.entries()) {
      expect(answer.length, WORDS[i].word).toBeGreaterThanOrEqual(MIN_LENGTH)
      expect(answer.length, WORDS[i].word).toBeLessThanOrEqual(MAX_LENGTH)
      expect(WORDS[i].hint && WORDS[i].fact, WORDS[i].word).toBeTruthy()
    }
    expect(new Set(answers).size).toBe(answers.length)
  })
})

describe('hints', () => {
  it('shows the first letter, then every other letter: never the whole word', () => {
    expect(letterPattern('GABON', 3)).toBe('G____')
    expect(letterPattern('GABON', 4)).toBe('G_B_N')
    expect(letterPattern('MANDRILL', 4)).toBe('M_N_R_L_')
    for (const w of WORDS) {
      const answer = normalizeWord(w.word)
      const hidden = [...letterPattern(answer, MAX_HINTS)].filter((l) => l === '_').length
      expect(hidden, w.word).toBeGreaterThanOrEqual(2)
    }
  })

  it('every word has two written clues that never give the word away', () => {
    for (const w of WORDS) {
      expect(w.clues, w.word).toHaveLength(2)
      const [light, medium] = w.clues
      expect(light.length, w.word).toBeGreaterThan(5)
      expect(medium.length, w.word).toBeGreaterThan(light.length / 2)
      expect(light, w.word).not.toBe(medium)
      for (const clue of w.clues) {
        expect(normalizeWord(clue), `${w.word}: ${clue}`).not.toContain(normalizeWord(w.word))
      }
    }
  })
})

describe('rewardFor', () => {
  const r = MOT_DU_JOUR
  it('pays as before without hints, or with the free one', () => {
    expect(rewardFor({ tries: 2, hintsUsed: 0, streak: 1 }, r)).toBe(r.quickWinReward)
    expect(rewardFor({ tries: 5, hintsUsed: 1, streak: 1 }, r)).toBe(r.winReward)
    expect(rewardFor({ tries: 5, streak: r.streakLength }, r)).toBe(r.winReward + r.streakBonus)
  })

  it('each paid hint lowers the win, never under the minimum', () => {
    expect(rewardFor({ tries: 3, hintsUsed: 2, streak: 1 }, r)).toBe(r.quickWinReward - r.hintCost)
    expect(rewardFor({ tries: 6, hintsUsed: 4, streak: 1 }, r)).toBe(r.minHintedReward)
    expect(rewardFor({ tries: 6, hintsUsed: 4, streak: r.streakLength }, r)).toBe(r.minHintedReward + r.streakBonus)
  })
})
