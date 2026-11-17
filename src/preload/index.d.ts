import type { HintlyxApi } from '../shared/ipc'

declare global {
  interface Window {
    hintlyx: HintlyxApi
  }
}

export {}
