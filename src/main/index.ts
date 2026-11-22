import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, safeStorage, screen, session, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import {
  INITIAL_STATE,
  IPC,
  isProvider,
  type AppState,
  type OverlayCommand,
  type SettingsView,
  type TranscribeResult
} from '../shared/ipc'
import { createTimer, formatReport, pushLimited, type TimingReport } from '../shared/timing'
import { fileStorage } from './fileStorage'
import { registerHotkeys, unregisterHotkeys } from './hotkeys'
import { isAskRequest, type AnswerEvent, type AskRequest } from '../shared/llm'
import { applyInvisibility } from './invisibility'
import { KeyStore } from './keyStore'
import { LlmService } from './llm'
import { PrefsStore } from './prefs'
import { captureScreenBase64 } from './screenshot'
import { transcribeWav } from './providers/transcribe'
import { enableSystemAudioLoopback } from './audioLoopback'
import { createOverlayWindow, MOVE_STEP, moveWindowBy, setWindowPosition } from './window'

let win: BrowserWindow | null = null
let keyStore: KeyStore
let prefsStore: PrefsStore
let llm: LlmService
let timings: TimingReport[] = []
let dragOrigin: [number, number] | null = null
/** In-flight asks, so each can be cancelled by id. */
const inFlight = new Map<string, AbortController>()
const state: AppState = structuredClone(INITIAL_STATE)

/** Applies invisibility and taskbar settings, then confirms them with the OS. */
function applyPrefs(): void {
  if (!win) return
  const before = JSON.stringify(state.invisibility)
  state.invisibility = applyInvisibility(win, state.prefs.invisible)
  win.setSkipTaskbar(state.prefs.hideFromTaskbar)
  if (JSON.stringify(state.invisibility) !== before) {
    console.log(`[invisibility] ${JSON.stringify(state.invisibility)}`)
    broadcastState()
  }
}

/**
 * Re-checks protection with the OS. If it was lost (for example after hide/show or a
 * display change), turn it back on before the next frame is shared.
 */
function enforceInvisibility(): void {
  if (!win || win.isDestroyed() || !state.prefs.invisible) return
  if (!win.isContentProtected()) {
    console.warn('[invisibility] protection was lost, re-applying')
    applyPrefs()
  }
}

function broadcastState(): void {
  win?.webContents.send(IPC.state, state)
}

function record(report: TimingReport): void {
  timings = pushLimited(timings, report, 50)
  console.log(formatReport(report))
}

function showOverlay(focus: boolean): void {
  if (!win) return
  if (!win.isVisible()) win.showInactive()
  if (focus) win.focus()
}

function toggleOverlay(): void {
  if (!win) return
  const t = createTimer('hotkey:toggle')
  if (win.isVisible()) {
    win.hide()
    t.mark('hidden')
  } else {
    showOverlay(false)
    t.mark('shown')
  }
  record(t.end())
}

function sendCommand(command: OverlayCommand): void {
  if (!win) return
  const t = createTimer(`hotkey:${command}`)
  showOverlay(true)
  t.mark('shown+focused')
  win.webContents.send(IPC.command, command)
  t.mark('sent-to-overlay')
  record(t.end())
}

function settingsView(): SettingsView {
  return { encryptionAvailable: keyStore.encryptionAvailable, keys: keyStore.status() }
}

/**
 * Captures the screen with the overlay excluded, so Hintlyx never appears in the shot sent
 * to the model. Content protection removes the window from capture; we enable it just for the
 * capture if the user does not already run invisible, then restore the previous state.
 */
async function captureCleanScreenshot(): Promise<string | null> {
  if (!win) return null
  const wasProtected = win.isContentProtected()
  if (!wasProtected) {
    win.setContentProtection(true)
    // The exclusion applies on the next desktop composition, not immediately.
    await new Promise((r) => setTimeout(r, 90))
  }
  try {
    const [x, y] = win.getPosition()
    return await captureScreenBase64({ x, y })
  } finally {
    if (!wasProtected && win && !win.isDestroyed()) win.setContentProtection(false)
  }
}

function sendAnswer(event: AnswerEvent): void {
  win?.webContents.send(IPC.answer, event)
}

async function handleAsk(request: AskRequest): Promise<void> {
  // A new ask with the same id cancels the previous one.
  inFlight.get(request.id)?.abort()
  const controller = new AbortController()
  inFlight.set(request.id, controller)

  const timer = createTimer(`ask:${request.withScreen ? 'screen' : 'text'}`)
  try {
    let image: string | undefined
    if (request.withScreen) {
      image = (await captureCleanScreenshot()) ?? undefined
      timer.mark('screenshot')
      if (!image) {
        sendAnswer({ id: request.id, kind: 'error', message: 'Could not capture the screen.' })
        return
      }
    }
    let firstToken = true
    for await (const event of llm.answer(request, image, controller.signal)) {
      if (controller.signal.aborted) break
      if (event.kind === 'delta' && firstToken) {
        firstToken = false
        timer.mark('first-token')
      }
      sendAnswer(event)
    }
  } catch (err) {
    sendAnswer({ id: request.id, kind: 'error', message: err instanceof Error ? err.message : String(err) })
  } finally {
    record(timer.end())
    inFlight.delete(request.id)
  }
}

/** Only accept IPC from our own overlay window. */
function fromOverlay(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return win !== null && event.sender === win.webContents
}

