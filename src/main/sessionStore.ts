import type { SessionMessage, SessionRecord, SessionSummary } from '../shared/ipc'
import type { TextStorage } from './keyStore'

/** Keep at most this many sessions; the oldest are dropped. */
const MAX_SESSIONS = 50
const MAX_TRANSCRIPT = 20000
const MAX_MESSAGES = 200

function summarise(r: SessionRecord): SessionSummary {
  return { id: r.id, at: r.at, mode: r.mode, title: r.title, qaCount: r.messages.filter((m) => m.role === 'user').length }
}

function clampString(s: unknown, max: number): string {
  return typeof s === 'string' ? s.slice(0, max) : ''
}

/** Validates and trims a record coming from the renderer so nothing unbounded is stored. */
export function sanitiseRecord(input: unknown): SessionRecord | null {
  if (!input || typeof input !== 'object') return null
  const r = input as Record<string, unknown>
  if (typeof r['id'] !== 'string' || typeof r['at'] !== 'number' || typeof r['mode'] !== 'string') return null
  const messages = Array.isArray(r['messages'])
    ? r['messages']
        .filter((m): m is { role: string; text: string } => !!m && typeof m === 'object')
        .slice(0, MAX_MESSAGES)
        .map((m): SessionMessage => ({
          role: (m as { role: unknown }).role === 'assistant' ? 'assistant' : 'user',
          text: clampString((m as { text: unknown }).text, 8000)
        }))
    : []
  return {
    id: r['id'],
    at: r['at'],
    mode: clampString(r['mode'], 40),
    title: clampString(r['title'], 120) || 'Untitled session',
    transcript: clampString(r['transcript'], MAX_TRANSCRIPT),
    messages
  }
}

/** Persists past sessions (transcript and Q&A) as a JSON array, newest first. */
export class SessionStore {
  constructor(private readonly storage: TextStorage) {}

  list(): SessionSummary[] {
    return this.load().map(summarise)
  }

  get(id: string): SessionRecord | null {
    return this.load().find((s) => s.id === id) ?? null
  }

  /** Inserts or updates a session by id, keeping the list newest-first and capped. */
  save(input: unknown): void {
    const record = sanitiseRecord(input)
    if (!record || record.messages.length === 0) return
    const others = this.load().filter((s) => s.id !== record.id)
    const next = [record, ...others].slice(0, MAX_SESSIONS)
    this.storage.write(JSON.stringify(next))
  }

  remove(id: string): void {
    this.storage.write(JSON.stringify(this.load().filter((s) => s.id !== id)))
  }

  private load(): SessionRecord[] {
    const raw = this.storage.read()
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.map(sanitiseRecord).filter((r): r is SessionRecord => r !== null)
    } catch {
      return []
    }
  }
}
