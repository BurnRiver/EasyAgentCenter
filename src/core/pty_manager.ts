import * as pty from 'node-pty'
import { eventBus } from './event_bus'
import { transcriptStore } from '../storage/transcript_store'
import type { SessionInfo, SessionStatus } from '../types'

export interface PtyInstance {
  pty: pty.IPty
  session: SessionInfo
}

const instances = new Map<string, PtyInstance>()
const stoppingSessions = new Set<string>()

function detectShell(): string {
  if (process.platform === 'win32') {
    return 'powershell.exe'
  }
  return process.env.SHELL || '/bin/bash'
}

function splitCommandLine(commandLine: string): { file: string; args: string[] } {
  const parts: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null

  for (let i = 0; i < commandLine.length; i++) {
    const char = commandLine[i]
    if ((char === '"' || char === "'") && !quote) {
      quote = char
      continue
    }
    if (char === quote) {
      quote = null
      continue
    }
    if (/\s/.test(char) && !quote) {
      if (current) {
        parts.push(current)
        current = ''
      }
      continue
    }
    current += char
  }

  if (current) parts.push(current)

  return {
    file: parts[0] || detectShell(),
    args: parts.slice(1),
  }
}

function isPowerShell(file: string): boolean {
  const normalized = file.toLowerCase().replace(/\\/g, '/')
  return normalized.endsWith('/powershell.exe') ||
    normalized.endsWith('/pwsh.exe') ||
    normalized === 'powershell' ||
    normalized === 'powershell.exe' ||
    normalized === 'pwsh' ||
    normalized === 'pwsh.exe'
}

function isCmdExe(file: string): boolean {
  const normalized = file.toLowerCase().replace(/\\/g, '/')
  return normalized === 'cmd' ||
    normalized === 'cmd.exe' ||
    normalized.endsWith('/cmd.exe')
}

function isWindowsShellShim(file: string): boolean {
  return /\.(cmd|bat)$/i.test(file)
}

function isBareWindowsCommand(file: string): boolean {
  if (/[\\/]/.test(file)) return false
  return !/\.[a-z0-9]+$/i.test(file)
}

