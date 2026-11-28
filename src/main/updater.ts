import { autoUpdater } from 'electron-updater'

/**
 * Checks GitHub Releases for a newer version and, if found, downloads it in the background
 * and installs it when the user quits. Only runs in a packaged build.
 *
 * Requirements for this to actually find updates:
 *  - The releases must be publicly readable (a private repo returns 404 and the check is skipped).
 *  - Windows works unsigned. macOS auto-update needs a signed, notarized app (Squirrel.Mac),
 *    so it stays off on mac until code signing is added.
 */
export function initAutoUpdates(isPackaged: boolean): void {
  if (!isPackaged) return
  if (process.platform === 'darwin') return // unsigned mac builds cannot self-update

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('error', (err) => console.warn(`[updater] ${err?.message ?? err}`))
  autoUpdater.on('update-available', (info) => console.log(`[updater] update available: ${info.version}`))
  autoUpdater.on('update-not-available', () => console.log('[updater] up to date'))
  autoUpdater.on('update-downloaded', (info) =>
    console.log(`[updater] downloaded ${info.version}; will install on quit`)
  )

  // A failed check must never crash the app or block startup.
  autoUpdater.checkForUpdates().catch((err) => console.warn(`[updater] check failed: ${err?.message ?? err}`))
}
