import * as pty from 'node-pty'
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eventBus } from './event_bus'
import { transcriptStore } from '../storage/transcript_store'
import type { SessionInfo, SessionStatus } from '../types'

export interface PtyInstance {
  pty: pty.IPty
  session: SessionInfo
}

const instances = new Map<string, PtyInstance>()
const stoppingSessions = new Set<string>()
const STDIN_FILE_TOKEN = '__EASY_AGENT_CENTER_STDIN_FILE__'

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

function createStdinFile(sessionId: string, content: string): string {
  const dir = join(tmpdir(), 'easy-agent-center-prompts')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${sessionId}-${Date.now()}.txt`)
  writeFileSync(path, content, 'utf-8')
  return path
}

function createWindowsStdinWrapper(
  sessionId: string,
  launch: { file: string; args: string[]; label: string },
  stdinFilePath: string
): string | undefined {
  if (process.platform !== 'win32' || !isCmdExe(launch.file)) return undefined

  const commandIndex = launch.args.findIndex((arg) => {
    const normalized = arg.toLowerCase()
    return normalized === '/c' || normalized === '/k'
  })
  if (commandIndex === -1) return undefined

  const command = launch.args.slice(commandIndex + 1).join(' ')
  if (!command.includes(STDIN_FILE_TOKEN)) return undefined

  const dir = join(tmpdir(), 'easy-agent-center-prompts')
  mkdirSync(dir, { recursive: true })
  const wrapperPath = join(dir, `${sessionId}-${Date.now()}.cmd`)
  const expandedCommand = command.split(STDIN_FILE_TOKEN).join(stdinFilePath)

  writeFileSync(
    wrapperPath,
    ['@echo off', expandedCommand, 'exit /b %ERRORLEVEL%', ''].join('\r\n'),
    'utf-8'
  )

  return wrapperPath
}

function applyStdinFileToken(
  launch: { file: string; args: string[]; label: string },
  stdinFilePath?: string
): { file: string; args: string[]; label: string } {
  if (!stdinFilePath) return launch

  const replaceToken = (value: string) => value.split(STDIN_FILE_TOKEN).join(stdinFilePath)
  const file = replaceToken(launch.file)
  const args = launch.args.map(replaceToken)

  return {
    file,
    args,
    label: formatLaunchLabel(file, args),
  }
}

function cleanupStdinFile(path?: string): void {
  if (!path) return
  try {
    unlinkSync(path)
  } catch {
    // The temp file may already have been removed.
  }
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
  initialPrompt?: string,
  stdinText?: string
): PtyInstance {
  const stdinFilePath = stdinText ? createStdinFile(session.id, stdinText) : undefined
  const rawLaunch = buildLaunch(session.command, session.args)
  const stdinWrapperPath = stdinFilePath
    ? createWindowsStdinWrapper(session.id, rawLaunch, stdinFilePath)
    : undefined
  const launch = stdinWrapperPath
    ? {
        file: 'cmd.exe',
        args: ['/d', '/c', stdinWrapperPath],
        label: formatLaunchLabel('cmd.exe', ['/d', '/c', stdinWrapperPath]),
      }
    : applyStdinFileToken(rawLaunch, stdinFilePath)

  const cleanupStdinArtifacts = () => {
    cleanupStdinFile(stdinFilePath)
    cleanupStdinFile(stdinWrapperPath)
  }

  let ptyProcess: pty.IPty
  try {
    ptyProcess = spawnPty(launch.file, launch.args, session)
  } catch (err) {
    if (process.platform === 'win32' && session.command.trim()) {
      try {
        ptyProcess = spawnPty('cmd.exe', ['/d', '/s', '/k', launch.label], session)
        transcriptStore.log(session.id, `Direct command spawn failed, used cmd.exe fallback: ${err}`)
      } catch (fallbackErr) {
        cleanupStdinArtifacts()
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
      cleanupStdinArtifacts()
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
    eventBus.emit({ type: 'data', sessionId: session.id, data })
    transcriptStore.log(session.id, data, 'output')
  })

  ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
    cleanupStdinArtifacts()
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
      sendInput(session.id, `${initialPrompt.replace(/\r\n/g, '\n').replace(/\r/g, '\n')}\r`)
    }, session.promptDelayMs ?? 500)
  }

  return instance
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

