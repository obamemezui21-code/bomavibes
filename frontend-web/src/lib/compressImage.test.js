import { describe, expect, it } from 'vitest'
import { compressImage, scaledSize } from './compressImage.js'

describe('scaledSize', () => {
  it('keeps images already within the limit', () => {
    expect(scaledSize(1080, 1350)).toEqual({ width: 1080, height: 1350 })
  })

  it('scales a landscape photo down by its width', () => {
    expect(scaledSize(8000, 6000)).toEqual({ width: 2048, height: 1536 })
  })

  it('scales a portrait photo down by its height', () => {
    expect(scaledSize(3000, 4000)).toEqual({ width: 1536, height: 2048 })
  })
})

describe('compressImage', () => {
  it('returns small files untouched', async () => {
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
    expect(await compressImage(file)).toBe(file)
  })
})
