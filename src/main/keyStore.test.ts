import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { fileStorage } from './fileStorage'
import { KeyStore, maskKey, type Cipher, type TextStorage } from './keyStore'

/** Reversible fake cipher so tests can check nothing is stored in plain text. */
const fakeCipher = (available = true): Cipher => ({
  isAvailable: () => available,
  encrypt: (plain) => Buffer.from([...Buffer.from(plain)].map((b) => b ^ 0x5a)),
  decrypt: (data) => Buffer.from([...data].map((b) => b ^ 0x5a)).toString()
})

const memory = (): TextStorage & { data: string | null } => {
  const s = {
    data: null as string | null,
    read: () => s.data,
    write: (d: string) => {
      s.data = d
    }
  }
  return s
}

describe('KeyStore', () => {
  it('saves, reads and clears a key without storing it in plain text', () => {
    const storage = memory()
    const store = new KeyStore(fakeCipher(), storage)
    store.set('groq', '  gsk_abcdefgh12345678  ')
    expect(store.get('groq')).toBe('gsk_abcdefgh12345678')
    expect(storage.data).not.toContain('gsk_abcdefgh12345678')
    expect(store.status().groq).toEqual({ set: true, masked: 'gsk_…5678' })
    expect(store.status().gemini).toEqual({ set: false, masked: null })
    store.clear('groq')
    expect(store.get('groq')).toBeNull()
  })

  it('rejects bad input', () => {
    const store = new KeyStore(fakeCipher(), memory())
    expect(() => store.set('groq', '')).toThrow('empty')
    expect(() => store.set('groq', 'has space')).toThrow('spaces')
    expect(() => store.set('groq', 'x'.repeat(600))).toThrow('too long')
    expect(() => store.set('openai' as never, 'abc')).toThrow('Unknown provider')
    expect(() => store.set('groq', 42)).toThrow('text')
  })

  it('refuses to save when secure storage is unavailable', () => {
    const store = new KeyStore(fakeCipher(false), memory())
    expect(() => store.set('gemini', 'AIzaSyabcdef')).toThrow('Secure storage')
  })

  it('treats a corrupt file as empty', () => {
    const storage = memory()
    storage.data = '{not json'
    const store = new KeyStore(fakeCipher(), storage)
    expect(store.get('groq')).toBeNull()
    store.set('groq', 'gsk_newkey123')
    expect(store.get('groq')).toBe('gsk_newkey123')
  })
})

describe('maskKey', () => {
  it('hides short keys fully', () => {
    expect(maskKey('abc')).toBe('••••')
  })
})

describe('fileStorage', () => {
  let dir: string | null = null
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
    dir = null
  })

  it('writes and reads a file, creating folders', () => {
    dir = mkdtempSync(join(tmpdir(), 'hintlyx-'))
    const path = join(dir, 'nested', 'keys.json')
    const fs = fileStorage(path)
    expect(fs.read()).toBeNull()
    fs.write('{"a":1}')
    expect(fs.read()).toBe('{"a":1}')
    expect(readFileSync(path, 'utf8')).toBe('{"a":1}')
  })
})
