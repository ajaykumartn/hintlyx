import { networkError, httpError, streamSse } from './http'
import { geminiText } from './sse'
import type { CompletionRequest, LlmProvider } from './types'

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

interface GeminiPart {
  text?: string
  inline_data?: { mime_type: string; data: string }
}

/**
 * Gemini Flash. Supports vision, so screenshot questions come here. Uses the
 * streamGenerateContent endpoint with SSE. The API key goes in a header, not the URL,
 * so it never lands in logs that record URLs.
 */
export class GeminiProvider implements LlmProvider {
  readonly id = 'gemini'
  readonly vision = true

  // The -latest alias auto-updates to the newest stable Flash, so it survives version retirements.
  constructor(
    readonly model = 'gemini-flash-latest',
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async *stream(req: CompletionRequest, apiKey: string): AsyncGenerator<string> {
    const contents: { role: 'user' | 'model'; parts: GeminiPart[] }[] = []
    for (const turn of req.history) {
      contents.push({ role: turn.role === 'assistant' ? 'model' : 'user', parts: [{ text: turn.text }] })
    }
    const userParts: GeminiPart[] = [{ text: req.user }]
    if (req.imageBase64) {
      userParts.push({ inline_data: { mime_type: 'image/png', data: req.imageBase64 } })
    }
    contents.push({ role: 'user', parts: userParts })

    const url = `${BASE}/${this.model}:streamGenerateContent?alt=sse`
    let res: Response
    try {
      res = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: req.system }] },
          contents,
          generationConfig: { temperature: 0.4 }
        }),
        signal: req.signal
      })
    } catch (err) {
      throw networkError('Gemini', err)
    }
    if (!res.ok) throw await httpError(res, 'Gemini')
    try {
      yield* streamSse(res, geminiText)
    } catch (err) {
      throw networkError('Gemini', err)
    }
  }
}
