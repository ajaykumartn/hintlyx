import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { TextStorage } from './keyStore'

/** File-backed storage. Writes go to a temp file first so a crash cannot corrupt the file. */
export function fileStorage(path: string): TextStorage {
  return {
    read() {
      return existsSync(path) ? readFileSync(path, 'utf8') : null
    },
    write(data) {
      mkdirSync(dirname(path), { recursive: true })
      const tmp = `${path}.tmp`
      writeFileSync(tmp, data, { encoding: 'utf8', mode: 0o600 })
      renameSync(tmp, path)
    }
  }
}
