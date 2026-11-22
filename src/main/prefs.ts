import { DEFAULT_OLLAMA, type OllamaPrefs, type Preferences } from '../shared/ipc'
import type { TextStorage } from './keyStore'

export const DEFAULT_PREFS: Preferences = {
  invisible: false,
  hideFromTaskbar: false,
  ollama: { ...DEFAULT_OLLAMA }
}

const MAX_URL = 200
const MAX_MODEL = 100

function sanitizeOllama(input: unknown, base: OllamaPrefs): OllamaPrefs {
  const out = { ...base }
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>
    if (typeof o['enabled'] === 'boolean') out.enabled = o['enabled']
    // Accept only http/https URLs, to avoid pointing the app at anything odd.
    if (typeof o['baseUrl'] === 'string' && /^https?:\/\/\S+$/.test(o['baseUrl']) && o['baseUrl'].length <= MAX_URL) {
      out.baseUrl = o['baseUrl'].trim().replace(/\/$/, '')
    }
    if (typeof o['model'] === 'string' && o['model'].trim() && o['model'].length <= MAX_MODEL) {
      out.model = o['model'].trim()
    }
  }
  return out
}

/** Keeps only known fields, so a bad file or bad IPC input cannot inject anything. */
export function sanitizePrefs(input: unknown, base: Preferences = DEFAULT_PREFS): Preferences {
  const out: Preferences = { ...base, ollama: { ...base.ollama } }
  if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>
    if (typeof o['invisible'] === 'boolean') out.invisible = o['invisible']
    if (typeof o['hideFromTaskbar'] === 'boolean') out.hideFromTaskbar = o['hideFromTaskbar']
    if ('ollama' in o) out.ollama = sanitizeOllama(o['ollama'], out.ollama)
  }
  return out
}

export class PrefsStore {
  private current: Preferences

  constructor(private readonly storage: TextStorage) {
    this.current = this.load()
  }

  get(): Preferences {
    return { ...this.current }
  }

  update(patch: unknown): Preferences {
    this.current = sanitizePrefs(patch, this.current)
    this.storage.write(JSON.stringify(this.current))
    return this.get()
  }

  private load(): Preferences {
    const raw = this.storage.read()
    if (!raw) return { ...DEFAULT_PREFS }
    try {
      return sanitizePrefs(JSON.parse(raw))
    } catch {
      return { ...DEFAULT_PREFS }
    }
  }
}
