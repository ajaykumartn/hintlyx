import type { ChatTurn, Mode } from './llm'

/** How Hintlyx should behave in each mode. Kept short to keep latency and token use low. */
const MODE_GUIDE: Record<Mode, string> = {
  'Interview practice':
    'The user is in a job interview. Give them the words to say, in the first person, as a real, confident person would speak them out loud — natural and warm, not a robotic essay. For behavioural questions follow a situation, action, result shape but keep it flowing like speech. Bold only the one or two phrases that carry the point.',
  Meeting:
    'The user is in a live meeting. Give a short, natural reply or talking point they can say right now, in the first person. Sound like a thoughtful colleague, not a document.',
  Lecture:
    'The user is in a lecture or class. Explain clearly and simply, like a good teacher talking to them. Define key terms in plain words. Use short bullets when listing.',
  'Coding help':
    'The user needs coding help. Give correct, idiomatic code in a fenced code block with the language tag, then a short, plain-English explanation. Mention complexity or edge cases only when they matter.'
}

const BASE =
  'You are Hintlyx, a real-time assistant shown in a small overlay. ' +
  'Answer fast and keep it tight: the user is reading you live. Do not repeat the question. ' +
  'Write in a natural, human voice — the way a sharp person actually talks, not a formal report. ' +
  'Format with clean Markdown so it is easy to scan: short paragraphs, **bold** for the few key words, ' +
  '"-" bullets when you list things, and fenced ```code``` blocks for code. Keep bolding and structure light; ' +
  'never bold whole sentences. If a screenshot is provided, use what is on screen as the main context.'

export function systemPrompt(mode: Mode, smart: boolean): string {
  const depth = smart
    ? ' Think carefully and give a thorough, well-reasoned answer.'
    : ' Favour speed and brevity over completeness.'
  return `${BASE}\n\nMode: ${mode}. ${MODE_GUIDE[mode]}${depth}`
}

const MAX_HISTORY_TURNS = 6
const MAX_TURN_CHARS = 1200

function clip(text: string, max: number): string {
  const t = text.trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

/** Trims history to the most recent turns so prompts stay small. */
export function trimHistory(history: ChatTurn[]): ChatTurn[] {
  return history
    .filter((t) => t.text.trim().length > 0)
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => ({ role: t.role, text: clip(t.text, MAX_TURN_CHARS) }))
}

const MAX_TRANSCRIPT_CHARS = 2000

export function userPrompt(question: string, withScreen: boolean, transcript?: string): string {
  const q = question.trim()
  const context = transcript?.trim()
    ? `Recent conversation (live transcript, may have small errors):\n${clip(transcript, MAX_TRANSCRIPT_CHARS)}\n\n`
    : ''

  let core: string
  if (withScreen) {
    core = q
      ? `Looking at my screen: ${q}`
      : 'Look at my screen and tell me what to do or say next. If it is a question or problem, answer it.'
  } else if (!q && context) {
    core = 'Based on the conversation above, what should I say next?'
  } else {
    core = q
  }
  return context + core
}
