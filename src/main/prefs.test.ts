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
    expect(sanitizePrefs({ invisible: true, hideFromTaskbar: 'yes', evil: 1 })).toEqual({
      invisible: true,
      hideFromTaskbar: false
    })
    expect(sanitizePrefs(null)).toEqual(DEFAULT_PREFS)
  })
})

describe('PrefsStore', () => {
  it('defaults to visible, then saves and reloads changes', () => {
    const storage = memory()
    const store = new PrefsStore(storage)
    expect(store.get()).toEqual({ invisible: false, hideFromTaskbar: false })
    store.update({ invisible: true })
    expect(new PrefsStore(storage).get()).toEqual({ invisible: true, hideFromTaskbar: false })
  })

  it('treats a corrupt file as defaults', () => {
    expect(new PrefsStore(memory('{oops')).get()).toEqual(DEFAULT_PREFS)
  })
})
