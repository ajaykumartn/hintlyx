import { describe, expect, it } from 'vitest'
import type { TextStorage } from './keyStore'
import { DEFAULT_PREFS, PrefsStore, sanitizePrefs } from './prefs'

const memory = (data: string | null = null): TextStorage & { data: string | null } => {
  const s = {
    data,
    read: () => s.data,
    write: (d: string) => {
      s.data = d
    }
  }
  return s
}

describe('sanitizePrefs', () => {
  it('keeps known booleans and drops everything else', () => {
    expect(sanitizePrefs({ invisible: false, hideFromTaskbar: 'yes', evil: 1 })).toEqual({
      ...DEFAULT_PREFS,
      invisible: false,
      hideFromTaskbar: false
    })
    expect(sanitizePrefs(null)).toEqual(DEFAULT_PREFS)
  })

  it('sanitizes the ollama config and rejects bad URLs', () => {
    const r = sanitizePrefs({ ollama: { enabled: true, baseUrl: 'http://localhost:11434/', model: 'qwen2.5' } })
    expect(r.ollama).toEqual({ enabled: true, baseUrl: 'http://localhost:11434', model: 'qwen2.5' })
    const bad = sanitizePrefs({ ollama: { enabled: true, baseUrl: 'file:///etc/passwd', model: '' } })
    expect(bad.ollama).toEqual({ enabled: true, baseUrl: DEFAULT_PREFS.ollama.baseUrl, model: DEFAULT_PREFS.ollama.model })
  })
})

describe('PrefsStore', () => {
  it('defaults to visible, then saves and reloads changes', () => {
    const storage = memory()
    const store = new PrefsStore(storage)
    expect(store.get()).toEqual(DEFAULT_PREFS)
    store.update({ invisible: false })
    expect(new PrefsStore(storage).get()).toEqual({ ...DEFAULT_PREFS, invisible: false })
  })

  it('treats a corrupt file as defaults', () => {
    expect(new PrefsStore(memory('{oops')).get()).toEqual(DEFAULT_PREFS)
  })
})
