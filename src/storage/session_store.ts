import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { writableAppRoot } from './app_data_path'
import type { SessionInfo, SessionStatus } from '../types'

const validStatuses = new Set<SessionStatus>(['idle', 'running', 'done', 'failed', 'closed'])

function normalizeStatus(status: unknown): SessionStatus {
  if (status === 'running' || status === 'idle') return 'closed'
  return validStatuses.has(status as SessionStatus) ? status as SessionStatus : 'closed'
}

class SessionStore {
  private filePath: string

  constructor() {
    this.filePath = join(writableAppRoot(), 'data', 'sessions.json')
  }

  private ensureDir(): void {
    const dir = dirname(this.filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }

  loadSessions(): SessionInfo[] {
    try {
      if (!existsSync(this.filePath)) return []
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf-8'))
      if (!Array.isArray(parsed)) return []

      return parsed
        .filter((item): item is SessionInfo =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.agentId === 'string' &&
          typeof item.command === 'string' &&
          typeof item.cwd === 'string' &&
          typeof item.createdAt === 'number'
        )
        .map((session) => ({
          ...session,
          status: normalizeStatus(session.status),
        }))
    } catch (err) {
      console.error('[SessionStore] Failed to load sessions:', err)
      return []
    }
  }

  saveSessions(sessions: SessionInfo[]): void {
    try {
      this.ensureDir()
      writeFileSync(this.filePath, JSON.stringify(sessions, null, 2), 'utf-8')
    } catch (err) {
      console.error('[SessionStore] Failed to save sessions:', err)
    }
  }
}

export const sessionStore = new SessionStore()
