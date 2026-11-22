import { describe, expect, it } from 'vitest'
import { buildPlan, MODELS } from './plan'

describe('buildPlan', () => {
  it('prefers Groq fast for plain text, then Gemini (full then lite) as fallback', () => {
    expect(buildPlan({ available: ['groq', 'gemini'], withScreen: false, smart: false })).toEqual([
      { provider: 'groq', model: MODELS.groqFast },
      { provider: 'gemini', model: MODELS.gemini },
      { provider: 'gemini', model: MODELS.geminiLite }
    ])
  })

  it('uses the stronger Groq model in smart mode', () => {
    expect(buildPlan({ available: ['groq'], withScreen: false, smart: true })).toEqual([
      { provider: 'groq', model: MODELS.groqSmart }
    ])
  })

  it('sends screen questions only to vision providers, full then lite', () => {
    expect(buildPlan({ available: ['groq', 'gemini'], withScreen: true, smart: false })).toEqual([
      { provider: 'gemini', model: MODELS.gemini },
      { provider: 'gemini', model: MODELS.geminiLite }
    ])
    // Groq alone cannot answer a screen question.
    expect(buildPlan({ available: ['groq'], withScreen: true, smart: false })).toEqual([])
  })

  it('falls back to Gemini when only Gemini has a key', () => {
    expect(buildPlan({ available: ['gemini'], withScreen: false, smart: false })).toEqual([
      { provider: 'gemini', model: MODELS.gemini },
      { provider: 'gemini', model: MODELS.geminiLite }
    ])
  })

  it('returns nothing when no key is available', () => {
    expect(buildPlan({ available: [], withScreen: false, smart: false })).toEqual([])
  })
})
