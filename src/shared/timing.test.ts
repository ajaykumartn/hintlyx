import { describe, expect, it } from 'vitest'
import { createTimer, formatReport, pushLimited } from './timing'

describe('createTimer', () => {
  it('records the time between marks and the total', () => {
    const times = [100, 150, 400, 420]
    const timer = createTimer('ask', () => times.shift()!)
    timer.mark('capture')
    timer.mark('llm')
    const report = timer.end()
    expect(report.label).toBe('ask')
    expect(report.steps).toEqual([
      { step: 'capture', ms: 50 },
      { step: 'llm', ms: 250 }
    ])
    expect(report.totalMs).toBe(320)
  })

  it('formats a readable log line', () => {
    const line = formatReport({ label: 'x', totalMs: 12.5, steps: [{ step: 'a', ms: 2 }], at: 0 })
    expect(line).toBe('[timing] x total=12.5ms | a=2ms')
  })
})

describe('pushLimited', () => {
  it('keeps only the newest items', () => {
    expect(pushLimited([1, 2, 3], 4, 3)).toEqual([2, 3, 4])
    expect(pushLimited([1], 2, 3)).toEqual([1, 2])
  })
})
