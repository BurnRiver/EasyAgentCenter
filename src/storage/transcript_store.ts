import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { writableAppRoot } from './app_data_path'

class TranscriptStore {
  private logsDir: string

  constructor() {
    this.logsDir = join(writableAppRoot(), 'logs')
    this.ensureDir()
  }

  private ensureDir(): void {
    if (!existsSync(this.logsDir)) {
      mkdirSync(this.logsDir, { recursive: true })
    }
  }

  private clean(data: string): string {
    return data
      .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
      .replace(/\x1b\[[0-9;?<>]*[ -/]*[@-~]/g, '')
      .replace(/\x1b[()][A-Za-z0-9]/g, '')
      .replace(/\x1b[=>]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trimEnd()
  }

  log(sessionId: string, data: string, type: 'input' | 'output' | 'system' = 'system'): void {
    try {
      this.ensureDir()
      const timestamp = new Date().toISOString()
      const logFile = join(this.logsDir, `${sessionId}.log`)
      const prefix = type === 'input' ? '>>>' : type === 'output' ? '<<<' : '---'
      const cleanData = this.clean(data)
      if (!cleanData && type !== 'system') return
      const line = `[${timestamp}] ${prefix} ${cleanData}`
      appendFileSync(logFile, line + '\n', 'utf-8')
    } catch (err) {
      console.error('[TranscriptStore] Failed to write log:', err)
    }
  }

  getLogsDir(): string {
    return this.logsDir
  }

  read(sessionId: string): string {
    try {
      const logFile = join(this.logsDir, `${sessionId}.log`)
      if (!existsSync(logFile)) return ''
      return readFileSync(logFile, 'utf-8')
    } catch (err) {
      console.error('[TranscriptStore] Failed to read log:', err)
      return ''
    }
  }

  delete(sessionId: string): void {
    try {
      const logFile = join(this.logsDir, `${sessionId}.log`)
      if (existsSync(logFile)) unlinkSync(logFile)
    } catch (err) {
      console.error('[TranscriptStore] Failed to delete log:', err)
    }
  }
}

export const transcriptStore = new TranscriptStore()
