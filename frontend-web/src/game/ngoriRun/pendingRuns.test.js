import { beforeEach, describe, expect, it, vi } from 'vitest'
import { forgetPendingRun, isFinalRefusal, keepPendingRun, pendingRunsOf } from './pendingRuns.js'

const DAY = 24 * 60 * 60 * 1000
const data = { inputs: [[1, 'U']], endTick: 100, claimed: { score: 10, distance: 5 } }

describe('NGORI RUN pending runs', () => {
  beforeEach(() => {
    const store = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v),
    })
  })

  it('keeps a run until it is forgotten, for its own player only', () => {
    expect(keepPendingRun('me', 'run1', data)).toBe(true)
    keepPendingRun('other', 'run2', data)
    expect(pendingRunsOf('me').map((p) => p.runId)).toEqual(['run1'])
    expect(pendingRunsOf('me')[0].data).toEqual(data)
    forgetPendingRun('run1')
    expect(pendingRunsOf('me')).toEqual([])
    expect(pendingRunsOf('other')).toHaveLength(1)
  })

  it('does not keep the same run twice, nor too many, nor old ones', () => {
    keepPendingRun('me', 'run1', data)
    keepPendingRun('me', 'run1', data)
    expect(pendingRunsOf('me')).toHaveLength(1)
    for (let i = 2; i <= 8; i++) keepPendingRun('me', `run${i}`, data)
    expect(pendingRunsOf('me').map((p) => p.runId)).toEqual(['run4', 'run5', 'run6', 'run7', 'run8'])
    expect(pendingRunsOf('me', Date.now() + DAY + 1000)).toEqual([])
  })

  it('survives a storage that fails', () => {
    const denied = () => {
      throw new Error('denied')
    }
    vi.stubGlobal('localStorage', { getItem: denied, setItem: denied })
    expect(keepPendingRun('me', 'run1', data)).toBe(false)
    expect(pendingRunsOf('me')).toEqual([])
  })

  it('only gives up on the answers a retry cannot change', () => {
    for (const status of [400, 404, 409]) expect(isFinalRefusal({ status })).toBe(true)
    for (const err of [{ status: 401 }, { status: 429 }, { status: 500 }, new TypeError('Failed to fetch')]) {
      expect(isFinalRefusal(err)).toBe(false)
    }
  })
})
