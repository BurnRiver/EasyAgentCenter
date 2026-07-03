import { spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { app, ipcMain, BrowserWindow, dialog, shell, Notification } from 'electron'
import { createMainWindow } from './windows/main_window'
import { sessionManager } from '../src/core/session_manager'
import { discoverAgents } from '../src/discovery/agent_discovery'
import { transcriptStore } from '../src/storage/transcript_store'
import { buildSessionMarkdown, defaultMarkdownFileName } from '../src/storage/session_markdown_export'
import type { AppUpdateInfo, ProjectEditor, ResolvedCommandFile, SessionNotificationPayload } from '../src/types'

let mainWindow: BrowserWindow | null = null
const UPDATE_REPOSITORY = 'BurnRiver/EasyAgentCenter'

interface GitHubReleaseAsset {
  name?: string
  browser_download_url?: string
}

interface GitHubRelease {
  tag_name?: string
  name?: string
  draft?: boolean
  prerelease?: boolean
  html_url?: string
  published_at?: string
  created_at?: string
  assets?: GitHubReleaseAsset[]
}

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

function normalizeVersion(value: string | undefined): string {
  const cleaned = value?.trim().replace(/^v/i, '') ?? ''
  return cleaned.match(/\d+(?:\.\d+){0,3}/)?.[0] ?? cleaned
}

function versionParts(version: string): number[] {
  return normalizeVersion(version)
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part))
}

function compareVersions(left: string, right: string): number {
  const leftParts = versionParts(left)
  const rightParts = versionParts(right)
  const maxLength = Math.max(leftParts.length, rightParts.length, 3)

  for (let index = 0; index < maxLength; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    if (difference !== 0) return difference
  }

  return normalizeVersion(left).localeCompare(normalizeVersion(right))
}

function stableReleaseSort(left: GitHubRelease, right: GitHubRelease): number {
  const versionDifference = compareVersions(normalizeVersion(right.tag_name), normalizeVersion(left.tag_name))
  if (versionDifference !== 0) return versionDifference

  const rightTime = Date.parse(right.published_at ?? right.created_at ?? '')
  const leftTime = Date.parse(left.published_at ?? left.created_at ?? '')
  return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0)
}

function preferredReleaseAsset(release: GitHubRelease): GitHubReleaseAsset | undefined {
  const assets = Array.isArray(release.assets) ? release.assets : []
  const exeAssets = assets.filter((asset) =>
    typeof asset.name === 'string' &&
    /\.exe$/i.test(asset.name) &&
    typeof asset.browser_download_url === 'string'
  )
  return exeAssets.find((asset) => /easyagentcenter/i.test(asset.name ?? '')) ?? exeAssets[0]
}

async function checkForAppUpdate(): Promise<AppUpdateInfo> {
  const currentVersion = app.getVersion()
  const response = await fetch(`https://api.github.com/repos/${UPDATE_REPOSITORY}/releases`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `EasyAgentCenter/${currentVersion}`,
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status}`)
  }

  const data = await response.json() as unknown
  if (!Array.isArray(data)) {
    throw new Error('Invalid GitHub release response')
  }

  const releases = data as GitHubRelease[]
  const latestStableRelease = releases
    .filter((release) => !release.draft && !release.prerelease)
    .sort(stableReleaseSort)[0]

  if (!latestStableRelease) {
    return {
      currentVersion,
      hasUpdate: false,
    }
  }

  const latestVersion = normalizeVersion(latestStableRelease.tag_name || latestStableRelease.name)
  const asset = preferredReleaseAsset(latestStableRelease)

  return {
    currentVersion,
    latestVersion,
    hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
    releaseName: latestStableRelease.name,
    releaseUrl: latestStableRelease.html_url,
    assetName: asset?.name,
    assetUrl: asset?.browser_download_url,
    publishedAt: latestStableRelease.published_at,
  }
}

function cleanNotificationText(value: string, fallback: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) return fallback
  return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed
}

function editorCommand(editor: ProjectEditor): string {
  return editor === 'vscode' ? 'code' : 'cursor'
}

function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const lookup = process.platform === 'win32'
      ? spawn('where.exe', [command], { windowsHide: true })
      : spawn('which', [command], { windowsHide: true })

    lookup.once('error', () => resolve(false))
    lookup.once('close', (code) => resolve(code === 0))
  })
}

async function openProjectInEditor(editor: ProjectEditor, cwd: string): Promise<boolean> {
  const trimmedCwd = cwd.trim()
  if (!trimmedCwd || !existsSync(trimmedCwd)) return false

  const command = editorCommand(editor)
  if (!await commandExists(command)) return false

  return new Promise((resolve) => {
    const child = spawn(command, [trimmedCwd], {
      detached: true,
      shell: true,
      stdio: 'ignore',
      windowsHide: true,
    })

    child.once('error', () => resolve(false))
    child.once('spawn', () => {
      child.unref()
      resolve(true)
    })
  })
}

function setupIPC() {
  ipcMain.handle('get-app-version', async () => {
    return app.getVersion()
  })

  ipcMain.handle('check-app-update', async () => {
    return checkForAppUpdate()
  })

  ipcMain.handle('open-external-url', async (_event, url: string) => {
    try {
      const parsedUrl = new URL(url)
      if (parsedUrl.protocol !== 'https:') return false
      await shell.openExternal(parsedUrl.toString())
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('open-path', async (_event, targetPath: string) => {
    const trimmedPath = targetPath.trim()
    if (!trimmedPath) return 'Path is empty.'
    if (!existsSync(trimmedPath)) return `Path does not exist: ${trimmedPath}`
    return shell.openPath(trimmedPath)
  })

  ipcMain.handle('open-project-in-editor', async (_event, editor: ProjectEditor, cwd: string) => {
    if (editor !== 'vscode' && editor !== 'cursor') return false
    return openProjectInEditor(editor, cwd)
  })

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

  ipcMain.handle('restart-session', async (_event, sessionId: string) => {
    return sessionManager.restartSession(sessionId)
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

  ipcMain.handle('export-session-markdown', async (_event, sessionId: string): Promise<string | null> => {
    const session = sessionManager.getSession(sessionId)
    if (!session) return null

    const win = BrowserWindow.getFocusedWindow() ?? mainWindow ?? undefined
    const options: Electron.SaveDialogOptions = {
      title: 'Export Session Markdown',
      defaultPath: join(app.getPath('documents'), defaultMarkdownFileName(session)),
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    }
    const result = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null

    const filePath = extname(result.filePath).toLowerCase() === '.md'
      ? result.filePath
      : `${result.filePath}.md`
    const markdown = buildSessionMarkdown(session, transcriptStore.read(sessionId))
    writeFileSync(filePath, markdown, 'utf-8')
    return filePath
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
