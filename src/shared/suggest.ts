import type { Mode } from './llm'

/**
 * Builds the prompt that turns a live transcript into a few short things the user could ask next.
 * The model must return one suggestion per line, no numbering, each a short question or action.
 */
export function suggestPrompt(mode: Mode): string {
  return (
    'You read a live transcript of a conversation. Identify what the OTHER person (not the user of ' +
    `this assistant) is asking the user to answer right now. Context: ${mode}. ` +
    'Output up to 2 items, each on its own line, written as a clear standalone question or request ' +
    'that the user should respond to. Rewrite it so it makes sense on its own: resolve vague words ' +
    'like "it", "they" or "that" using the conversation, and phrase it as the exact question to answer ' +
    '(for example: "How would you design a URL shortener to scale?", "Why did you leave your last job?"). ' +
    'Keep each under 14 words. If there is no clear question, output one short action such as ' +
    '"Summarise the discussion". No numbering, no bullets, no quotes, no extra text.'
  )
}

const MAX_SUGGESTIONS = 3
const MAX_LEN = 90

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
