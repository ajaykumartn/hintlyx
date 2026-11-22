import type { Provider } from '../shared/ipc'
import { ProviderError, type AnswerEvent, type AskRequest } from '../shared/llm'
import { systemPrompt, trimHistory, userPrompt } from '../shared/prompt'
import { parseSuggestions, suggestPrompt } from '../shared/suggest'
import type { Mode } from '../shared/llm'
import { GeminiProvider } from './providers/gemini'
import { GroqProvider } from './providers/groq'
import { buildPlan, unavailableReason, type ProviderChoice } from './providers/plan'
import type { CompletionRequest, LlmProvider } from './providers/types'

export interface KeyLookup {
  get(provider: Provider): string | null
}

function makeProvider(choice: ProviderChoice, fetchImpl: typeof fetch): LlmProvider {
  return choice.provider === 'groq'
    ? new GroqProvider(choice.model, fetchImpl)
    : new GeminiProvider(choice.model, fetchImpl)
}

/**
 * Runs one ask: builds the prompt, tries providers in order, and streams answer events.
 * Falls back to the next provider on a retryable failure, but only before any text has
 * streamed (so the user never sees a half answer replaced by another).
 */
export class LlmService {
  constructor(
    private readonly keys: KeyLookup,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async *answer(req: AskRequest, imageBase64: string | undefined, signal: AbortSignal): AsyncGenerator<AnswerEvent> {
    const available = (['groq', 'gemini'] as Provider[]).filter((p) => this.keys.get(p))
    const plan = buildPlan({ available, withScreen: req.withScreen, smart: req.smart })

    if (plan.length === 0) {
      yield { id: req.id, kind: 'error', message: unavailableReason(req.withScreen) }
      return
    }

    const completion: Omit<CompletionRequest, 'signal'> = {
      system: systemPrompt(req.mode, req.smart),
      history: trimHistory(req.history),
      user: userPrompt(req.question, req.withScreen, req.transcript),
      imageBase64: req.withScreen ? imageBase64 : undefined,
      mode: req.mode
    }

    const start = performance.now()
    let lastError: ProviderError | null = null

    for (const choice of plan) {
      const apiKey = this.keys.get(choice.provider)
      if (!apiKey) continue
      const provider = makeProvider(choice, this.fetchImpl)
      let streamed = false
      try {
        for await (const delta of provider.stream({ ...completion, signal }, apiKey)) {
          if (!streamed) {
            streamed = true
            yield { id: req.id, kind: 'start', provider: provider.id, model: provider.model }
          }
          yield { id: req.id, kind: 'delta', text: delta }
        }
        yield { id: req.id, kind: 'done', totalMs: Math.round(performance.now() - start) }
        return
      } catch (err) {
        const pe = err instanceof ProviderError ? err : new ProviderError(String(err), false)
        if (pe.message === 'cancelled') return
        lastError = pe
        // Once text has reached the user, do not silently switch providers.
        if (streamed || !pe.retryable) break
        // otherwise fall through to the next provider
      }
    }

    yield { id: req.id, kind: 'error', message: lastError?.message ?? 'The answer could not be generated.' }
  }

  /**
   * Generates a few short suggestions from the recent transcript (the copilot's "dynamic
   * actions"). Uses the fast text provider, non-streaming. Returns [] on any failure so the
   * UI simply shows nothing rather than an error.
   */
  async suggest(transcript: string, mode: Mode, signal: AbortSignal): Promise<string[]> {
    const text = transcript.trim()
    if (text.length < 20) return []
    const available = (['groq', 'gemini'] as Provider[]).filter((p) => this.keys.get(p))
    const plan = buildPlan({ available, withScreen: false, smart: false })
    if (plan.length === 0) return []

    const completion: Omit<CompletionRequest, 'signal'> = {
      system: suggestPrompt(mode),
      history: [],
      user: trimHistory([{ role: 'user', text }])[0]?.text ?? text,
      mode
    }

    for (const choice of plan) {
      const apiKey = this.keys.get(choice.provider)
      if (!apiKey) continue
      try {
        let collected = ''
        for await (const delta of makeProvider(choice, this.fetchImpl).stream({ ...completion, signal }, apiKey)) {
          collected += delta
          if (collected.length > 400) break // suggestions are short; stop runaway output
        }
        const parsed = parseSuggestions(collected)
        if (parsed.length > 0) return parsed
      } catch {
        // try the next provider
      }
    }
    return []
  }
}
