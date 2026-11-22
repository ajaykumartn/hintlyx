import { describe, expect, it } from 'vitest'
import type { TextStorage } from './keyStore'
import { sanitiseRecord, SessionStore } from './sessionStore'

const memory = (data: string | null = null): TextStorage & { data: string | null } => {
  const s = { data, read: () => s.data, write: (d: string) => { s.data = d } }
  return s
}

const rec = (id: string, at: number, title = 'Q') => ({
  id,
  at,
  mode: 'Meeting',
  title,
  transcript: 'hello world',
  messages: [{ role: 'user', text: title }, { role: 'assistant', text: 'answer' }]
})

describe('sanitiseRecord', () => {
  it('rejects malformed input and clamps fields', () => {
    expect(sanitiseRecord(null)).toBeNull()
    expect(sanitiseRecord({ id: 1 })).toBeNull()
    const r = sanitiseRecord({ id: 'a', at: 1, mode: 'x'.repeat(99), title: '', transcript: 5, messages: 'no' })
    expect(r?.title).toBe('Untitled session')
    expect(r?.transcript).toBe('')
    expect(r?.messages).toEqual([])
  })
})

describe('SessionStore', () => {
  it('saves newest-first, updates by id, and summarises', () => {
    const store = new SessionStore(memory())
    store.save(rec('a', 100, 'first'))
    store.save(rec('b', 200, 'second'))
    store.save(rec('a', 300, 'first-updated')) // update existing id
    const list = store.list()
    expect(list.map((s) => s.id)).toEqual(['a', 'b'])
    expect(list[0]).toMatchObject({ title: 'first-updated', qaCount: 1 })
  })

  it('ignores empty sessions and loads one back', () => {
    const store = new SessionStore(memory())
    store.save({ id: 'x', at: 1, mode: 'Meeting', title: 't', transcript: '', messages: [] })
    expect(store.list()).toEqual([])
    store.save(rec('y', 1))
    expect(store.get('y')?.messages).toHaveLength(2)
  })

  it('removes a session', () => {
    const store = new SessionStore(memory())
    store.save(rec('a', 1))
    store.remove('a')
    expect(store.list()).toEqual([])
  })

  it('treats a corrupt file as empty', () => {
    expect(new SessionStore(memory('{bad')).list()).toEqual([])
  })
})
