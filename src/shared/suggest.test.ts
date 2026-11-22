import { describe, expect, it } from 'vitest'
import { parseSuggestions, suggestPrompt } from './suggest'

describe('parseSuggestions', () => {
  it('cleans numbering, bullets and quotes', () => {
    const text = '1. "Explain their last point"\n- Draft a reply\n• What should I ask back?'
    expect(parseSuggestions(text)).toEqual([
      'Explain their last point',
      'Draft a reply',
      'What should I ask back?'
    ])
  })

  it('drops blanks, duplicates and over-long lines, caps at 3', () => {
    const text = [
      'Summarise this',
      'summarise this', // duplicate (case-insensitive)
      '',
      'x'.repeat(120), // too long
      'Ask about budget',
      'One more thing',
      'And another' // beyond the cap of 3
    ].join('\n')
    expect(parseSuggestions(text)).toEqual(['Summarise this', 'Ask about budget', 'One more thing'])
  })

  it('returns empty for empty input', () => {
    expect(parseSuggestions('')).toEqual([])
    expect(parseSuggestions('\n  \n')).toEqual([])
  })
})

describe('suggestPrompt', () => {
  it('mentions the mode', () => {
    expect(suggestPrompt('Interview practice')).toContain('Interview practice')
  })
})
