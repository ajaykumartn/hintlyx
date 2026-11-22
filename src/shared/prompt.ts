import type { ChatTurn, Mode } from './llm'

/** How Hintlyx should behave in each mode. Kept short to keep latency and token use low. */
const MODE_GUIDE: Record<Mode, string> = {
  'Interview practice':
    'The user is practising for a job interview. Give a strong, concise spoken answer they could say out loud. Prefer concrete examples and structure (for behavioural questions, situation, action, result).',
  Meeting:
    'The user is in a live meeting. Give a brief, useful reply or talking point they can say now. Be direct and practical.',
  Lecture:
    'The user is in a lecture or class. Explain clearly and briefly, defining key terms. Favour understanding over length.',
  'Coding help':
    'The user needs coding help. Give correct, idiomatic code and a short explanation. Note complexity or edge cases only when they matter.'
}

const BASE =
  'You are Hintlyx, a real-time assistant shown in a small overlay. ' +
  'Answer fast and keep it tight: the user is reading you live. ' +
  'Use short paragraphs or bullet points. Do not repeat the question. ' +
  'If a screenshot is provided, use what is on screen as the main context.'

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
