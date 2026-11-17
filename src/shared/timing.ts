export interface TimingStep {
  step: string
  ms: number
}

export interface TimingReport {
  label: string
  totalMs: number
  steps: TimingStep[]
  at: number
}

export type Clock = () => number

const round = (ms: number): number => Math.round(ms * 10) / 10

/**
 * Measures a flow (for example "hotkey -> overlay shown") step by step.
 * Each mark() records the time since the previous mark.
 */
export function createTimer(label: string, now: Clock = () => performance.now()) {
  const start = now()
  let last = start
  const steps: TimingStep[] = []

  return {
    mark(step: string): void {
      const t = now()
      steps.push({ step, ms: round(t - last) })
      last = t
    },
    end(): TimingReport {
      return { label, totalMs: round(now() - start), steps: [...steps], at: Date.now() }
    }
  }
}

export function formatReport(report: TimingReport): string {
  const steps = report.steps.map((s) => `${s.step}=${s.ms}ms`).join(', ')
  return `[timing] ${report.label} total=${report.totalMs}ms${steps ? ` | ${steps}` : ''}`
}

/** Keeps only the newest `limit` reports. */
export function pushLimited<T>(list: T[], item: T, limit: number): T[] {
  const next = [...list, item]
  return next.length > limit ? next.slice(next.length - limit) : next
}
