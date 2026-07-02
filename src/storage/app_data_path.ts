import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const APP_DIR_NAME = 'EasyAgentCenter'

function fallbackUserDataRoot(): string {
  const base = process.env.APPDATA ||
    process.env.LOCALAPPDATA ||
    (process.platform === 'win32' ? join(homedir(), 'AppData', 'Roaming') : homedir())
  return join(base, APP_DIR_NAME)
}

export function writableAppRoot(): string {
  const override = process.env.EASY_AGENT_CENTER_DATA_DIR?.trim()
  if (override) return override

  const projectRoot = resolve(__dirname, '..', '..')
  if (projectRoot.includes('.asar')) {
    return fallbackUserDataRoot()
  }

  return projectRoot
}
