import type { Provider } from '../shared/ipc'
import { ProviderError, type AnswerEvent, type AskRequest } from '../shared/llm'
import { systemPrompt, trimHistory, userPrompt } from '../shared/prompt'
import { parseSuggestions, suggestPrompt } from '../shared/suggest'
import type { Mode } from '../shared/llm'
import { GeminiProvider } from './providers/gemini'
import { GroqProvider } from './providers/groq'
import { OllamaProvider } from './providers/ollama'
import { buildPlan, unavailableReason, type ProviderChoice } from './providers/plan'
import type { CompletionRequest, LlmProvider } from './providers/types'

export interface KeyLookup {
  get(provider: Provider): string | null
}

export interface OllamaConfig {
  baseUrl: string
  model: string
}

function makeProvider(choice: ProviderChoice, fetchImpl: typeof fetch, ollamaBaseUrl: string): LlmProvider {
  if (choice.provider === 'groq') return new GroqProvider(choice.model, fetchImpl)
  if (choice.provider === 'gemini') return new GeminiProvider(choice.model, fetchImpl)
  return new OllamaProvider(choice.model, ollamaBaseUrl, fetchImpl)
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const id = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(id)
      resolve()
    }, { once: true })
  })

/**
 * Runs one ask: builds the prompt, tries providers in order, and streams answer events.
 * Falls back to the next provider on a retryable failure, but only before any text has
 * streamed (so the user never sees a half answer replaced by another).
 */
/** How many full passes over the plan to make when everything fails for a retryable reason. */
const MAX_PASSES = 2
const MAX_BACKOFF_MS = 1200

export class LlmService {
  constructor(
    private readonly keys: KeyLookup,
    private readonly fetchImpl: typeof fetch = fetch,
    /** Returns the Ollama offline-fallback config when enabled, else null. */
    private readonly ollama: () => OllamaConfig | null = () => null
  ) {}

  private credentialFor(choice: ProviderChoice): string | null {
    if (choice.provider === 'ollama') return this.ollama() ? '' : null
    return this.keys.get(choice.provider)
  }

  async *answer(req: AskRequest, imageBase64: string | undefined, signal: AbortSignal): AsyncGenerator<AnswerEvent> {
    const available = (['groq', 'gemini'] as Provider[]).filter((p) => this.keys.get(p))
    const ollamaCfg = this.ollama()
    const plan = buildPlan({
      available,
      withScreen: req.withScreen,
      smart: req.smart,
      ollamaModel: ollamaCfg?.model
    })

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
    const baseUrl = ollamaCfg?.baseUrl ?? ''
    let lastError: ProviderError | null = null
    let giveUp = false

    for (let pass = 0; pass < MAX_PASSES && !giveUp; pass++) {
      let anyRetryable = false
      for (const choice of plan) {
        const credential = this.credentialFor(choice)
        if (credential === null) continue
        const provider = makeProvider(choice, this.fetchImpl, baseUrl)
        let streamed = false
        try {
          for await (const delta of provider.stream({ ...completion, signal }, credential)) {
            if (signal.aborted) return
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
          if (pe.message === 'cancelled' || signal.aborted) return
          lastError = pe
          // Once text has reached the user, do not switch or retry — that would duplicate output.
          if (streamed) {
            giveUp = true
            break
          }
          if (!pe.retryable) {
            giveUp = true
            break
          }
          anyRetryable = true
        }
      }
      // Only a second pass if the whole plan failed for transient reasons.
      if (!giveUp && anyRetryable && pass + 1 < MAX_PASSES) {
        const wait = Math.min(lastError?.retryAfterMs ?? 400 * (pass + 1), MAX_BACKOFF_MS)
        await sleep(wait, signal)
        if (signal.aborted) return
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
      if (choice.provider === 'ollama') continue // suggestions use fast cloud models only
      const apiKey = this.keys.get(choice.provider)
      if (!apiKey) continue
      try {
        let collected = ''
        for await (const delta of makeProvider(choice, this.fetchImpl, '').stream({ ...completion, signal }, apiKey)) {
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
