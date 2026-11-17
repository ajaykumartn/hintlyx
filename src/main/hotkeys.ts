import { globalShortcut } from 'electron'
import { HOTKEYS, type HotkeyAction } from '../shared/ipc'

/** Registers global hotkeys. Returns the actions whose hotkey another app already uses. */
export function registerHotkeys(handlers: Record<HotkeyAction, () => void>): HotkeyAction[] {
  const failed: HotkeyAction[] = []
  for (const action of Object.keys(HOTKEYS) as HotkeyAction[]) {
    const ok = globalShortcut.register(HOTKEYS[action], handlers[action])
    if (!ok) failed.push(action)
  }
  return failed
}

export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll()
}
