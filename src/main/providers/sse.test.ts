import { describe, expect, it } from 'vitest'
import { geminiText, openAiDelta, SseParser } from './sse'

describe('SseParser', () => {
  it('handles payloads split across chunks', () => {
    const p = new SseParser()
    expect(p.push('data: hel')).toEqual([])
    expect(p.push('lo\n')).toEqual(['hello'])
    expect(p.push('data: a\ndata: b\n')).toEqual(['a', 'b'])
  })

  it('ignores comments and event lines, keeps CRLF out', () => {
    const p = new SseParser()
    expect(p.push(': comment\nevent: x\ndata: {"a":1}\r\n')).toEqual(['{"a":1}'])
  })

  it('flushes a trailing line with no newline', () => {
    const p = new SseParser()
    expect(p.push('data: tail')).toEqual([])
    expect(p.flush()).toEqual(['tail'])
  })
})

describe('openAiDelta', () => {
  it('extracts the content delta', () => {
    expect(openAiDelta('{"choices":[{"delta":{"content":"Hi"}}]}')).toBe('Hi')
  })
  it('returns null for role-only or done chunks', () => {
    expect(openAiDelta('{"choices":[{"delta":{"role":"assistant"}}]}')).toBeNull()
    expect(openAiDelta('[DONE]')).toBeNull()
  })
})

describe('geminiText', () => {
  it('joins parts of a candidate', () => {
    expect(geminiText('{"candidates":[{"content":{"parts":[{"text":"a"},{"text":"b"}]}}]}')).toBe('ab')
  })
  it('returns null when there is no text', () => {
    expect(geminiText('{"candidates":[]}')).toBeNull()
    expect(geminiText('not json')).toBeNull()
  })
})
