import type { Mode } from './llm'

/**
 * Builds the prompt that turns a live transcript into a few short things the user could ask next.
 * The model must return one suggestion per line, no numbering, each a short question or action.
 */
export function suggestPrompt(mode: Mode): string {
  return (
    'You watch a live conversation and suggest what the user (the person using this assistant) ' +
    `could usefully ask their AI copilot next. Context: ${mode}. ` +
    'From the recent transcript, output 3 short suggestions, each on its own line. ' +
    'Each suggestion is a question or action under 8 words, phrased as the user would ask the copilot ' +
    '(for example: "Explain their last point", "Draft a reply", "What should I ask back?"). ' +
    'No numbering, no bullets, no quotes, no extra text. If nothing useful, output nothing.'
  )
}

const MAX_SUGGESTIONS = 3
const MAX_LEN = 60

/** Parses the model's lines into clean, de-duplicated suggestions. */
export function parseSuggestions(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split('\n')) {
    let line = raw.trim()
    if (!line) continue
    // Strip leading bullets, numbers, dashes and surrounding quotes.
    line = line.replace(/^[\s>*\-•\d.)\]]+/, '').replace(/^["'“”]|["'“”]$/g, '').trim()
    if (!line || line.length > MAX_LEN) continue
    const key = line.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(line)
    if (out.length >= MAX_SUGGESTIONS) break
  }
  return out
}
