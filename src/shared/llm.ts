import type { Provider } from './ipc'

export const MODES = ['Interview practice', 'Meeting', 'Lecture', 'Coding help'] as const
export type Mode = (typeof MODES)[number]

export function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && (MODES as readonly string[]).includes(value)
}

/** A turn in the on-screen conversation, sent back as context for follow-up questions. */
export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
}

/** What the renderer asks for. `withScreen` adds a screenshot for a vision model. */
export interface AskRequest {
  id: string
  mode: Mode
  question: string
  history: ChatTurn[]
  withScreen: boolean
  smart: boolean
  /** Recent live transcript of the conversation, used as context when present. */
  transcript?: string
}

export function isAskRequest(value: unknown): value is AskRequest {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return (
    typeof r['id'] === 'string' &&
    isMode(r['mode']) &&
    typeof r['question'] === 'string' &&
    Array.isArray(r['history']) &&
    typeof r['withScreen'] === 'boolean' &&
    typeof r['smart'] === 'boolean' &&
    (r['transcript'] === undefined || typeof r['transcript'] === 'string')
  )
}

/** Streaming events sent from main to the overlay for one ask. */
export type AnswerEvent =
  | { id: string; kind: 'start'; provider: Provider; model: string }
  | { id: string; kind: 'delta'; text: string }
  | { id: string; kind: 'done'; totalMs: number }
  | { id: string; kind: 'error'; message: string }

export class ProviderError extends Error {
  constructor(
    message: string,
    /** true when another provider should be tried (rate limit, 5xx, network). */
    readonly retryable: boolean,
    readonly status?: number
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}
