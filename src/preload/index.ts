import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type AppState, type HintlyxApi, type OverlayCommand } from '../shared/ipc'
import type { AnswerEvent } from '../shared/llm'

const api: HintlyxApi = {
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  setApiKey: (provider, key) => ipcRenderer.invoke(IPC.setApiKey, provider, key),
  clearApiKey: (provider) => ipcRenderer.invoke(IPC.clearApiKey, provider),
  getState: () => ipcRenderer.invoke(IPC.getState),
  getTimings: () => ipcRenderer.invoke(IPC.getTimings),
  hideWindow: () => ipcRenderer.send(IPC.hideWindow),
  setMouseThrough: (through) => ipcRenderer.send(IPC.setMouseThrough, through),
  dragStart: () => ipcRenderer.send(IPC.dragStart),
  dragMove: (dx, dy) => ipcRenderer.send(IPC.dragMove, dx, dy),
  onCommand: (listener) => {
    const wrapped = (_event: unknown, command: OverlayCommand) => listener(command)
    ipcRenderer.on(IPC.command, wrapped)
    return () => ipcRenderer.removeListener(IPC.command, wrapped)
  },
  setPrefs: (patch) => ipcRenderer.invoke(IPC.setPrefs, patch),
  onState: (listener) => {
    const wrapped = (_event: unknown, state: AppState) => listener(state)
    ipcRenderer.on(IPC.state, wrapped)
    return () => ipcRenderer.removeListener(IPC.state, wrapped)
  },
  ask: (request) => ipcRenderer.send(IPC.ask, request),
  cancelAsk: (id) => ipcRenderer.send(IPC.cancelAsk, id),
  transcribe: (wav) => ipcRenderer.invoke(IPC.transcribe, wav),
  onAnswer: (listener) => {
    const wrapped = (_event: unknown, ev: AnswerEvent) => listener(ev)
    ipcRenderer.on(IPC.answer, wrapped)
    return () => ipcRenderer.removeListener(IPC.answer, wrapped)
  },
  quit: () => ipcRenderer.send(IPC.quit)
}

contextBridge.exposeInMainWorld('hintlyx', api)
