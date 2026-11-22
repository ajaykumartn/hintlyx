import { join } from 'node:path'
import { app, BrowserWindow, screen } from 'electron'

/** Large transparent canvas. Only the command bar and card are drawn; the rest lets clicks through. */
const WIDTH = 760
const HEIGHT = 760
const TOP_MARGIN = 8
export const MOVE_STEP = 60

/**
 * The overlay is always on top. It is visible to screen sharing unless the user turns on
 * invisibility (see applyPrefs in index.ts).
 */
export function createOverlayWindow(opts: { captureMarker?: boolean } = {}): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay()

  const win = new BrowserWindow({
    title: 'Hintlyx',
    width: WIDTH,
    height: HEIGHT,
    x: Math.round(workArea.x + (workArea.width - WIDTH) / 2),
    y: workArea.y + TOP_MARGIN,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // The spellcheck menu would open as a separate native window, outside screen-share protection.
      spellcheck: false
    }
  })

  win.setAlwaysOnTop(true, 'floating')
  // Start with clicks passing through; the overlay turns this off while the mouse is over its UI.
  win.setIgnoreMouseEvents(true, { forward: true })

  // The overlay only ever shows our own UI.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event) => event.preventDefault())

  // Capture test mode draws a solid magenta block so captures can be checked pixel by pixel.
  const query: Record<string, string> = {}
  if (opts.captureMarker) query['marker'] = '1'
  if (process.env['HINTLYX_AUTOLISTEN'] === '1') query['autolisten'] = '1'
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) {
    const url = new URL(devUrl)
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
    void win.loadURL(url.toString())
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { query })
  }

  return win
}

/** Moves the window but keeps at least part of it on a screen. */
export function moveWindowBy(win: BrowserWindow, dx: number, dy: number): void {
  const [x, y] = win.getPosition()
  setWindowPosition(win, x + dx, y + dy)
}

export function setWindowPosition(win: BrowserWindow, x: number, y: number): void {
  const [w] = win.getSize()
  const display = screen.getDisplayNearestPoint({ x: Math.round(x + w / 2), y: Math.round(y) })
  const area = display.workArea
  const clampedX = Math.min(Math.max(x, area.x - w / 2), area.x + area.width - w / 2)
  const clampedY = Math.min(Math.max(y, area.y), area.y + area.height - 80)
  win.setPosition(Math.round(clampedX), Math.round(clampedY))
}
