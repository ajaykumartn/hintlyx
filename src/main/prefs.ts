import type { Preferences } from '../shared/ipc'
import type { TextStorage } from './keyStore'

export const DEFAULT_PREFS: Preferences = {
  invisible: false,
  hideFromTaskbar: false
}

/** Keeps only known boolean fields, so a bad file or bad IPC input cannot inject anything. */
export function sanitizePrefs(input: unknown, base: Preferences = DEFAULT_PREFS): Preferences {
  const out = { ...base }
  if (input && typeof input === 'object') {
    for (const key of Object.keys(DEFAULT_PREFS) as (keyof Preferences)[]) {
      const value = (input as Record<string, unknown>)[key]
      if (typeof value === 'boolean') out[key] = value
    }
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
