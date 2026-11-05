import { beforeEach, describe, expect, it, vi } from 'vitest'

const answer = (body, ok = true) => ({ ok, json: async () => body })
const headlines = [{ id: 1, title: 'Un titre' }]

describe('headlines', () => {
  let fetchHeadlines

  beforeEach(async () => {
    vi.resetModules()
    ;({ fetchHeadlines } = await import('./headlines.js'))
  })

  it('keeps the articles for a few minutes, then asks again', async () => {
    const fetchMock = vi.fn(async () => answer({ headlines }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchHeadlines(1000)).toEqual(headlines)
    await fetchHeadlines(2000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await fetchHeadlines(1000 + 6 * 60 * 1000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shows nothing when the server has nothing or refuses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer({ headlines: [] })))
    expect(await fetchHeadlines()).toEqual([])
    vi.stubGlobal('fetch', vi.fn(async () => answer(null, false)))
    expect(await fetchHeadlines()).toEqual([])
    vi.stubGlobal('fetch', vi.fn(async () => answer({ headlines: 'oops' })))
    expect(await fetchHeadlines()).toEqual([])
  })

  it('keeps the last articles when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer({ headlines })))
    await fetchHeadlines(1000)
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))
    expect(await fetchHeadlines(1000 + 6 * 60 * 1000)).toEqual(headlines)
  })

  it('never fails with no connection at all', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))
    await expect(fetchHeadlines()).resolves.toEqual([])
  })
})
