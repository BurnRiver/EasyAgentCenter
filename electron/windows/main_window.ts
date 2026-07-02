import { app, BrowserWindow, screen, shell } from 'electron'
import path from 'node:path'

const isDev = !app.isPackaged

function windowIconPath(): string {
  return isDev
    ? path.resolve(__dirname, '../../assets/icon.ico')
    : path.join(process.resourcesPath, 'icon.ico')
}

function defaultWindowBounds(): { width: number; height: number } {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
  return {
    width: Math.min(1880, Math.max(1280, Math.floor(screenWidth * 0.92))),
    height: Math.min(1040, Math.max(760, Math.floor(screenHeight * 0.88))),
  }
}

export function createMainWindow(): BrowserWindow {
  const bounds = defaultWindowBounds()
  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 1040,
    minHeight: 640,
    title: 'EasyAgentCenter',
    icon: windowIconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    const devUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173'
    win.loadURL(devUrl)
    if (process.env.EASY_AGENT_CENTER_OPEN_DEVTOOLS === '1') {
      win.webContents.openDevTools()
    }
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}
