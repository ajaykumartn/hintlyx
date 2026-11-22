import { useEffect, useRef, useState } from 'react'
import { INITIAL_STATE, type AppState } from '@shared/ipc'
import { AskCard, type AskCardHandle, type Message, type Mode } from './AskCard'
import { CommandBar } from './CommandBar'
import { FakeCursor } from './FakeCursor'
import { SettingsCard } from './SettingsCard'
import { Tooltip } from './Tooltip'
import { useMouseThrough } from './useOverlayInput'

const CAPTURE_MARKER = new URLSearchParams(location.search).get('marker') === '1'

const PROVIDER_LABEL: Record<string, string> = { groq: 'Groq', gemini: 'Gemini' }

export function App() {
  useMouseThrough()

  const [appState, setAppState] = useState<AppState>(INITIAL_STATE)
  const [listening, setListening] = useState(false)
  const [sessionStart, setSessionStart] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [cardOpen, setCardOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('Interview practice')
  const [smartMode, setSmartMode] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const nextId = useRef(1)
  const cardRef = useRef<AskCardHandle>(null)

  useEffect(() => {
    void window.hintlyx.getState().then(setAppState)
    return window.hintlyx.onState(setAppState)
  }, [])

  const setPrefs = (patch: Partial<AppState['prefs']>) => void window.hintlyx.setPrefs(patch).then(setAppState)

  // Session timer.
  useEffect(() => {
    if (sessionStart === null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [sessionStart])

  // The assistant message currently receiving tokens, so streaming deltas find their target.
  const streamingId = useRef<number | null>(null)

  const updateMessage = (id: number, patch: Partial<Message>) =>
    setMessages((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)))

  const runAsk = (question: string, withScreen: boolean) => {
    setCardOpen(true)
    setSettingsOpen(false)

    const history = messages
      .filter((m) => !m.error && !m.streaming)
      .map((m) => ({ role: m.role, text: m.text }))

    const userMsg: Message = { id: nextId.current++, role: 'user', text: withScreen && !question ? 'Answer from my screen' : question }
    const answerMsg: Message = { id: nextId.current++, role: 'assistant', text: '', streaming: true }
    streamingId.current = answerMsg.id
    setMessages((m) => [...m, userMsg, answerMsg])

    const requestId = `req-${answerMsg.id}`
    window.hintlyx.ask({ id: requestId, mode, question, history, withScreen, smart: smartMode })
  }

  const ask = (text: string) => runAsk(text, false)
  const answerFromScreen = () => runAsk('', true)

  // The hotkey handler is registered once, so keep the latest ask functions in a ref.
  const latest = useRef({ ask, answerFromScreen })
  latest.current = { ask, answerFromScreen }

  // Stream answer events from the main process into the current assistant message.
  useEffect(() => {
    return window.hintlyx.onAnswer((event) => {
      const id = streamingId.current
      if (id === null) return
      if (event.kind === 'start') {
        updateMessage(id, { provider: PROVIDER_LABEL[event.provider] ?? event.provider })
      } else if (event.kind === 'delta') {
        setMessages((list) => list.map((m) => (m.id === id ? { ...m, text: m.text + event.text } : m)))
      } else if (event.kind === 'done') {
        updateMessage(id, { streaming: false })
        streamingId.current = null
      } else if (event.kind === 'error') {
        setMessages((list) =>
          list.map((m) => (m.id === id ? { ...m, text: event.message, streaming: false, error: true } : m))
        )
        streamingId.current = null
      }
    })
  }, [])

  // Global hotkeys arrive from the main process.
  useEffect(() => {
    return window.hintlyx.onCommand((command) => {
      setCardOpen(true)
      setSettingsOpen(false)
      if (command === 'answer-from-screen') {
        latest.current.answerFromScreen()
        return
      }
      // Ctrl+Enter: submit what is typed, otherwise focus the ask bar.
      // The card may only just be opening, so wait one frame for it to mount.
      requestAnimationFrame(() => {
        if (!cardRef.current?.submit()) cardRef.current?.focus()
      })
    })
  }, [])

  const sessionSeconds = sessionStart === null ? null : Math.max(0, Math.floor((now - sessionStart) / 1000))

  // Only hide the real pointer when Windows confirms the overlay is excluded from capture.
  const hidePointer = appState.prefs.invisible && appState.invisibility.active

  return (
    <div className={`stage${hidePointer ? ' hide-pointer' : ''}`}>
      <CommandBar
        listening={listening}
        sessionSeconds={sessionSeconds}
        settingsOpen={settingsOpen}
        onToggleListening={() => setListening((l) => !l)}
        onStartSession={() => {
          setSessionStart(Date.now())
          setNow(Date.now())
          setCardOpen(true)
        }}
        onEndSession={() => {
          setSessionStart(null)
          setListening(false)
          setCardOpen(false)
          setSettingsOpen(false)
        }}
        onToggleSettings={() => setSettingsOpen((s) => !s)}
        onHide={() => window.hintlyx.hideWindow()}
      />

      {appState.invisibility.failed && (
        <div className="invis-warn" data-hit role="alert">
          Invisibility could not be turned on. Hintlyx is visible in screen shares right now.
        </div>
      )}
      {appState.prefs.invisible && !appState.invisibility.supported && (
        <div className="invis-warn" data-hit role="alert">
          This Windows version cannot hide windows from screen share. Update to Windows 10 (2004) or newer.
        </div>
      )}

      {CAPTURE_MARKER && <div className="capture-marker" data-hit />}

      {settingsOpen ? (
        <SettingsCard appState={appState} onPrefs={setPrefs} onBack={() => setSettingsOpen(false)} />
      ) : (
        cardOpen && (
          <AskCard
            ref={cardRef}
            mode={mode}
            onModeChange={setMode}
            messages={messages}
            listening={listening}
            smartMode={smartMode}
            onToggleSmart={() => setSmartMode((s) => !s)}
            invisible={appState.prefs.invisible}
            onToggleInvisible={() => setPrefs({ invisible: !appState.prefs.invisible })}
            onAsk={ask}
            onAnswerFromScreen={answerFromScreen}
            onClear={() => setMessages([])}
          />
        )
      )}
      <Tooltip />
      <FakeCursor enabled={hidePointer} />
    </div>
  )
}
