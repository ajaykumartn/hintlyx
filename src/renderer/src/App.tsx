import { useEffect, useRef, useState } from 'react'
import type { AppState } from '@shared/ipc'
import { AskCard, type AskCardHandle, type Message, type Mode } from './AskCard'
import { CommandBar } from './CommandBar'
import { SettingsCard } from './SettingsCard'
import { useMouseThrough } from './useOverlayInput'

const NOT_CONNECTED =
  'Hintlyx is not connected to an AI model yet. Answers from Groq and Gemini are added in phase 2.'

export function App() {
  useMouseThrough()

  const [appState, setAppState] = useState<AppState>({ failedHotkeys: [] })
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
  }, [])

  // Session timer.
  useEffect(() => {
    if (sessionStart === null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [sessionStart])

  const ask = (text: string) => {
    setCardOpen(true)
    setSettingsOpen(false)
    setMessages((m) => [
      ...m,
      { id: nextId.current++, role: 'user', text },
      { id: nextId.current++, role: 'assistant', text: NOT_CONNECTED }
    ])
  }

  const answerFromScreen = () => ask('Answer from my screen')

  // Global hotkeys arrive from the main process.
  useEffect(() => {
    return window.hintlyx.onCommand((command) => {
      setCardOpen(true)
      setSettingsOpen(false)
      if (command === 'answer-from-screen') {
        answerFromScreen()
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

  return (
    <div className="stage">
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

      {settingsOpen ? (
        <SettingsCard appState={appState} onBack={() => setSettingsOpen(false)} />
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
            onAsk={ask}
            onAnswerFromScreen={answerFromScreen}
            onClear={() => setMessages([])}
          />
        )
      )}
    </div>
  )
}
