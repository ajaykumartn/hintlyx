import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { MODES, type Mode } from '@shared/llm'
import { BadgeCheck, Bolt, ChatQ, Check, Chevron, Copy, Eye, EyeOff, Lines, Monitor, Recap } from './icons'

export type { Mode }
export { MODES }

export interface Message {
  id: number
  role: 'user' | 'assistant'
  text: string
  /** Assistant message still receiving tokens. */
  streaming?: boolean
  /** Which provider answered, shown as a small label. */
  provider?: string
  error?: boolean
}

export const QUICK_ACTIONS = [
  { label: 'What should I say next?', icon: Lines },
  { label: 'Follow-up questions', icon: ChatQ },
  { label: 'Fact-check', icon: BadgeCheck },
  { label: 'Recap', icon: Recap }
] as const

interface Props {
  mode: Mode
  onModeChange(mode: Mode): void
  messages: Message[]
  listening: boolean
  smartMode: boolean
  onToggleSmart(): void
  invisible: boolean
  onToggleInvisible(): void
  onAsk(text: string): void
  onAnswerFromScreen(): void
  onClear(): void
}

export interface AskCardHandle {
  /** Submits the typed question. Returns false if the ask bar is empty. */
  submit(): boolean
  focus(): void
}

export const AskCard = forwardRef<AskCardHandle, Props>(function AskCard(p, ref) {
  const [text, setText] = useState('')
  const [modeOpen, setModeOpen] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [p.messages])

  const submit = (): boolean => {
    const q = text.trim()
    if (!q) return false
    p.onAsk(q)
    setText('')
    return true
  }

  useImperativeHandle(ref, () => ({ submit, focus: () => inputRef.current?.focus() }))

  const copy = async (m: Message) => {
    await navigator.clipboard.writeText(m.text)
    setCopied(m.id)
    setTimeout(() => setCopied(null), 1200)
  }

  return (
    <div className="card glass" data-hit>
      <div className="card-head">
        <div className="head-left">
        <button
          className={`eye-btn${p.invisible ? ' on' : ''}`}
          onClick={p.onToggleInvisible}
          aria-label={p.invisible ? 'Invisible to screen share (click to make visible)' : 'Visible to screen share (click to hide)'}
        >
          {p.invisible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
        <div className="mode">
          <button className="mode-btn" onClick={() => setModeOpen((o) => !o)}>
            {p.mode} <Chevron size={16} />
          </button>
          {modeOpen && (
            <div className="menu">
              {MODES.map((m) => (
                <button
                  key={m}
                  className="menu-item"
                  onClick={() => {
                    p.onModeChange(m)
                    setModeOpen(false)
                  }}
                >
                  {m}
                  {m === p.mode && <Check size={15} />}
                </button>
              ))}
            </div>
          )}
        </div>
        </div>
        <div className="head-actions">
          {p.messages.length > 0 && (
            <button className="text-btn" onClick={p.onClear}>
              Clear
            </button>
          )}
          <button className="text-btn" onClick={() => setShowTranscript((s) => !s)}>
            {showTranscript ? 'Show answers' : 'Show transcript'}
          </button>
        </div>
      </div>

      <div className="card-body" ref={scrollRef}>
        {showTranscript ? (
          <p className="empty">
            {p.listening
              ? 'Listening is on. Live transcription is added in phase 3.'
              : 'Turn on listening to see the live transcript here.'}
          </p>
        ) : p.messages.length === 0 ? (
          <p className="empty">
            Ask about your screen or conversation. Press <kbd>Ctrl</kbd> <kbd>Enter</kbd> from any app.
          </p>
        ) : (
          p.messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="bubble">
                {m.text}
              </div>
            ) : (
              <div key={m.id} className={`answer${m.error ? ' error' : ''}`}>
                <p>
                  {m.text}
                  {m.streaming && <span className="caret" />}
                </p>
                {!m.streaming && !m.error && m.text && (
                  <div className="answer-foot">
                    {m.provider && <span className="muted small">{m.provider}</span>}
                    <button className="mini-btn" onClick={() => void copy(m)}>
                      <Copy size={14} /> {copied === m.id ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>
            )
          )
        )}
      </div>

      <div className="chips">
        {QUICK_ACTIONS.map(({ label, icon: Icon }) => (
          <button key={label} className="chip" onClick={() => p.onAsk(label)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      <div className="ask">
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          placeholder="Ask about your screen or conversation…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.shiftKey && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              p.onAnswerFromScreen()
            } else if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <div className="ask-row">
          <button
            className={`round-btn small${p.smartMode ? ' lit' : ''}`}
            aria-label={p.smartMode ? 'Smart mode on (deeper answers)' : 'Smart mode off'}
            onClick={p.onToggleSmart}
          >
            <Bolt size={15} />
          </button>
          <div className="spacer" />
          <button className="dashed-btn" onClick={p.onAnswerFromScreen} aria-label="Answer from what is on your screen">
            <Monitor size={15} /> Answer from screen <kbd>Ctrl</kbd>
            <kbd>⇧</kbd>
            <kbd>↵</kbd>
          </button>
          <button className="primary-btn" onClick={submit} disabled={!text.trim()}>
            Submit ↵
          </button>
        </div>
      </div>
    </div>
  )
})
