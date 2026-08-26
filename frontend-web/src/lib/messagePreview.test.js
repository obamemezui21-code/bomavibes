import { describe, expect, it } from 'vitest'
import { messagePreviewText } from './messagePreview.js'

describe('messagePreviewText', () => {
  it('returns an empty string for no message', () => {
    expect(messagePreviewText(null)).toBe('')
    expect(messagePreviewText(undefined)).toBe('')
  })

  it('returns the raw text for a plain text message', () => {
    expect(messagePreviewText({ text: 'Salut !' })).toBe('Salut !')
  })

  it('falls back to an empty string when a text message has no text', () => {
    expect(messagePreviewText({ type: 'text' })).toBe('')
  })

  it('describes a voice message regardless of its text field', () => {
    expect(messagePreviewText({ type: 'voice', text: '' })).toBe('🎤 Message vocal')
  })

  it('describes an image message', () => {
    expect(messagePreviewText({ type: 'image' })).toBe('📷 Photo')
  })

  it('includes the file name for a file message', () => {
    expect(messagePreviewText({ type: 'file', fileName: 'contrat.pdf' })).toBe('📄 contrat.pdf')
  })

  it('falls back to a generic label when a file message has no name', () => {
    expect(messagePreviewText({ type: 'file' })).toBe('📄 Document')
  })

  it('describes a sticker message', () => {
    expect(messagePreviewText({ type: 'sticker' })).toBe('😊 Sticker')
  })

  it('describes a shared post message', () => {
    expect(messagePreviewText({ type: 'post' })).toBe('📌 Publication partagée')
  })
})
