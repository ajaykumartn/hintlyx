import { describe, expect, it } from 'vitest'
import { supportsCaptureExclusion } from './invisibility'

describe('supportsCaptureExclusion', () => {
  it('needs Windows 10 build 19041 or newer', () => {
    expect(supportsCaptureExclusion('win32', '10.0.19041')).toBe(true)
    expect(supportsCaptureExclusion('win32', '10.0.26300')).toBe(true)
    expect(supportsCaptureExclusion('win32', '10.0.18363')).toBe(false)
    expect(supportsCaptureExclusion('win32', '6.1.7601')).toBe(false)
    expect(supportsCaptureExclusion('win32', 'garbage')).toBe(false)
  })

  it('supports macOS and not Linux', () => {
    expect(supportsCaptureExclusion('darwin', '23.0.0')).toBe(true)
    expect(supportsCaptureExclusion('linux', '6.5.0')).toBe(false)
  })
})
