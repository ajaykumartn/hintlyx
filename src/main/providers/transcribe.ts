import { networkError, httpError } from './http'
import { ProviderError } from '../../shared/llm'

const ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions'
const MODEL = 'whisper-large-v3-turbo'

/**
 * Transcribes a WAV clip with Groq's hosted Whisper Turbo. Returns the text (possibly empty
 * for silence). `language` is a hint like 'en'; omit for auto-detect.
 */
export async function transcribeWav(
  wav: ArrayBuffer,
  apiKey: string,
  opts: { language?: string; signal?: AbortSignal; fetchImpl?: typeof fetch } = {}
): Promise<string> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const form = new FormData()
  form.append('file', new Blob([wav], { type: 'audio/wav' }), 'clip.wav')
  form.append('model', MODEL)
  form.append('response_format', 'json')
  form.append('temperature', '0')
  if (opts.language) form.append('language', opts.language)

  let res: Response
  try {
    res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: opts.signal
    })
  } catch (err) {
    throw networkError('Groq Whisper', err)
  }
  if (!res.ok) throw await httpError(res, 'Groq Whisper')
  try {
    const json = (await res.json()) as { text?: string }
    return (json.text ?? '').trim()
  } catch (err) {
    throw new ProviderError(`Groq Whisper: bad response — ${err instanceof Error ? err.message : String(err)}`, false)
  }
}
