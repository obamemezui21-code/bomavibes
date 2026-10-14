import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { MAX_LENGTH, MIN_LENGTH, isValidGuess, keyboardMarks, markGuess, normalizeWord, shareText } from '../../../shared/mot-du-jour/engine.mjs'

const require = createRequire(import.meta.url)
const { WORDS } = require('../../../backend/src/config/motDuJourWords.js')

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
