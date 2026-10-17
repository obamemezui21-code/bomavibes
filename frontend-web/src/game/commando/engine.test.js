import { describe, expect, it } from 'vitest'
import {
  FP,
  GROUND_Y,
  MISSIONS,
  MISSION_IDS,
  createGame,
  gradeFor,
  simulateGame,
  step,
  summarize,
  validateInputs,
  xpFor,
} from '../../../../shared/commando-okoume/engine.mjs'

// A simple scripted player: runs right firing, jumps over gaps and incoming
// shockwaves, stands under the crane and shoots up. Returns its gestures.
function botActions(state, memo) {
  const p = state.player
  const out = []
  const want = (key, value, on, off) => {
    if (memo[key] !== value) {
      memo[key] = value
      out.push(value ? on : off)
    }
  }
  want('fire', true, 'F', 'f')
  const xPx = Math.trunc(p.x / FP)
  const b = state.boss
  if (b && b.type === 'grutier') {
    const under = Math.trunc((b.x + (b.w / 2) * FP) / FP)
    const dir = xPx < under - 6 ? 'R' : xPx > under + 6 ? 'L' : 'S'
    if (memo.move !== dir) {
      memo.move = dir
      out.push(dir)
    }
    want('up', true, 'U', 'u')
  } else if (b) {
    const dir = xPx < Math.trunc(state.camX / FP) + 60 ? 'R' : 'S'
    if (memo.move !== dir) {
      memo.move = dir
      out.push(dir)
    }
    want('up', false, 'U', 'u')
  } else {
    if (memo.move !== 'R') {
      memo.move = 'R'
      out.push('R')
    }
    want('up', false, 'U', 'u')
  }
  if (p.onGround) {
    const floors = MISSIONS[state.mission].floors
    const groundAhead = floors.some(([x0, x1, y]) => y === GROUND_Y && xPx + 22 >= x0 && xPx + 22 <= x1)
    const wave = state.enemyShots.some((s) => s.kind === 'wave' && Math.abs(s.x - p.x) < 40 * FP)
    const runner = state.enemies.some((e) => e.type === 'runner' && Math.abs(e.x - p.x) < 30 * FP)
    if ((!groundAhead && !b) || wave || runner || state.tick % 97 === 0) out.push('J')
  }
  if (state.tick % 400 === 0) out.push('P')
  return out
}

function playBot(missionId, options) {
  const state = createGame(12345, missionId, options)
  const inputs = []
  const memo = {}
  while (!state.over) {
    const actions = botActions(state, memo)
    for (const a of actions) inputs.push([state.tick, a])
    step(state, actions)
  }
  return { state, inputs }
}

describe('commando engine', () => {
  it('is deterministic: the server replay matches the live game', () => {
    for (const id of MISSION_IDS) {
      const { state, inputs } = playBot(id, { character: 'mboumba', maxHp: 8 })
      const replay = simulateGame(12345, id, { character: 'mboumba', maxHp: 8 }, inputs, state.tick)
      expect(replay).toEqual(summarize(state))
      expect(validateInputs(inputs, state.tick)).toBe(true)
    }
  })

  it('every mission can be crossed up to its boss', () => {
    for (const id of MISSION_IDS) {
      const { state } = playBot(id, { character: 'moussavou', maxHp: 8 })
      expect(state.boss, `mission ${id}`).not.toBeNull()
    }
  })

  it('rejects malformed gestures', () => {
    expect(validateInputs([[5, 'R'], [3, 'J']], 10)).toBe(false)
    expect(validateInputs([[0, 'X']], 10)).toBe(false)
    expect(validateInputs([[0, 'R']], 0)).toBe(false)
  })

  it('a game with no gestures ends without a win', () => {
    const result = simulateGame(1, 1, {}, [], 60 * 60)
    expect(result.completed).toBe(false)
    expect(result.stars).toBe(0)
  })
})

describe('grades', () => {
  it('climbs with XP and unlocks Moussavou at Caporal', () => {
    expect(gradeFor(0)).toMatchObject({ name: 'Soldat', maxHp: 4, characters: ['mboumba'] })
    expect(gradeFor(300).name).toBe('Caporal')
    expect(gradeFor(300).characters).toContain('moussavou')
    expect(gradeFor(12000)).toMatchObject({ name: 'Colonel', maxHp: 7, nextXp: null })
  })

  it('gives XP for the score and the stars', () => {
    expect(xpFor({ score: 5000, completed: true, stars: 3 })).toBe(100 + 100 + 150)
    expect(xpFor({ score: 500, completed: false, stars: 0 })).toBe(10)
  })
})
