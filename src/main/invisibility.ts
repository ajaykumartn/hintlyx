import { release } from 'node:os'
import type { BrowserWindow } from 'electron'
import type { InvisibilityStatus } from '../shared/ipc'

/** Windows 10 version 2004 (build 19041) added WDA_EXCLUDEFROMCAPTURE. */
const MIN_WINDOWS_BUILD = 19041

/**
 * True when Windows can remove a window from capture entirely.
 * Older builds only black the window out, which would make Hintlyx stand out on a share.
 */
export function supportsCaptureExclusion(platform: string = process.platform, osRelease: string = release()): boolean {
  if (platform === 'darwin') return true
  if (platform !== 'win32') return false
  const build = Number(osRelease.split('.')[2])
  return Number.isFinite(build) && build >= MIN_WINDOWS_BUILD
}

/**
 * Applies screen-share protection and reads it back from the OS to confirm it took effect.
 * Protection is never turned on where the OS would show a black box instead.
 */
export function applyInvisibility(win: BrowserWindow, wanted: boolean): InvisibilityStatus {
  const supported = supportsCaptureExclusion()
  const enable = wanted && supported
  win.setContentProtection(enable)
  const active = win.isContentProtected()
  return {
    supported,
    active,
    // Failed: the user asked for invisibility but the OS did not confirm it.
    failed: wanted && supported && !active
  }
}
