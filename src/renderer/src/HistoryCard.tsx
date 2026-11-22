import { useEffect, useState } from 'react'
import type { SessionRecord, SessionSummary } from '@shared/ipc'
import { Back, Trash } from './icons'
import { Markdown } from './Markdown'

function when(at: number): string {
  const d = new Date(at)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return sameDay ? `Today ${time}` : `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${time}`
}

export function HistoryCard({ onBack }: { onBack(): void }) {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [open, setOpen] = useState<SessionRecord | null>(null)
  const [showTranscript, setShowTranscript] = useState(false)

  useEffect(() => {
    void window.hintlyx.listSessions().then(setSessions)
  }, [])

  const remove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSessions(await window.hintlyx.deleteSession(id))
    if (open?.id === id) setOpen(null)
  }

  if (open) {
    return (
      <div className="card glass settings" data-hit>
        <div className="card-head">
          <button className="text-btn back" onClick={() => setOpen(null)}>
            <Back size={16} /> Sessions
          </button>
          <span className="title">{when(open.at)}</span>
          <button className="text-btn" onClick={() => setShowTranscript((s) => !s)}>
            {showTranscript ? 'Q&A' : 'Transcript'}
          </button>
        </div>
        <div className="card-body">
          {showTranscript ? (
            <p className="transcript">{open.transcript || 'No transcript was recorded.'}</p>
          ) : (
            open.messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="bubble">
                  {m.text}
                </div>
              ) : (
                <div key={i} className="answer">
                  <Markdown text={m.text} />
                </div>
              )
            )
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="card glass settings" data-hit>
      <div className="card-head">
        <button className="text-btn back" onClick={onBack}>
          <Back size={16} /> Back
        </button>
        <span className="title">Session history</span>
        <span />
      </div>
      <div className="card-body">
        {sessions.length === 0 ? (
          <p className="empty">No saved sessions yet. Your conversations are saved here automatically.</p>
        ) : (
          <ul className="session-list">
            {sessions.map((s) => (
              <li key={s.id} className="session-item" onClick={() => void window.hintlyx.getSession(s.id).then(setOpen)}>
                <div className="session-main">
                  <strong>{s.title}</strong>
                  <span className="muted small">
                    {when(s.at)} · {s.mode} · {s.qaCount} {s.qaCount === 1 ? 'question' : 'questions'}
                  </span>
                </div>
                <button className="mini-btn danger" aria-label="Delete session" onClick={(e) => void remove(s.id, e)}>
                  <Trash size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
