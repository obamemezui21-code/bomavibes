import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { MIN_COMMON, dayQuestionIndexes, mutualFit, vibeScore, wants } from '../../../shared/vibe-check/score.mjs'

const require = createRequire(import.meta.url)
const { QUESTIONS, QUESTIONS_PER_DAY } = require('../../../backend/src/config/vibeCheckQuestions.js')

const answers = (bits) => Object.fromEntries([...bits].map((b, i) => [`q${i}`, Number(b)]))

describe('vibeScore', () => {
  it('needs enough questions answered by both', () => {
    expect(vibeScore(answers('0101'), answers('0101'))).toBeNull()
    expect(vibeScore(answers('01010'), answers('01010')).percent).toBe(100)
  })

  it('only counts questions both answered', () => {
    const mine = { ...answers('010101'), extra: 1 }
    const score = vibeScore(mine, answers('010100'))
    expect(score).toMatchObject({ common: 6, agree: 5, percent: 83 })
    expect(score.agreedOn).toEqual(['q0', 'q1', 'q2', 'q3', 'q4'])
  })

  it('counts weighted questions more', () => {
    const weights = { q0: 2 }
    // Disagreeing on the weighted question costs 2 of 6.
    expect(vibeScore(answers('00000'), answers('10000'), weights).percent).toBe(67)
    expect(vibeScore(answers('00000'), answers('00001'), weights).percent).toBe(83)
  })

  it('ranks more shared answers above a lucky few', () => {
    const fiveOfFive = vibeScore(answers('00000'), answers('00000'))
    const nineOfTen = vibeScore(answers('0000000000'), answers('0000000001'))
    expect(fiveOfFive.percent).toBeGreaterThan(nineOfTen.percent)
    expect(nineOfTen.rank).toBeGreaterThan(fiveOfFive.rank)
  })
})

describe('mutualFit', () => {
  it('needs each one to be looking for the other', () => {
    expect(wants('TOUS', null)).toBe(true)
    expect(wants('FEMME', null)).toBe(false)
    expect(mutualFit({ pref: 'FEMME', gender: 'HOMME' }, { pref: 'HOMME', gender: 'FEMME' })).toBe(true)
    expect(mutualFit({ pref: 'FEMME', gender: 'HOMME' }, { pref: 'FEMME', gender: 'FEMME' })).toBe(false)
    expect(mutualFit({ pref: 'TOUS', gender: 'FEMME' }, { pref: 'FEMME', gender: 'HOMME' })).toBe(true)
  })
})

describe('the questions', () => {
  it('have unique ids and two choices each', () => {
    const ids = QUESTIONS.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const q of QUESTIONS) expect(q.text && q.a && q.b, q.id).toBeTruthy()
    expect(QUESTIONS_PER_DAY).toBeGreaterThanOrEqual(MIN_COMMON)
  })

  it('are walked in order, a full day at a time, wrapping around', () => {
    const total = QUESTIONS.length
    expect(dayQuestionIndexes(0, total, 8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(dayQuestionIndexes(1, total, 8)[0]).toBe(8)
    expect(dayQuestionIndexes(-1, total, 8)[0]).toBe(total - 8)
    const seen = new Set()
    for (let d = 0; d < total / 8; d++) dayQuestionIndexes(d, total, 8).forEach((i) => seen.add(i))
    expect(seen.size).toBe(total)
  })
})
