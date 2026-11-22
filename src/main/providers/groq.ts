import { ProviderError } from '../../shared/llm'
import { httpError, networkError, streamSse } from './http'
import { openAiDelta } from './sse'
import type { CompletionRequest, LlmProvider } from './types'

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

/**
 * Groq uses the OpenAI chat-completions API. These are text-only models, so a screenshot
 * cannot be sent here; the router sends image questions to Gemini instead.
 */
export class GroqProvider implements LlmProvider {
  readonly id = 'groq'
  readonly vision = false

  // Groq retired the Llama 3.x ids for free tiers in Aug 2026; gpt-oss-20b is a current fast model.
  constructor(
    readonly model = 'openai/gpt-oss-20b',
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async *stream(req: CompletionRequest, apiKey: string): AsyncGenerator<string> {
    const messages = [
      { role: 'system', content: req.system },
      ...req.history.map((t) => ({ role: t.role, content: t.text })),
      { role: 'user', content: req.user }
    ]

    let res: Response
    try {
      res = await this.fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, messages, stream: true, temperature: 0.4 }),
        signal: req.signal
      })
    } catch (err) {
      throw networkError('Groq', err)
    }
    if (!res.ok) throw await httpError(res, 'Groq')
    try {
      yield* streamSse(res, openAiDelta)
    } catch (err) {
      throw networkError('Groq', err)
    }
  }
}

export function assertGroqKey(key: string): void {
  if (!key.startsWith('gsk_')) throw new ProviderError('Groq: key should start with gsk_', false)
}
