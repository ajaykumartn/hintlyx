import { ProviderError } from '../../shared/llm'
import { SseParser } from './sse'

/** Reads the Retry-After header (seconds or HTTP date) into milliseconds, if present. */
export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(header)
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined
}

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
  // 429 (rate limit) and 5xx are worth retrying or trying the other provider. 401/400 are not.
  const retryable = res.status === 429 || res.status >= 500
  const base =
    res.status === 401
      ? `${provider}: the API key was rejected`
      : res.status === 429
        ? `${provider}: rate limit reached, trying a fallback`
        : res.status >= 500
          ? `${provider}: the service is temporarily unavailable`
          : `${provider}: request failed (${res.status})`
  return new ProviderError(detail ? `${base} — ${detail}` : base, retryable, res.status, parseRetryAfter(res.headers.get('retry-after')))
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

/** Streams a newline-delimited JSON response (used by Ollama), yielding extracted text. */
export async function* streamNdjson(
  res: Response,
  extract: (obj: unknown) => string | null
): AsyncGenerator<string> {
  let buffer = ''
  for await (const chunk of readTextChunks(res)) {
    buffer += chunk
    let nl: number
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (!line) continue
      try {
        const delta = extract(JSON.parse(line))
        if (delta) yield delta
      } catch {
        /* ignore a malformed line */
      }
    }
  }
  const last = buffer.trim()
  if (last) {
    try {
      const delta = extract(JSON.parse(last))
      if (delta) yield delta
    } catch {
      /* ignore */
    }
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
