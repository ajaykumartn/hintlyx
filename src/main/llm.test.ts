import { describe, expect, it } from 'vitest'
import type { AnswerEvent, AskRequest } from '../shared/llm'
import { LlmService, type KeyLookup } from './llm'

function sseResponse(lines: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder()
      for (const l of lines) controller.enqueue(enc.encode(l))
      controller.close()
    }
  })
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

function groqChunk(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n`
}
function geminiChunk(text: string): string {
  return `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n`
}

const keys = (set: Partial<Record<'groq' | 'gemini', string>>): KeyLookup => ({
  get: (p) => set[p] ?? null
})

const ask = (over: Partial<AskRequest> = {}): AskRequest => ({
  id: 'r1',
  mode: 'Meeting',
  question: 'hello',
  history: [],
  withScreen: false,
  smart: false,
  ...over
})

async function collect(gen: AsyncGenerator<AnswerEvent>): Promise<AnswerEvent[]> {
  const out: AnswerEvent[] = []
  for await (const e of gen) out.push(e)
  return out
}

describe('LlmService', () => {
  it('streams Groq deltas with start and done', async () => {
    const fetchImpl = (async () => sseResponse([groqChunk('Hel'), groqChunk('lo'), 'data: [DONE]\n'])) as unknown as typeof fetch
    const svc = new LlmService(keys({ groq: 'gsk_x' }), fetchImpl)
    const events = await collect(svc.answer(ask(), undefined, new AbortController().signal))
    expect(events[0]).toMatchObject({ kind: 'start', provider: 'groq' })
    expect(events.filter((e) => e.kind === 'delta').map((e) => (e as { text: string }).text).join('')).toBe('Hello')
    expect(events.at(-1)?.kind).toBe('done')
  })

  it('falls back to Gemini when Groq is rate limited before any text', async () => {
    const fetchImpl = (async (url: string) => {
      if (url.includes('groq')) return new Response('{"error":{"message":"slow down"}}', { status: 429 })
      return sseResponse([geminiChunk('Hi there'), 'data: [DONE]\n'])
    }) as unknown as typeof fetch
    const svc = new LlmService(keys({ groq: 'gsk_x', gemini: 'AQ.y' }), fetchImpl)
    const events = await collect(svc.answer(ask(), undefined, new AbortController().signal))
    expect(events.find((e) => e.kind === 'start')).toMatchObject({ provider: 'gemini' })
    expect(events.at(-1)?.kind).toBe('done')
  })

  it('does not fall back on a bad key (401)', async () => {
    const fetchImpl = (async () => new Response('{"error":{"message":"bad key"}}', { status: 401 })) as unknown as typeof fetch
    const svc = new LlmService(keys({ groq: 'gsk_x', gemini: 'AQ.y' }), fetchImpl)
    const events = await collect(svc.answer(ask(), undefined, new AbortController().signal))
    const err = events.at(-1)
    expect(err?.kind).toBe('error')
    expect((err as { message: string }).message).toContain('key was rejected')
  })

  it('errors clearly when a screen question has no Gemini key', async () => {
    const svc = new LlmService(keys({ groq: 'gsk_x' }), (async () => new Response()) as unknown as typeof fetch)
    const events = await collect(svc.answer(ask({ withScreen: true }), 'imgdata', new AbortController().signal))
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ kind: 'error' })
    expect((events[0] as { message: string }).message).toContain('Gemini key')
  })
})
