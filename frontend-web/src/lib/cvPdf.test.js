import { describe, expect, it } from 'vitest'
import { cvFileName, pdfText, permisLabel } from './cvPdf.js'

describe('pdfText', () => {
  it('keeps French text as is', () => {
    expect(pdfText('Opératrice – Contrôler l’ouverture « HSE » œuvre')).toBe('Opératrice – Contrôler l’ouverture « HSE » œuvre')
  })
  it('drops what the PDF fonts cannot print', () => {
    expect(pdfText('Motivée 💪 et 中文 ok')).toBe('Motivée et ok')
  })
  it('handles empty values', () => {
    expect(pdfText(null)).toBe('')
    expect(pdfText(undefined)).toBe('')
  })
})

describe('permisLabel', () => {
  it('reads the licence the way members type it', () => {
    expect(permisLabel('Permis B')).toBe('Permis B')
    expect(permisLabel('B')).toBe('Permis : B')
    expect(permisLabel('Aucun')).toBe('')
    expect(permisLabel('')).toBe('')
  })
})

describe('cvFileName', () => {
  it('is a safe file name', () => {
    expect(cvFileName('NDONG Awa Marie')).toBe('CV-NDONG-Awa-Marie.pdf')
    expect(cvFileName('Ëlodie  M’BA / Obiang')).toBe('CV-Elodie-M-BA-Obiang.pdf')
    expect(cvFileName('')).toBe('CV-PNPE.pdf')
  })
})
