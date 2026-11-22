import { describe, expect, it } from 'vitest'
import { dedupeWords, isNoise, shouldAppend } from './transcript'

describe('isNoise', () => {
  it('flags empty, punctuation and Whisper filler', () => {
    expect(isNoise('')).toBe(true)
    expect(isNoise('   ')).toBe(true)
    expect(isNoise('.')).toBe(true)
    expect(isNoise('Thank you.')).toBe(true)
    expect(isNoise('thanks for watching')).toBe(true)
    expect(isNoise('you')).toBe(true)
  })
  it('keeps real content', () => {
    expect(isNoise('How does RAG work?')).toBe(false)
    expect(isNoise('Tell me about yourself')).toBe(false)
  })
})

describe('dedupeWords', () => {
  it('collapses immediate repeats', () => {
    expect(dedupeWords('How does RAG work work?')).toBe('How does RAG work?')
    expect(dedupeWords('its own its own tool')).toBe('its own tool')
  })
})

describe('shouldAppend', () => {
  it('drops noise and duplicates, keeps new content', () => {
    expect(shouldAppend('Thank you.', 'How does RAG work?')).toBe(false)
    expect(shouldAppend('How does RAG work?', 'How does RAG work?')).toBe(false)
    expect(shouldAppend('based application.', 'a RAG based application.')).toBe(false) // overlap tail
    expect(shouldAppend('What about zero days?', 'How does RAG work?')).toBe(true)
    expect(shouldAppend('First line', undefined)).toBe(true)
  })
})
