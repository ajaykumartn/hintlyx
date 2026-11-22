/**
 * Whisper tends to "hallucinate" short filler on silence or noise — most often thanks/like/subscribe
 * phrases from its training data. These add nothing and pollute the context, so we drop them.
 */
const NOISE = new Set([
  'thank you',
  'thanks',
  'thank you.',
  'thanks.',
  'thank you so much',
  'thanks for watching',
  'thanks for watching!',
  'please subscribe',
  'like and subscribe',
  'you',
  'you.',
  '.',
  '..',
  '...',
  'bye',
  'bye.',
  'okay',
  'ok',
  'mm',
  'mhm',
  'uh',
  'um'
])

function normalise(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** True when a transcription clip is empty or a known hallucination with no real content. */
export function isNoise(text: string): boolean {
  const n = normalise(text).replace(/[.!?]+$/, '')
  if (n.length === 0) return true
  if (NOISE.has(n) || NOISE.has(normalise(text))) return true
  // A single very short token (e.g. "a", "the") carries nothing useful on its own.
  if (n.length <= 2) return true
  return false
}

/**
 * Collapses immediately repeated short phrases that the chunk overlap can duplicate
 * ("work work" -> "work", "its own its own tool" -> "its own tool").
 */
export function dedupeWords(text: string): string {
  const re = /\b(\w[\w']*(?:\s+\w[\w']*){0,3})(\s+\1\b)+/gi
  let out = text
  for (let i = 0; i < 3; i++) {
    const next = out.replace(re, '$1')
    if (next === out) break
    out = next
  }
  return out
}

/**
 * Should a new clip be appended, given the previous line? Drops noise and near-duplicates
 * (the clip overlap can repeat the tail of the previous line).
 */
export function shouldAppend(text: string, previous: string | undefined): boolean {
  if (isNoise(text)) return false
  if (!previous) return true
  const a = normalise(text)
  const b = normalise(previous)
  return a !== b && !b.endsWith(a) && !a.endsWith(b)
}
