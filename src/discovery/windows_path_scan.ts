import { execFileSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { delimiter, extname, join } from 'node:path'

function isExecutableFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile()
  } catch {
    return false
  }
}

function windowsCommandCandidates(command: string): string[] {
  if (extname(command)) return [command]
  const extensions = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  return [command, ...extensions.map((extension) => `${command}${extension}`)]
}

function findWindowsCommand(command: string): string | null {
  const hasDirectory = /[\\/]/.test(command)
  const directories = hasDirectory
    ? ['']
    : [process.cwd(), ...(process.env.PATH || '').split(delimiter).filter(Boolean)]

  for (const directory of directories) {
    for (const candidate of windowsCommandCandidates(command)) {
      const path = hasDirectory ? candidate : join(directory, candidate)
      if (isExecutableFile(path)) return path
    }
  }

  return null
}

/**
 * Check if a command exists on the system PATH.
 * Avoids `where` on Windows so missing commands do not print localized output.
 */
export function commandExists(command: string): string | null {
  try {
    if (process.platform === 'win32') {
      return findWindowsCommand(command)
    }

    const result = execFileSync('which', [command], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return result.split(/\r?\n/)[0] || null
  } catch {
    return null
  }
}

/**
 * Scan for a list of command names and return which ones exist.
 */
export function scanCommands(commands: string[]): Map<string, string | null> {
  const results = new Map<string, string | null>()
  for (const cmd of commands) {
    results.set(cmd, commandExists(cmd))
  }
  return results
}
