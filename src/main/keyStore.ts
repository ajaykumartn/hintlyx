import { PROVIDERS, isProvider, type KeyStatus, type Provider } from '../shared/ipc'

/** Encrypts secrets. In the app this wraps Electron safeStorage (Windows DPAPI). */
export interface Cipher {
  isAvailable(): boolean
  encrypt(plain: string): Buffer
  decrypt(data: Buffer): string
}

/** Reads and writes the raw key file. */
export interface TextStorage {
  read(): string | null
  write(data: string): void
}

interface KeyFile {
  version: 1
  keys: Partial<Record<Provider, string>>
}

const MAX_KEY_LENGTH = 512

export function maskKey(key: string): string {
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 4)}…${key.slice(-4)}`
}

export function validateKey(key: unknown): string {
  if (typeof key !== 'string') throw new Error('API key must be text.')
  const trimmed = key.trim()
  if (!trimmed) throw new Error('API key is empty.')
  if (trimmed.length > MAX_KEY_LENGTH) throw new Error('API key is too long.')
  if (/\s/.test(trimmed)) throw new Error('API key must not contain spaces.')
  return trimmed
}

/**
 * Stores API keys encrypted at rest. Plain keys never leave the main process.
 */
export class KeyStore {
  constructor(
    private readonly cipher: Cipher,
    private readonly storage: TextStorage
  ) {}

  get encryptionAvailable(): boolean {
    return this.cipher.isAvailable()
  }

  set(provider: Provider, key: unknown): void {
    if (!isProvider(provider)) throw new Error('Unknown provider.')
    const value = validateKey(key)
    if (!this.cipher.isAvailable()) {
      throw new Error('Secure storage is not available, so the key was not saved.')
    }
    const file = this.load()
    file.keys[provider] = this.cipher.encrypt(value).toString('base64')
    this.save(file)
  }

  get(provider: Provider): string | null {
    const encrypted = this.load().keys[provider]
    if (!encrypted) return null
    try {
      return this.cipher.decrypt(Buffer.from(encrypted, 'base64'))
    } catch {
      return null
    }
  }

  clear(provider: Provider): void {
    if (!isProvider(provider)) throw new Error('Unknown provider.')
    const file = this.load()
    delete file.keys[provider]
    this.save(file)
  }

  status(): Record<Provider, KeyStatus> {
    const result = {} as Record<Provider, KeyStatus>
    for (const p of PROVIDERS) {
      const key = this.get(p)
      result[p] = { set: key !== null, masked: key ? maskKey(key) : null }
    }
    return result
  }

  private load(): KeyFile {
    const raw = this.storage.read()
    if (!raw) return { version: 1, keys: {} }
    try {
      const parsed = JSON.parse(raw) as Partial<KeyFile>
      const keys: KeyFile['keys'] = {}
      for (const p of PROVIDERS) {
        const v = parsed.keys?.[p]
        if (typeof v === 'string') keys[p] = v
      }
      return { version: 1, keys }
    } catch {
      return { version: 1, keys: {} }
    }
  }

  private save(file: KeyFile): void {
    this.storage.write(JSON.stringify(file))
  }
}
