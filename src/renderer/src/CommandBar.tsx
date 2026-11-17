import { Close, Grip, Logo, MicOff, PlayDot, StopDot, Wave } from './icons'
import { useWindowDrag } from './useOverlayInput'

interface Props {
  listening: boolean
  sessionSeconds: number | null
  settingsOpen: boolean
  onToggleListening(): void
  onStartSession(): void
  onEndSession(): void
  onToggleSettings(): void
  onHide(): void
}

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function CommandBar(p: Props) {
  const drag = useWindowDrag()
  const inSession = p.sessionSeconds !== null

  return (
    <div className="bar-row">
      <button className="round-btn grip" data-hit title="Drag to move (Ctrl+Alt+Arrows)" {...drag}>
        <Grip />
      </button>

      <div className="pill glass" data-hit>
        <button
          className={`logo-btn${p.settingsOpen ? ' active' : ''}`}
          title="Settings"
          onClick={p.onToggleSettings}
        >
          <Logo size={22} />
        </button>

        <span className="status">{p.listening ? 'Listening' : 'Not listening'}</span>

        <button
          className={`switch${p.listening ? ' on' : ''}`}
          role="switch"
          aria-checked={p.listening}
          title={p.listening ? 'Stop listening' : 'Start listening'}
          onClick={p.onToggleListening}
        >
          <span className="knob">{p.listening ? <Wave size={15} /> : <MicOff size={15} />}</span>
        </button>

        {inSession ? (
          <button className="session-btn end" onClick={p.onEndSession} title="End session">
            <StopDot size={18} />
            <span>{formatDuration(p.sessionSeconds!)}</span>
          </button>
        ) : (
          <button className="session-btn" onClick={p.onStartSession} title="Start session">
            <PlayDot size={18} />
            <span>Start</span>
          </button>
        )}
      </div>

      <button className="round-btn" data-hit title="Hide (Ctrl+\)" onClick={p.onHide}>
        <Close size={16} />
      </button>
    </div>
  )
}
