import { describe, expect, it } from 'vitest'
import { sortFeedTab } from './feedRanking.js'

const at = (ms) => ({ toMillis: () => ms })
const member = (id, likes, ms) => ({ id, authorId: 'u', likeCount: likes, createdAt: at(ms) })
const news = (id, ms) => ({ id, authorId: 'bomavibes-official', likeCount: 0, createdAt: at(ms), news: { title: id } })

describe('sortFeedTab', () => {
  const posts = [member('m1', 1, 300), news('n1', 400), member('m2', 9, 200), news('n2', 100)]

  it('puts the imported news on top of Populaire, newest first', () => {
    expect(sortFeedTab('popular', posts).map((p) => p.id)).toEqual(['n1', 'n2', 'm2', 'm1'])
  })

  it('keeps the other tabs to members’ posts', () => {
    expect(sortFeedTab('recent', posts).map((p) => p.id)).toEqual(['m1', 'm2'])
    expect(sortFeedTab('foryou', posts, {}, []).every((p) => !p.news)).toBe(true)
  })
})
