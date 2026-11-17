/*
 * Capture check: grabs the screen the way screen-share apps do and counts magenta pixels
 * from Hintlyx's capture-test marker. Run with: electron scripts/capture-check.cjs
 * Set CAPTURE_WGC=1 to force Windows Graphics Capture instead of DXGI duplication.
 * Prints one JSON line: { method, magenta } per capture method.
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { app, BrowserWindow, desktopCapturer, screen, session } = require('electron')

if (process.env.CAPTURE_WGC === '1') {
  app.commandLine.appendSwitch('enable-features', 'AllowWgcScreenCapturer,AllowWgcDesktopCapturer')
} else {
  app.commandLine.appendSwitch('disable-features', 'AllowWgcScreenCapturer,AllowWgcDesktopCapturer')
}

const isMagenta = (r, g, b) => r > 220 && g < 60 && b > 220

function countMagentaBGRA(buf) {
  let n = 0
  for (let i = 0; i < buf.length; i += 4) if (isMagenta(buf[i + 2], buf[i + 1], buf[i])) n++
  return n
}

async function viaDesktopCapturer() {
  const d = screen.getPrimaryDisplay()
  const size = { width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) }
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size })
  const primary = sources.find((s) => s.display_id === String(d.id)) || sources[0]
  return countMagentaBGRA(primary.thumbnail.toBitmap())
}

async function viaGetDisplayMedia() {
  const sources = await desktopCapturer.getSources({ types: ['screen'] })
  const d = screen.getPrimaryDisplay()
  const primary = sources.find((s) => s.display_id === String(d.id)) || sources[0]
  session.defaultSession.setDisplayMediaRequestHandler((_req, cb) => cb({ video: primary }))

  // getDisplayMedia needs a secure context; data: URLs are not, file:// is.
  const page = path.join(os.tmpdir(), 'hintlyx-capture-check.html')
  fs.writeFileSync(page, '<video autoplay muted></video><canvas></canvas>')
  const win = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false } })
  await win.loadFile(page)
  const js = `(async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
    const v = document.querySelector('video'); v.srcObject = stream
    await new Promise(r => v.onloadeddata = r)
    await new Promise(r => setTimeout(r, 800))
    const c = document.querySelector('canvas'); c.width = v.videoWidth; c.height = v.videoHeight
    const ctx = c.getContext('2d'); ctx.drawImage(v, 0, 0)
    const px = ctx.getImageData(0, 0, c.width, c.height).data
    let n = 0
    for (let i = 0; i < px.length; i += 4) if (px[i] > 220 && px[i+1] < 60 && px[i+2] > 220) n++
    stream.getTracks().forEach(t => t.stop())
    return n
  })()`
  const n = await win.webContents.executeJavaScript(js, true)
  win.destroy()
  return n
}

app.whenReady().then(async () => {
  const label = process.env.CAPTURE_WGC === '1' ? 'wgc' : 'dxgi'
  const out = {}
  try {
    out[`desktopCapturer-${label}`] = await viaDesktopCapturer()
  } catch (e) {
    out[`desktopCapturer-${label}`] = `error: ${e.message}`
  }
  try {
    out[`getDisplayMedia-${label}`] = await viaGetDisplayMedia()
  } catch (e) {
    out[`getDisplayMedia-${label}`] = `error: ${e.message}`
  }
  process.stdout.write(`CAPTURE_RESULT ${JSON.stringify(out)}\n`)
  app.quit()
})
