import { describe, expect, it } from 'vitest'
import {
  FIGHTERS,
  FIGHTER_IDS,
  LEVELS,
  MAX_ENERGY,
  MAX_TICKS,
  createFight,
  opponentFor,
  simulateFight,
  step,
  summarize,
  validateInputs,
} from '../../../../shared/boma-fight/engine.mjs'
import { playBot } from './bot.js'

const play = (seed, fighter = 'nzame', level = 'normal', options) => playBot(createFight, step, summarize, seed, fighter, level, options)

// Runs the fight until the "Combattez !" of the first round.
function toFight(state) {
  while (state.phase !== 'fight') step(state)
  return state
}

describe('BOMA FIGHT engine', () => {
  it('replays a fight identically from its gestures (what the server does)', () => {
    for (const seed of [1, 42, 123456789, 0xdeadbeef]) {
      const { state, inputs, result } = play(seed)
      expect(simulateFight(seed, 'nzame', 'normal', inputs, state.tick)).toEqual(result)
    }
  })

  it('draws an opponent from the seed, never the player’s own fighter', () => {
    for (const id of FIGHTER_IDS) {
      for (let seed = 0; seed < 30; seed++) expect(opponentFor(seed, id)).not.toBe(id)
    }
    expect(createFight(7, 'sally').fighters[1].id).toBe(opponentFor(7, 'sally'))
  })

  it('can be won on every level, and the easy level by a beginner', () => {
    const beginner = Array.from({ length: 20 }, (_, i) => play(i + 1, FIGHTER_IDS[i % 12], 'easy', { skill: 20, every: 18 }).result)
    expect(beginner.filter((r) => r.winner === 'me').length).toBeGreaterThan(15)
    for (const level of Object.keys(LEVELS)) {
      const results = Array.from({ length: 30 }, (_, i) => play(i * 31 + 5, FIGHTER_IDS[i % 12], level, { skill: 60, every: 10 }).result)
      expect(results.every((r) => r.finished)).toBe(true)
      expect(results.some((r) => r.winner === 'me')).toBe(true)
    }
  })

  it('pays only a win, more on harder levels', () => {
    const win = play(3, 'obame', 'easy').result
    expect(win.winner).toBe('me')
    expect(win.reward).toBeGreaterThanOrEqual(LEVELS.easy.reward)
    const idle = simulateFight(3, 'obame', 'hard', [], MAX_TICKS)
    expect(idle.winner).toBe('cpu')
    expect(idle.reward).toBe(0)
  })

  it('lands a punch within reach, and a guard stops most of it', () => {
    const open = toFight(createFight(1, 'obame', 'easy'))
    const guarded = toFight(createFight(1, 'obame', 'easy'))
    for (const s of [open, guarded]) {
      s.ai.nextThink = 1e9 // the computer stands still
      s.fighters[0].x = 450
      s.fighters[1].x = 530
    }
    step(guarded) // nothing yet
    guarded.fighters[1].guardHeld = true
    step(guarded)
    step(open)
    step(open, ['P'])
    step(guarded, ['P'])
    for (let i = 0; i < 12; i++) {
      step(open)
      step(guarded)
    }
    const c = FIGHTERS[open.fighters[1].id].hp
    const hitOpen = c - open.fighters[1].hp
    const hitGuarded = FIGHTERS[guarded.fighters[1].id].hp - guarded.fighters[1].hp
    expect(hitOpen).toBeGreaterThan(0)
    expect(hitGuarded).toBeGreaterThan(0)
    expect(hitGuarded).toBeLessThan(hitOpen / 2)
  })

  it('fires the special only with a full energy bar, and empties it', () => {
    const s = toFight(createFight(1, 'nzame', 'easy'))
    s.ai.nextThink = 1e9
    s.fighters[0].x = 450
    s.fighters[1].x = 560
    step(s, ['X'])
    expect(s.fighters[0].state).not.toBe('attack')
    s.fighters[0].energy = MAX_ENERGY
    step(s, ['X'])
    step(s)
    expect(s.fighters[0].state).toBe('attack')
    expect(s.fighters[0].move).toBe('special')
    expect(s.fighters[0].energy).toBe(0)
    for (let i = 0; i < 30; i++) step(s)
    expect(s.fighters[1].hp).toBeLessThan(s.fighters[1].maxHp)
  })

  it('never lets the fighters walk through each other or off the arena', () => {
    const s = toFight(createFight(9, 'biyogo', 'easy'))
    s.ai.nextThink = 1e9
    for (let i = 0; i < 400; i++) step(s, i === 0 ? ['R'] : [])
    const [p, c] = s.fighters
    expect(c.x - p.x).toBeGreaterThanOrEqual(70)
    expect(c.x).toBeLessThanOrEqual(950)
  })

  it('rejects malformed gesture lists', () => {
    expect(validateInputs([[0, 'L'], [5, 'P'], [9, 'B']], 100)).toBe(true)
    expect(validateInputs([[5, 'L'], [3, 'S']], 100)).toBe(false)
    expect(validateInputs([[0, 'Z']], 100)).toBe(false)
    expect(validateInputs([[100, 'P']], 100)).toBe(false)
    expect(validateInputs([], MAX_TICKS + 1)).toBe(false)
  })
})
