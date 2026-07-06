import { clipboard, contextBridge, ipcRenderer } from 'electron'
import type {
  SessionConfig,
  SessionEvent,
  AgentInstall,
  SessionInfo,
  ResolvedCommandFile,
  SessionNotificationPayload,
  AppUpdateInfo,
  ProjectEditor,
  OpenCCSwitchResult,
} from '../src/types'

export interface EasyAgentCenterAPI {
  getAppVersion: () => Promise<string>
  checkAppUpdate: () => Promise<AppUpdateInfo>
  openExternalUrl: (url: string) => Promise<boolean>
  openPath: (targetPath: string) => Promise<string>
  openProjectInEditor: (editor: ProjectEditor, cwd: string) => Promise<boolean>
  openCCSwitch: () => Promise<OpenCCSwitchResult>
  discoverAgents: () => Promise<Record<string, AgentInstall | null>>
  createSession: (config: SessionConfig) => Promise<SessionInfo>
  openCodexThread: (cwd: string, prompt?: string) => Promise<boolean>
  deleteSession: (sessionId: string) => Promise<boolean>
  restartSession: (sessionId: string) => Promise<SessionInfo | null>
  updateSession: (
    sessionId: string,
    patch: Pick<Partial<SessionInfo>, 'title' | 'archived'>
  ) => Promise<SessionInfo | null>
  moveSession: (sessionId: string, direction: 'up' | 'down') => Promise<SessionInfo[]>
  sendInput: (sessionId: string, data: string) => void
  sendPrompt: (sessionId: string, prompt: string) => void
  stopSession: (sessionId: string) => void
  resizeSession: (sessionId: string, cols: number, rows: number) => void
  listSessions: () => Promise<SessionInfo[]>
  readSessionLog: (sessionId: string) => Promise<string>
  exportSessionMarkdown: (sessionId: string) => Promise<string | null>
  getDefaultCwd: () => Promise<string>
  pickDirectory: (defaultPath?: string) => Promise<string | null>
  pickImageFile: (defaultPath?: string) => Promise<string | null>
  resolveCommandFile: (filePath: string) => Promise<ResolvedCommandFile>
  showNotification: (payload: SessionNotificationPayload) => Promise<boolean>
  readClipboardText: () => string
  writeClipboardText: (text: string) => void
  onSessionEvent: (callback: (event: SessionEvent) => void) => () => void
}

const easyAgentCenter: EasyAgentCenterAPI = {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkAppUpdate: () => ipcRenderer.invoke('check-app-update'),
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),
  openPath: (targetPath: string) => ipcRenderer.invoke('open-path', targetPath),
  openProjectInEditor: (editor: ProjectEditor, cwd: string) =>
    ipcRenderer.invoke('open-project-in-editor', editor, cwd),
  openCCSwitch: () => ipcRenderer.invoke('open-cc-switch'),
  discoverAgents: () => ipcRenderer.invoke('discover-agents'),
  createSession: (config: SessionConfig) => ipcRenderer.invoke('create-session', config),
  openCodexThread: (cwd: string, prompt?: string) =>
    ipcRenderer.invoke('open-codex-thread', cwd, prompt),
  deleteSession: (sessionId: string) => ipcRenderer.invoke('delete-session', sessionId),
  restartSession: (sessionId: string) => ipcRenderer.invoke('restart-session', sessionId),
  updateSession: (sessionId: string, patch: Pick<Partial<SessionInfo>, 'title' | 'archived'>) =>
    ipcRenderer.invoke('update-session', sessionId, patch),
  moveSession: (sessionId: string, direction: 'up' | 'down') =>
    ipcRenderer.invoke('move-session', sessionId, direction),
  sendInput: (sessionId: string, data: string) => ipcRenderer.send('send-input', sessionId, data),
  sendPrompt: (sessionId: string, prompt: string) => ipcRenderer.send('send-prompt', sessionId, prompt),
  stopSession: (sessionId: string) => ipcRenderer.send('stop-session', sessionId),
  resizeSession: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.send('resize-session', sessionId, cols, rows),
  listSessions: () => ipcRenderer.invoke('list-sessions'),
  readSessionLog: (sessionId: string) => ipcRenderer.invoke('read-session-log', sessionId),
  exportSessionMarkdown: (sessionId: string) =>
    ipcRenderer.invoke('export-session-markdown', sessionId),
  getDefaultCwd: () => ipcRenderer.invoke('get-default-cwd'),
  pickDirectory: (defaultPath?: string) => ipcRenderer.invoke('pick-directory', defaultPath),
  pickImageFile: (defaultPath?: string) => ipcRenderer.invoke('pick-image-file', defaultPath),
  resolveCommandFile: (filePath: string) => ipcRenderer.invoke('resolve-command-file', filePath),
  showNotification: (payload: SessionNotificationPayload) =>
    ipcRenderer.invoke('show-notification', payload),
  readClipboardText: () => clipboard.readText(),
  writeClipboardText: (text: string) => clipboard.writeText(text),
  onSessionEvent: (callback: (event: SessionEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: SessionEvent) => callback(data)
    ipcRenderer.on('session-event', handler)
    return () => {
      ipcRenderer.removeListener('session-event', handler)
    }
  },
}

contextBridge.exposeInMainWorld('easyAgentCenter', easyAgentCenter)

