import type { Provider } from '../../shared/ipc'

export interface ProviderChoice {
  provider: Provider
  /** The model id to use for this attempt. */
  model: string
}

export interface PlanInput {
  /** Providers whose API key is set. */
  available: Provider[]
  /** The question needs a screenshot, so only vision models qualify. */
  withScreen: boolean
  /** Smart mode: prefer the stronger (slower) model. */
  smart: boolean
}

export const MODELS = {
  groqFast: 'openai/gpt-oss-20b',
  groqSmart: 'openai/gpt-oss-120b',
  gemini: 'gemini-flash-latest',
  // Lighter Flash model; both support vision. Used when the main Flash model is overloaded (503).
  geminiLite: 'gemini-flash-lite-latest'
} as const

/** Gemini attempts, in order: full Flash first, then the lighter model as a fallback. */
function geminiChoices(): ProviderChoice[] {
  return [
    { provider: 'gemini', model: MODELS.gemini },
    { provider: 'gemini', model: MODELS.geminiLite }
  ]
}

/**
 * Decides which providers to try, in order, with fallbacks.
 * - Screen questions go only to vision providers (Gemini), full then lite.
 * - Text questions prefer Groq for speed, then fall back to Gemini.
 * Returns an empty list when no usable key is available.
 */
export function buildPlan({ available, withScreen, smart }: PlanInput): ProviderChoice[] {
  const has = (p: Provider) => available.includes(p)
  const plan: ProviderChoice[] = []

  if (withScreen) {
    if (has('gemini')) plan.push(...geminiChoices())
    return plan
  }

  if (has('groq')) plan.push({ provider: 'groq', model: smart ? MODELS.groqSmart : MODELS.groqFast })
  if (has('gemini')) plan.push(...geminiChoices())
  return plan
}

/** Why no provider could run, for a clear message to the user. */
export function unavailableReason(withScreen: boolean): string {
  return withScreen
    ? 'Screen answers need a Google Gemini key. Add one in Settings.'
    : 'Add a Groq or Gemini API key in Settings to get answers.'
}
