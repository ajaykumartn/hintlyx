import type { ChatTurn, Mode } from '../../shared/llm'

export interface CompletionRequest {
  system: string
  history: ChatTurn[]
  user: string
  /** PNG screenshot as base64 (no data: prefix), when a vision answer is wanted. */
  imageBase64?: string
  mode: Mode
  signal: AbortSignal
}

export interface LlmProvider {
  readonly id: 'groq' | 'gemini'
  readonly model: string
  /** True when this provider can read a screenshot. */
  readonly vision: boolean
  /** Streams answer text. Each yielded string is a delta to append. */
  stream(req: CompletionRequest, apiKey: string): AsyncGenerator<string>
}