function quoteForCmd(part: string): string {
  if (part && !/[\s&()^=;!'+,`~[\]{}]/.test(part)) return part
  return `"${part.replace(/"/g, '""')}"`
}

function formatCmdCommand(file: string, args: string[]): string {
  return [file, ...args].map(quoteForCmd).join(' ')
}

function shouldLaunchThroughCmd(file: string): boolean {
  if (process.platform !== 'win32') return false
  if (isPowerShell(file) || isCmdExe(file)) return false
  return isWindowsShellShim(file) || isBareWindowsCommand(file)
}

function formatLaunchLabel(file: string, args: string[]): string {
  return [file, ...args].map((part) => {
    if (!/\s/.test(part)) return part
    return `"${part.replace(/"/g, '\\"')}"`
  }).join(' ')
}

function buildLaunch(command: string, explicitArgs?: string[]): { file: string; args: string[]; label: string } {
  const trimmed = command.trim()
  const commandLine = trimmed || detectShell()

  if (explicitArgs) {
    return {
      file: commandLine,
      args: explicitArgs,
      label: formatLaunchLabel(commandLine, explicitArgs),
    }
  }

  const { file, args } = splitCommandLine(commandLine)

  if (process.platform === 'win32' && isPowerShell(file)) {
    const hasNoExit = args.some((arg) => arg.toLowerCase() === '-noexit')
    const hasNoLogo = args.some((arg) => arg.toLowerCase() === '-nologo')
    return {
      file,
      args: [
        ...(hasNoExit ? [] : ['-NoExit']),
        ...(hasNoLogo ? [] : ['-NoLogo']),
        ...args,
      ],
      label: commandLine,
    }
  }

  if (shouldLaunchThroughCmd(file)) {
    return {
      file: 'cmd.exe',
      args: ['/d', '/s', '/k', formatCmdCommand(file, args)],
      label: commandLine,
    }
  }

  return { file, args, label: commandLine }
}

function spawnPty(
  file: string,
  args: string[],
  session: SessionInfo
): pty.IPty {
  return pty.spawn(file, args, {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: session.cwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      LANG: process.env.LANG || 'en_US.UTF-8',
      LC_ALL: process.env.LC_ALL || 'en_US.UTF-8',
      PYTHONIOENCODING: process.env.PYTHONIOENCODING || 'utf-8',
      PYTHONUTF8: process.env.PYTHONUTF8 || '1',
      DISABLE_AUTOUPDATER: process.env.DISABLE_AUTOUPDATER || '1',
      NO_UPDATE_NOTIFIER: process.env.NO_UPDATE_NOTIFIER || '1',
    } as Record<string, string>,
    encoding: 'utf8',
  })
}

export function spawnSession(
  session: SessionInfo,
  initialPrompt?: string
): PtyInstance {
  const launch = buildLaunch(session.command, session.args)

  let ptyProcess: pty.IPty
  try {
    ptyProcess = spawnPty(launch.file, launch.args, session)
  } catch (err) {
    if (process.platform === 'win32' && session.command.trim()) {
      try {
        ptyProcess = spawnPty('cmd.exe', ['/d', '/s', '/k', launch.label], session)
        transcriptStore.log(session.id, `Direct command spawn failed, used cmd.exe fallback: ${err}`)
      } catch (fallbackErr) {
        session.status = 'failed'
        eventBus.emit({
          type: 'error',
          sessionId: session.id,
          message: `Failed to spawn PTY: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`,
        })
        eventBus.emit({ type: 'status', sessionId: session.id, status: 'failed' })
        transcriptStore.log(session.id, `ERROR: Failed to spawn PTY: ${fallbackErr}`)
        throw fallbackErr
      }
    } else {
      session.status = 'failed'
      eventBus.emit({
        type: 'error',
        sessionId: session.id,
        message: `Failed to spawn PTY: ${err instanceof Error ? err.message : String(err)}`,
      })
      eventBus.emit({ type: 'status', sessionId: session.id, status: 'failed' })
      transcriptStore.log(session.id, `ERROR: Failed to spawn PTY: ${err}`)
      throw err
    }
  }

  const instance: PtyInstance = { pty: ptyProcess, session }
  instances.set(session.id, instance)

  session.status = 'running'
  eventBus.emit({ type: 'status', sessionId: session.id, status: 'running' })
  transcriptStore.log(session.id, `Session started. Command: ${launch.label}, CWD: ${session.cwd}`)

  ptyProcess.onData((data: string) => {
    if (instances.get(session.id) !== instance) return

    eventBus.emit({ type: 'data', sessionId: session.id, data })
    transcriptStore.log(session.id, data, 'output')
  })

  ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
    if (instances.get(session.id) !== instance) return

    const stoppedByUser = stoppingSessions.has(session.id)
    const status: SessionStatus = stoppedByUser ? 'closed' : exitCode === 0 ? 'done' : 'failed'
    stoppingSessions.delete(session.id)
    session.status = status

    eventBus.emit({ type: 'exit', sessionId: session.id, code: exitCode })
    eventBus.emit({ type: 'status', sessionId: session.id, status })

    transcriptStore.log(session.id, `Session exited with code ${exitCode}`)
    instances.delete(session.id)
  })

  // Send initial prompt after PTY is ready
  if (initialPrompt) {
    setTimeout(() => {
      if (instances.get(session.id) === instance) {
        sendInput(session.id, `${initialPrompt.replace(/\r\n/g, '\n').replace(/\r/g, '\n')}\r`)
      }
    }, session.promptDelayMs ?? 500)
  }

  return instance
}

export function restartSession(session: SessionInfo): PtyInstance {
  const current = instances.get(session.id)
  if (current) {
    stoppingSessions.delete(session.id)
    try {
      current.pty.kill()
    } catch {
      // Process may have already exited.
    }
    if (instances.get(session.id) === current) {
      instances.delete(session.id)
    }
  }

  return spawnSession(session)
}

function shouldUseBracketedPaste(agentId: string): boolean {
  return [
    'claude',
    'codex',
    'kimi',
    'gemini',
    'cursor-cli',
    'opencode',
    'aider',
    'goose',
    'qwen-code',
    'hermes',
    'openclaw',
    'pi',
  ].includes(agentId)
}

export function sendPrompt(sessionId: string, prompt: string): void {
  const instance = instances.get(sessionId)
  if (!instance) return

  const normalizedPrompt = prompt.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  if (shouldUseBracketedPaste(instance.session.agentId)) {
    instance.pty.write(`\x1b[200~${normalizedPrompt}\x1b[201~`)
    transcriptStore.log(sessionId, normalizedPrompt, 'input')
    setTimeout(() => {
      const current = instances.get(sessionId)
      if (current) current.pty.write('\r')
    }, 250)
    return
  }

  sendInput(sessionId, `${normalizedPrompt}\r`)
}

export function sendInput(sessionId: string, data: string): void {
  const instance = instances.get(sessionId)
  if (instance) {
    instance.pty.write(data)
    transcriptStore.log(sessionId, data.trimEnd(), 'input')
  }
}

export function stopSession(sessionId: string): void {
  const instance = instances.get(sessionId)
  if (instance) {
    try {
      stoppingSessions.add(sessionId)
      instance.pty.kill()
    } catch {
      // Process may have already exited
      stoppingSessions.delete(sessionId)
    }
  }
}

export function resizeSession(sessionId: string, cols: number, rows: number): void {
  const instance = instances.get(sessionId)
  if (instance) {
    instance.pty.resize(cols, rows)
  }
}

