/**
 * Audio helpers for turning captured Float32 PCM into a 16 kHz mono WAV, which is what
 * Whisper expects and keeps uploads small. All pure functions, so they are unit-tested.
 */

export const TARGET_SAMPLE_RATE = 16000

export function concatFloat32(chunks: Float32Array[]): Float32Array {
  let total = 0
  for (const c of chunks) total += c.length
  const out = new Float32Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

/** Resamples mono PCM from one rate to another by linear interpolation. */
export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || input.length === 0) return input
  const ratio = fromRate / toRate
  const outLength = Math.max(1, Math.floor(input.length / ratio))
  const out = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio
    const left = Math.floor(pos)
    const right = Math.min(left + 1, input.length - 1)
    const frac = pos - left
    out[i] = input[left]! * (1 - frac) + input[right]! * frac
  }
  return out
}

/** Root-mean-square loudness, used to skip silent chunks (no point transcribing silence). */
export function rms(input: Float32Array): number {
  if (input.length === 0) return 0
  let sum = 0
  for (let i = 0; i < input.length; i++) sum += input[i]! * input[i]!
  return Math.sqrt(sum / input.length)
}

/** Builds a 16-bit PCM mono WAV file from Float32 samples at the given rate. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  const dataLen = samples.length * 2
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLen, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeString(36, 'data')
  view.setUint32(40, dataLen, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }
  return buffer
}

/** Resamples to 16 kHz and encodes to WAV in one step. */
export function toWav16k(samples: Float32Array, fromRate: number): ArrayBuffer {
  return encodeWav(resample(samples, fromRate, TARGET_SAMPLE_RATE), TARGET_SAMPLE_RATE)
}
