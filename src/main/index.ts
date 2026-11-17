import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, safeStorage, screen, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { INITIAL_STATE, IPC, isProvider, type AppState, type OverlayCommand, type SettingsView } from '../shared/ipc'
import { createTimer, formatReport, pushLimited, type TimingReport } from '../shared/timing'
import { fileStorage } from './fileStorage'
import { registerHotkeys, unregisterHotkeys } from './hotkeys'
import { applyInvisibility } from './invisibility'
import { KeyStore } from './keyStore'
import { PrefsStore } from './prefs'
import { createOverlayWindow, MOVE_STEP, moveWindowBy, setWindowPosition } from './window'

let win: BrowserWindow | null = null
let keyStore: KeyStore
let prefsStore: PrefsStore
let timings: TimingReport[] = []
let dragOrigin: [number, number] | null = null
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
    t.mark('stores')

    registerIpc()
    win = createOverlayWindow({ captureMarker: process.env['HINTLYX_CAPTURE_TEST'] === '1' })
    // Protection goes on before the window is ever shown, so no frame leaks.
    applyPrefs()
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
