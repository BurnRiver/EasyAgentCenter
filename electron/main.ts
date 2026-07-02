import { existsSync } from 'node:fs'
import { basename, dirname, extname } from 'node:path'
import { app, ipcMain, BrowserWindow, dialog, shell, Notification } from 'electron'
import { createMainWindow } from './windows/main_window'
import { sessionManager } from '../src/core/session_manager'
import { discoverAgents } from '../src/discovery/agent_discovery'
import { transcriptStore } from '../src/storage/transcript_store'
import type { ResolvedCommandFile, SessionNotificationPayload } from '../src/types'

let mainWindow: BrowserWindow | null = null

if (process.platform === 'win32') {
  app.setAppUserModelId('com.easyagentcenter.desktop')
}

function quoteCommandPart(part: string): string {
  if (part && !/[\s&()^=;!'+,`~[\]{}]/.test(part)) return part
  return `"${part.replace(/"/g, '""')}"`
}

function displayNameFromPath(path: string): string {
  return basename(path, extname(path)) || path
}

function buildLaunchCommand(file: string, args?: string): string {
  const trimmedArgs = args?.trim()
  return [quoteCommandPart(file), trimmedArgs].filter(Boolean).join(' ')
}

function resolveCommandFile(filePath: string): ResolvedCommandFile {
  const trimmedPath = filePath.trim()
  const result: ResolvedCommandFile = {
    path: trimmedPath,
    launchCommand: quoteCommandPart(trimmedPath),
    displayName: displayNameFromPath(trimmedPath),
  }

  if (process.platform !== 'win32' || extname(trimmedPath).toLowerCase() !== '.lnk') {
    return result
  }

  try {
    const shortcut = shell.readShortcutLink(trimmedPath) as Electron.ShortcutDetails & {
      workingDirectory?: string
    }
    if (shortcut.target) {
      return {
        ...result,
        target: shortcut.target,
        args: shortcut.args,
        workingDirectory: shortcut.workingDirectory,
        launchCommand: buildLaunchCommand(shortcut.target, shortcut.args),
      }
    }
  } catch {
    // Keep the raw shortcut path when Windows cannot resolve the link.
  }

  return result
}

function cleanNotificationText(value: string, fallback: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) return fallback
  return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed
}

function setupIPC() {
  ipcMain.handle('discover-agents', async () => {
    return await discoverAgents()
  })

  ipcMain.handle('create-session', async (_event, config) => {
    return sessionManager.createSession(config)
  })

  ipcMain.handle('open-codex-thread', async (_event, cwd: string, prompt?: string) => {
    const params = new URLSearchParams()
    params.set('path', cwd)
    if (prompt?.trim()) {
      params.set('prompt', prompt.trim())
    }
    await shell.openExternal(`codex://threads/new?${params.toString()}`)
    return true
  })

  ipcMain.handle('delete-session', async (_event, sessionId: string) => {
    return sessionManager.deleteSession(sessionId)
  })

  ipcMain.handle('update-session', async (_event, sessionId: string, patch) => {
    return sessionManager.updateSession(sessionId, patch)
  })

  ipcMain.handle('move-session', async (_event, sessionId: string, direction: 'up' | 'down') => {
    return sessionManager.moveSession(sessionId, direction)
  })

  ipcMain.on('send-input', (_event, sessionId: string, data: string) => {
    sessionManager.sendInput(sessionId, data)
  })

  ipcMain.on('send-prompt', (_event, sessionId: string, prompt: string) => {
    sessionManager.sendPrompt(sessionId, prompt)
  })

  ipcMain.on('stop-session', (_event, sessionId: string) => {
    sessionManager.stopSession(sessionId)
  })

  ipcMain.on('resize-session', (_event, sessionId: string, cols: number, rows: number) => {
    sessionManager.resizeSession(sessionId, cols, rows)
  })

  ipcMain.handle('list-sessions', async () => {
    return sessionManager.listSessions()
  })

  ipcMain.handle('read-session-log', async (_event, sessionId: string) => {
    return transcriptStore.read(sessionId)
  })

  ipcMain.handle('get-default-cwd', async () => {
    return process.cwd()
  })

  ipcMain.handle('resolve-command-file', async (_event, filePath: string) => {
    return resolveCommandFile(filePath)
  })

  ipcMain.handle('show-notification', async (_event, payload: SessionNotificationPayload) => {
    if (!Notification.isSupported()) return false

    const notification = new Notification({
      title: cleanNotificationText(payload.title, 'EasyAgentCenter'),
      body: cleanNotificationText(payload.body, 'Session finished.'),
    })

    notification.on('click', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    })

    notification.show()
    return true
  })

  // Open native OS directory picker. Returns selected folder path or null if cancelled.
  // Accepts an optional `defaultPath` to start browsing from the current cwd value.
  ipcMain.handle(
    'pick-directory',
    async (_event, defaultPath?: string): Promise<string | null> => {
      const win = BrowserWindow.getFocusedWindow() ?? mainWindow ?? undefined
      const trimmedDefaultPath = defaultPath?.trim()
      const safeDefaultPath = trimmedDefaultPath && existsSync(trimmedDefaultPath)
        ? trimmedDefaultPath
        : app.getPath('home')
      const options: Electron.OpenDialogOptions = {
        title: 'Select Working Directory',
        defaultPath: safeDefaultPath,
        properties: ['openDirectory', 'createDirectory'],
      }
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options)
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    }
  )

  ipcMain.handle(
    'pick-image-file',
    async (_event, defaultPath?: string): Promise<string | null> => {
      const win = BrowserWindow.getFocusedWindow() ?? mainWindow ?? undefined
      const trimmedDefaultPath = defaultPath?.trim()
      const safeDefaultPath = trimmedDefaultPath && existsSync(trimmedDefaultPath)
        ? trimmedDefaultPath
        : trimmedDefaultPath && existsSync(dirname(trimmedDefaultPath))
          ? dirname(trimmedDefaultPath)
          : app.getPath('pictures')
      const options: Electron.OpenDialogOptions = {
        title: 'Select Background Image',
        defaultPath: safeDefaultPath,
        properties: ['openFile'],
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'] },
        ],
      }
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options)
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    }
  )

  // Forward session events to renderer
  sessionManager.onEvent((event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('session-event', event)
    }
  })
}

app.whenReady().then(() => {
  setupIPC()
  mainWindow = createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  sessionManager.stopAll()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