function registerIpc(): void {
  const handle = <A extends unknown[], R>(channel: string, fn: (...args: A) => R) =>
    ipcMain.handle(channel, (event, ...args) => {
      if (!fromOverlay(event)) throw new Error('Rejected IPC from unknown sender.')
      return fn(...(args as A))
    })
  const on = <A extends unknown[]>(channel: string, fn: (...args: A) => void) =>
    ipcMain.on(channel, (event, ...args) => {
      if (fromOverlay(event)) fn(...(args as A))
    })

  handle(IPC.getSettings, () => settingsView())
  handle(IPC.setApiKey, (provider: unknown, key: unknown) => {
    if (!isProvider(provider)) throw new Error('Unknown provider.')
    keyStore.set(provider, key)
    return settingsView()
  })
  handle(IPC.clearApiKey, (provider: unknown) => {
    if (!isProvider(provider)) throw new Error('Unknown provider.')
    keyStore.clear(provider)
    return settingsView()
  })
  handle(IPC.getState, () => state)
  handle(IPC.setPrefs, (patch: unknown) => {
    state.prefs = prefsStore.update(patch)
    applyPrefs()
    broadcastState()
    return state
  })
  handle(IPC.getTimings, () => timings)

  on(IPC.hideWindow, () => win?.hide())
  on(IPC.quit, () => app.quit())
  on(IPC.setMouseThrough, (through: unknown) => {
    win?.setIgnoreMouseEvents(through === true, { forward: true })
  })
  on(IPC.dragStart, () => {
    if (win) dragOrigin = win.getPosition() as [number, number]
  })
  on(IPC.dragMove, (dx: unknown, dy: unknown) => {
    if (!win || !dragOrigin || typeof dx !== 'number' || typeof dy !== 'number') return
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return
    setWindowPosition(win, dragOrigin[0] + dx, dragOrigin[1] + dy)
  })
  on(IPC.ask, (request: unknown) => {
    if (!isAskRequest(request)) return
    void handleAsk(request)
  })
  on(IPC.cancelAsk, (id: unknown) => {
    if (typeof id === 'string') inFlight.get(id)?.abort()
  })
  handle(IPC.transcribe, async (wav: unknown): Promise<TranscribeResult> => {
    if (!(wav instanceof ArrayBuffer) && !ArrayBuffer.isView(wav)) return { text: '', error: 'bad audio data' }
    const buffer = wav instanceof ArrayBuffer ? wav : (wav as ArrayBufferView).buffer as ArrayBuffer
    const apiKey = keyStore.get('groq')
    if (!apiKey) return { text: '', error: 'Add a Groq API key in Settings to enable listening.' }
    try {
      const text = await transcribeWav(buffer, apiKey, { language: 'en' })
      if (process.env['HINTLYX_AUTOLISTEN'] === '1' && text) console.log(`[transcript] ${text}`)
      return { text }
    } catch (err) {
      return { text: '', error: err instanceof Error ? err.message : String(err) }
    }
  })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showOverlay(true))

  app.whenReady().then(() => {
    const t = createTimer('startup')

    keyStore = new KeyStore(
      {
        isAvailable: () => safeStorage.isEncryptionAvailable(),
        encrypt: (plain) => safeStorage.encryptString(plain),
        decrypt: (data) => safeStorage.decryptString(data)
      },
      fileStorage(join(app.getPath('userData'), 'keys.json'))
    )
    prefsStore = new PrefsStore(fileStorage(join(app.getPath('userData'), 'prefs.json')))
    state.prefs = prefsStore.get()
    llm = new LlmService({ get: (p) => keyStore.get(p) })
    t.mark('stores')

    registerIpc()
    enableSystemAudioLoopback()
    // Allow the overlay to use the microphone and system-audio/screen loopback capture only.
    const allowedPermissions = new Set(['media', 'display-capture', 'audioCapture'])
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(allowedPermissions.has(permission))
    })
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowedPermissions.has(permission))
    win = createOverlayWindow({ captureMarker: process.env['HINTLYX_CAPTURE_TEST'] === '1' })
    // Protection goes on before the window is ever shown, so no frame leaks.
    applyPrefs()
    if (process.env['HINTLYX_AUTOLISTEN'] === '1') {
      win.webContents.on('console-message', (_e, _level, message) => console.log(`[renderer] ${message}`))
    }
    win.on('show', enforceInvisibility)
    win.on('restore', enforceInvisibility)
    win.on('moved', enforceInvisibility)
    screen.on('display-metrics-changed', enforceInvisibility)
    screen.on('display-added', enforceInvisibility)
    setInterval(enforceInvisibility, 2000)
    t.mark('window-created')

    state.failedHotkeys = registerHotkeys({
      toggleOverlay,
      ask: () => sendCommand('ask'),
      answerFromScreen: () => sendCommand('answer-from-screen'),
      moveLeft: () => win && moveWindowBy(win, -MOVE_STEP, 0),
      moveRight: () => win && moveWindowBy(win, MOVE_STEP, 0),
      moveUp: () => win && moveWindowBy(win, 0, -MOVE_STEP),
      moveDown: () => win && moveWindowBy(win, 0, MOVE_STEP)
    })
    if (state.failedHotkeys.length) {
      console.warn(`[hotkeys] already in use by another app: ${state.failedHotkeys.join(', ')}`)
    }
    t.mark('hotkeys')

    win.once('ready-to-show', () => {
      win?.showInactive()
      t.mark('ready-to-show')
      record(t.end())
    })
    win.on('closed', () => {
      win = null
    })
  })

  app.on('will-quit', () => unregisterHotkeys())
  app.on('window-all-closed', () => app.quit())
}
