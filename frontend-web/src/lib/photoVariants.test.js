import { describe, expect, it } from 'vitest'
import { fallbackToFullPhoto, photoVariant } from './photoVariants.js'

describe('photoVariant', () => {
  it('inserts the size suffix before the extension', () => {
    expect(photoVariant('https://cdn.bomavibes.tech/photo-0.jpg', 'thumb')).toBe(
      'https://cdn.bomavibes.tech/photo-0-thumb.jpg',
    )
    expect(photoVariant('https://cdn.bomavibes.tech/photo-2.jpg', 'medium')).toBe(
      'https://cdn.bomavibes.tech/photo-2-medium.jpg',
    )
  })

  it('preserves a query string after the extension', () => {
    expect(photoVariant('https://cdn.bomavibes.tech/photo-0.jpg?alt=media&token=abc', 'thumb')).toBe(
      'https://cdn.bomavibes.tech/photo-0-thumb.jpg?alt=media&token=abc',
    )
  })

  it('returns the original URL unchanged when size is "full"', () => {
    const url = 'https://cdn.bomavibes.tech/photo-0.jpg'
    expect(photoVariant(url, 'full')).toBe(url)
  })

  it('returns non-matching URLs (e.g. dicebear avatars) unchanged', () => {
    const url = 'https://api.dicebear.com/9.x/personas/svg?seed=Amelie'
    expect(photoVariant(url, 'thumb')).toBe(url)
  })

  it('is safe to call on null/undefined/non-string input', () => {
    expect(photoVariant(null, 'thumb')).toBeNull()
    expect(photoVariant(undefined, 'thumb')).toBeUndefined()
    expect(photoVariant(42, 'thumb')).toBe(42)
  })
})

describe('fallbackToFullPhoto', () => {
  it('swaps the img src to the original URL and disarms further onError calls', () => {
    const handler = fallbackToFullPhoto('https://cdn.bomavibes.tech/photo-0.jpg')
    const target = { onerror: () => {}, src: 'https://cdn.bomavibes.tech/photo-0-thumb.jpg' }

    handler({ currentTarget: target })

    expect(target.src).toBe('https://cdn.bomavibes.tech/photo-0.jpg')
    expect(target.onerror).toBeNull()
  })
})
