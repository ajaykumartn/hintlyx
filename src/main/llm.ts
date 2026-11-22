import type { Provider } from '../shared/ipc'
import { ProviderError, type AnswerEvent, type AskRequest } from '../shared/llm'
import { systemPrompt, trimHistory, userPrompt } from '../shared/prompt'
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
}
