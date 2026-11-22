import { ProviderError } from '../../shared/llm'
import { SseParser } from './sse'

/** Maps a failed HTTP response to a ProviderError, reading the body for a message. */
export async function httpError(res: Response, provider: string): Promise<ProviderError> {
  let detail = ''
  try {
    const body = await res.text()
    const json = JSON.parse(body) as { error?: { message?: string } | string }
    detail = typeof json.error === 'string' ? json.error : (json.error?.message ?? body.slice(0, 200))
  } catch {
    /* keep detail empty */
  }
  // 429 (rate limit) and 5xx are worth trying the other provider. 401/400 are not.
  const retryable = res.status === 429 || res.status >= 500
  const base =
    res.status === 401
      ? `${provider}: the API key was rejected`
      : res.status === 429
        ? `${provider}: rate limit reached`
        : `${provider}: request failed (${res.status})`
  return new ProviderError(detail ? `${base} — ${detail}` : base, retryable, res.status)
}

/** Reads a fetch response body as decoded text chunks. */
export async function* readTextChunks(res: Response): AsyncGenerator<string> {
  const reader = res.body?.getReader()
  if (!reader) throw new ProviderError('No response body from provider', true)
  const decoder = new TextDecoder()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      yield decoder.decode(value, { stream: true })
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Streams an SSE response, yielding the text delta from each `data:` payload.
 * Stops at the `[DONE]` sentinel. `extract` returns the delta text or null to skip.
 */
export async function* streamSse(
  res: Response,
  extract: (payload: string) => string | null
): AsyncGenerator<string> {
  const parser = new SseParser()
  for await (const chunk of readTextChunks(res)) {
    for (const payload of parser.push(chunk)) {
      if (payload === '[DONE]') return
      const delta = extract(payload)
      if (delta) yield delta
    }
  }
  for (const payload of parser.flush()) {
    if (payload === '[DONE]') return
    const delta = extract(payload)
    if (delta) yield delta
  }
}

export function networkError(provider: string, err: unknown): ProviderError {
  if (err instanceof ProviderError) return err
  if (err instanceof DOMException && err.name === 'AbortError') {
    return new ProviderError('cancelled', false)
  }
  const message = err instanceof Error ? err.message : String(err)
  return new ProviderError(`${provider}: network error — ${message}`, true)
}
