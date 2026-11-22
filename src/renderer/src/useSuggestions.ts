import { useEffect, useRef, useState } from 'react'
import type { Mode } from '@shared/llm'

/** Wait this long after the transcript last changed before asking for suggestions. */
const DEBOUNCE_MS = 2500
/** Never request suggestions more often than this, to stay well under rate limits. */
const MIN_INTERVAL_MS = 8000

/**
 * Watches the live transcript and periodically asks the model for a few short things the user
 * could ask next (the copilot's dynamic actions). Debounced and rate-limited.
 */
export function useSuggestions(enabled: boolean, transcriptText: string, mode: Mode): string[] {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const lastCall = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!enabled) {
      setSuggestions([])
      return
    }
    const text = transcriptText.trim()
    if (text.length < 20) return

    const since = Date.now() - lastCall.current
    const delay = Math.max(DEBOUNCE_MS, MIN_INTERVAL_MS - since)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      lastCall.current = Date.now()
      void window.hintlyx.suggest(text, mode).then((s) => setSuggestions(s))
    }, delay)
    return () => clearTimeout(timer.current)
  }, [enabled, transcriptText, mode])

  return suggestions
}
