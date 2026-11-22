import { useEffect, useRef, useState } from 'react'
import { dedupeWords, shouldAppend } from '@shared/transcript'
import { AudioCapture } from './audio'

export interface TranscriptLine {
  id: number
  text: string
}

/** Keep the transcript bounded so memory and prompt size stay small. */
const MAX_LINES = 80

export interface Transcription {
  lines: TranscriptLine[]
  error: string | null
  sources: { system: boolean; mic: boolean } | null
  clear(): void
  /** The recent transcript as one string, for sending as ask context. */
  recentText(): string
}

export function useTranscription(listening: boolean): Transcription {
  const [lines, setLines] = useState<TranscriptLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sources, setSources] = useState<{ system: boolean; mic: boolean } | null>(null)
  const nextId = useRef(1)
  const linesRef = useRef<TranscriptLine[]>([])
  linesRef.current = lines

  useEffect(() => {
    if (!listening) return
    setError(null)
    const capture = new AudioCapture({
      onText: (raw) =>
        setLines((prev) => {
          const text = dedupeWords(raw)
          // Drop Whisper hallucinations and near-duplicate overlap tails.
          if (!shouldAppend(text, prev[prev.length - 1]?.text)) return prev
          const next = [...prev, { id: nextId.current++, text }]
          return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
        }),
      onError: (message) => setError(message),
      onReady: (s) => setSources(s)
    })
    void capture.start()
    return () => {
      setSources(null)
      void capture.stop()
    }
  }, [listening])

  return {
    lines,
    error,
    sources,
    clear: () => setLines([]),
    recentText: () =>
      linesRef.current
        .slice(-24)
        .map((l) => l.text)
        .join(' ')
  }
}
