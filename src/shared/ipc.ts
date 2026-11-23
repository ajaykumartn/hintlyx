import type { AnswerEvent, AskRequest, Mode } from './llm'
import type { TimingReport } from './timing'

export const PROVIDERS = ['groq', 'gemini'] as const
export type Provider = (typeof PROVIDERS)[number]

export const PROVIDER_INFO: Record<Provider, { name: string; keyUrl: string; hint: string }> = {
  groq: { name: 'Groq', keyUrl: 'https://console.groq.com/keys', hint: 'Fast text answers' },
  gemini: { name: 'Google Gemini', keyUrl: 'https://aistudio.google.com/apikey', hint: 'Screen and image answers' }
}

export function isProvider(value: unknown): value is Provider {
  return typeof value === 'string' && (PROVIDERS as readonly string[]).includes(value)
}

/** Global hotkeys. They work even when another app has focus. */
export const HOTKEYS = {
  toggleOverlay: 'CommandOrControl+\\',
  ask: 'CommandOrControl+Enter',
  answerFromScreen: 'CommandOrControl+Shift+Enter',
  moveLeft: 'CommandOrControl+Alt+Left',
  moveRight: 'CommandOrControl+Alt+Right',
  moveUp: 'CommandOrControl+Alt+Up',
  moveDown: 'CommandOrControl+Alt+Down'
} as const
export type HotkeyAction = keyof typeof HOTKEYS

export const HOTKEY_LABELS: Record<HotkeyAction, string> = {
  toggleOverlay: 'Show or hide Hintlyx',
  ask: 'Ask AI (submit the ask bar)',
  answerFromScreen: 'Answer from screen',
  moveLeft: 'Move left',
  moveRight: 'Move right',
  moveUp: 'Move up',
  moveDown: 'Move down'
}

/** Formats an Electron accelerator for display, e.g. "Ctrl + Shift + Enter". */
export function formatHotkey(accelerator: string): string {
  return accelerator.replace('CommandOrControl', 'Ctrl').split('+').join(' + ')
}

export const IPC = {
  getSettings: 'settings:get',
  setApiKey: 'settings:set-key',
  clearApiKey: 'settings:clear-key',
  getState: 'app:get-state',
  command: 'app:command',
  hideWindow: 'window:hide',
  setMouseThrough: 'window:set-mouse-through',
  dragStart: 'window:drag-start',
  dragMove: 'window:drag-move',
  getTimings: 'timing:list',
  setPrefs: 'prefs:set',
  state: 'app:state',
  quit: 'app:quit',
  ask: 'llm:ask',
  cancelAsk: 'llm:cancel',
  answer: 'llm:answer',
  transcribe: 'audio:transcribe',
  audioError: 'audio:error',
  suggest: 'llm:suggest',
  saveSession: 'session:save',
  listSessions: 'session:list',
  getSession: 'session:get',
  deleteSession: 'session:delete'
} as const

/** Commands the main process sends to the overlay (usually from a hotkey). */
export type OverlayCommand = 'ask' | 'answer-from-screen'

export interface KeyStatus {
  set: boolean
  masked: string | null
}

export interface SettingsView {
  encryptionAvailable: boolean
  keys: Record<Provider, KeyStatus>
}

export interface OllamaPrefs {
  /** Use a local Ollama server as an offline fallback when cloud providers fail. */
  enabled: boolean
  baseUrl: string
  model: string
}

export interface Preferences {
  /** Hidden from screen sharing, recordings and screenshots. */
  invisible: boolean
  /** Not shown in the Windows taskbar. */
  hideFromTaskbar: boolean
  ollama: OllamaPrefs
}

/** Hintlyx starts hidden from screen sharing on every launch; the user clicks the eye to show it. */
export const DEFAULT_OLLAMA: OllamaPrefs = {
  enabled: false,
  baseUrl: 'http://localhost:11434',
  model: 'llama3.2'
}

export interface InvisibilityStatus {
  /** The OS can remove windows from capture (Windows 10 2004+ or macOS). */
  supported: boolean
  /** The OS confirms the window is currently excluded from capture. */
  active: boolean
  /** Invisibility was requested but the OS did not confirm it. */
  failed: boolean
}

export interface AppState {
  /** Hotkeys that another app already uses, so they could not be registered. */
  failedHotkeys: HotkeyAction[]
  prefs: Preferences
  invisibility: InvisibilityStatus
}

export const INITIAL_STATE: AppState = {
  failedHotkeys: [],
  prefs: { invisible: true, hideFromTaskbar: false, ollama: DEFAULT_OLLAMA },
  invisibility: { supported: true, active: false, failed: false }
}

export interface HintlyxApi {
  getSettings(): Promise<SettingsView>
  setApiKey(provider: Provider, key: string): Promise<SettingsView>
  clearApiKey(provider: Provider): Promise<SettingsView>
  getState(): Promise<AppState>
  getTimings(): Promise<TimingReport[]>
  hideWindow(): void
  /** true: clicks pass through to the app below. false: the overlay takes clicks. */
  setMouseThrough(through: boolean): void
  dragStart(): void
  dragMove(dx: number, dy: number): void
  onCommand(listener: (command: OverlayCommand) => void): () => void
  setPrefs(patch: Partial<Preferences>): Promise<AppState>
  onState(listener: (state: AppState) => void): () => void
  ask(request: AskRequest): void
  cancelAsk(id: string): void
  onAnswer(listener: (event: AnswerEvent) => void): () => void
  /** Transcribes a 16 kHz mono WAV clip, returning the recognised text (empty for silence). */
  transcribe(wav: ArrayBuffer): Promise<TranscribeResult>
  /** Suggests a few short things to ask next, from the recent transcript. [] on failure. */
  suggest(transcript: string, mode: Mode): Promise<string[]>
  saveSession(record: SessionRecord): void
  listSessions(): Promise<SessionSummary[]>
  getSession(id: string): Promise<SessionRecord | null>
  deleteSession(id: string): Promise<SessionSummary[]>
  quit(): void
}

export interface TranscribeResult {
  text: string
  error?: string
}

export interface SessionMessage {
  role: 'user' | 'assistant'
  text: string
}

export interface SessionSummary {
  id: string
  /** When the session was last saved (epoch ms). */
  at: number
  mode: string
  title: string
  qaCount: number
}

export interface SessionRecord extends Omit<SessionSummary, 'qaCount'> {
  transcript: string
  messages: SessionMessage[]
}
