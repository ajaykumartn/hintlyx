/**
 * Turns a byte stream of Server-Sent Events into complete `data:` payloads.
 * Feed it chunks as they arrive; it yields each payload string once the full line is in,
 * buffering partial lines across chunk boundaries. The `[DONE]` sentinel is passed through.
 */
export class SseParser {
  private buffer = ''

  /** Returns the `data:` payloads completed by this chunk. */
  push(chunk: string): string[] {
    this.buffer += chunk
    const payloads: string[] = []
    let newline: number
    while ((newline = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newline).replace(/\r$/, '')
      this.buffer = this.buffer.slice(newline + 1)
      if (line.startsWith('data:')) payloads.push(line.slice(5).trimStart())
    }
    return payloads
  }

  /** Any trailing `data:` line with no final newline. */
  flush(): string[] {
    const rest = this.buffer
    this.buffer = ''
    if (rest.startsWith('data:')) return [rest.slice(5).trimStart()]
    return []
  }
}

/** Pulls the text delta out of an OpenAI-style streaming chunk (used by Groq). */
export function openAiDelta(payload: string): string | null {
  try {
    const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] }
    return json.choices?.[0]?.delta?.content ?? null
  } catch {
    return null
  }
}

/** Pulls the text out of a Gemini streaming chunk. */
export function geminiText(payload: string): string | null {
  try {
    const json = JSON.parse(payload) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const parts = json.candidates?.[0]?.content?.parts
    if (!parts) return null
    const text = parts.map((p) => p.text ?? '').join('')
    return text || null
  } catch {
    return null
  }
}
