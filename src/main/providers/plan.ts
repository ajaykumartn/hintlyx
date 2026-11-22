import type { Provider } from '../../shared/ipc'

/** Providers that can run a completion: the keyed cloud ones plus local Ollama. */
export type ChoiceProvider = Provider | 'ollama'

export interface ProviderChoice {
  provider: ChoiceProvider
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
  /** Ollama model id when the offline fallback is enabled, else undefined. */
  ollamaModel?: string
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
export function buildPlan({ available, withScreen, smart, ollamaModel }: PlanInput): ProviderChoice[] {
  const has = (p: Provider) => available.includes(p)
  const plan: ProviderChoice[] = []

  if (withScreen) {
    if (has('gemini')) plan.push(...geminiChoices())
    // Ollama can read images only if its model is a vision model; offer it as a last resort.
    if (ollamaModel) plan.push({ provider: 'ollama', model: ollamaModel })
    return plan
  }

  if (has('groq')) plan.push({ provider: 'groq', model: smart ? MODELS.groqSmart : MODELS.groqFast })
  if (has('gemini')) plan.push(...geminiChoices())
  if (ollamaModel) plan.push({ provider: 'ollama', model: ollamaModel })
  return plan
}

/** Why no provider could run, for a clear message to the user. */
export function unavailableReason(withScreen: boolean): string {
  return withScreen
    ? 'Screen answers need a Google Gemini key. Add one in Settings.'
    : 'Add a Groq or Gemini API key in Settings to get answers.'
}
