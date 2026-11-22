import { describe, expect, it } from 'vitest'
import { concatFloat32, encodeWav, resample, rms, toWav16k, TARGET_SAMPLE_RATE } from './audio'

describe('concatFloat32', () => {
  it('joins chunks in order', () => {
    expect(Array.from(concatFloat32([new Float32Array([1, 2]), new Float32Array([3])]))).toEqual([1, 2, 3])
  })
})

describe('resample', () => {
  it('halves the length going from 32k to 16k', () => {
    const input = new Float32Array(100)
    expect(resample(input, 32000, 16000).length).toBe(50)
  })
  it('returns the input unchanged when rates match', () => {
    const input = new Float32Array([0.1, 0.2])
    expect(resample(input, 16000, 16000)).toBe(input)
  })
})

describe('rms', () => {
  it('is zero for silence and positive for a tone', () => {
    expect(rms(new Float32Array(10))).toBe(0)
    expect(rms(new Float32Array([1, -1, 1, -1]))).toBe(1)
  })
})

describe('encodeWav', () => {
  it('writes a valid 44-byte header and PCM body', () => {
    const wav = encodeWav(new Float32Array([0, 1, -1]), 16000)
    const view = new DataView(wav)
    const tag = (o: number) => String.fromCharCode(view.getUint8(o), view.getUint8(o + 1), view.getUint8(o + 2), view.getUint8(o + 3))
    expect(tag(0)).toBe('RIFF')
    expect(tag(8)).toBe('WAVE')
    expect(tag(36)).toBe('data')
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(wav.byteLength).toBe(44 + 3 * 2)
    // Full-scale samples clamp to the 16-bit limits.
    expect(view.getInt16(44 + 2, true)).toBe(0x7fff)
    expect(view.getInt16(44 + 4, true)).toBe(-0x8000)
  })
})

describe('toWav16k', () => {
  it('produces a 16 kHz wav from 48 kHz input', () => {
    const wav = toWav16k(new Float32Array(4800), 48000)
    expect(new DataView(wav).getUint32(24, true)).toBe(TARGET_SAMPLE_RATE)
    // 4800 samples at 48k -> 1600 samples at 16k -> 44 + 3200 bytes
    expect(wav.byteLength).toBe(44 + 1600 * 2)
  })
})
