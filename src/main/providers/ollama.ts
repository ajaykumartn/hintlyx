import { ProviderError } from '../../shared/llm'
import { networkError, streamNdjson } from './http'
import type { CompletionRequest, LlmProvider } from './types'

/**
 * Local Ollama (offline fallback). Talks to the native /api/chat endpoint, which streams
 * newline-delimited JSON. No API key; it uses a base URL (default http://localhost:11434).
 * Vision works only if the chosen model supports images.
 */
export class OllamaProvider implements LlmProvider {
  readonly id = 'ollama'
  readonly vision = true

  constructor(
    readonly model: string,
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async *stream(req: CompletionRequest, _apiKey: string): AsyncGenerator<string> {
    const messages: { role: string; content: string; images?: string[] }[] = [
      { role: 'system', content: req.system },
      ...req.history.map((t) => ({ role: t.role, content: t.text }))
    ]
    const user: { role: string; content: string; images?: string[] } = { role: 'user', content: req.user }
    if (req.imageBase64) user.images = [req.imageBase64]
    messages.push(user)

    const url = `${this.baseUrl.replace(/\/$/, '')}/api/chat`
    let res: Response
    try {
      res = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, messages, stream: true, options: { temperature: 0.4 } }),
        signal: req.signal
      })
    } catch (err) {
      throw networkError('Ollama', err)
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new ProviderError(
        res.status === 404
          ? `Ollama: model "${this.model}" is not installed (run: ollama pull ${this.model})`
          : `Ollama: request failed (${res.status}) ${body.slice(0, 120)}`,
        false,
        res.status
      )
    }
    try {
      yield* streamNdjson(res, (obj) => {
        const o = obj as { message?: { content?: string } }
        return o.message?.content ?? null
      })
    } catch (err) {
      throw networkError('Ollama', err)
    }
  }
}
