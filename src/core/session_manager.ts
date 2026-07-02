import { spawnSession, sendInput, sendPrompt, stopSession, resizeSession } from './pty_manager'
import { eventBus } from './event_bus'
import { sessionStore } from '../storage/session_store'
import type { SessionConfig, SessionInfo, SessionEvent } from '../types'

class SessionManager {
  private sessions = new Map<string, SessionInfo>()
  private eventListeners: ((event: SessionEvent) => void)[] = []
  private nextId = 1

  constructor() {
    const restoredSessions = sessionStore.loadSessions()
    for (const session of restoredSessions) {
      this.sessions.set(session.id, session)
    }
    this.nextId = this.computeNextId()
    if (restoredSessions.length > 0) {
      this.persist()
    }

    eventBus.subscribe((event) => {
      if ((event.type === 'status' || event.type === 'exit') && event.status) {
        const session = this.sessions.get(event.sessionId)
        if (session) {
          session.status = event.status
          this.persist()
        }
      }

      for (const listener of this.eventListeners) {
        listener(event)
      }
    })
  }

  private computeNextId(): number {
    let maxId = 0
    for (const session of this.sessions.values()) {
      const match = session.id.match(/^session-(\d+)$/)
      if (match) maxId = Math.max(maxId, Number(match[1]))
    }
    return maxId + 1
  }

  private persist(): void {
    sessionStore.saveSessions(this.listSessions())
  }

  createSession(config: SessionConfig): SessionInfo {
    const id = `session-${this.nextId++}`
    const session: SessionInfo = {
      id,
      agentId: config.agentId,
      command: config.command,
      args: config.args,
      cwd: config.cwd,
      title: config.title?.trim() || undefined,
      archived: false,
      status: 'idle',
      createdAt: Date.now(),
      promptDelayMs: config.promptDelayMs,
    }

    this.sessions.set(id, session)
    this.persist()
    eventBus.emit({ type: 'created', sessionId: id, status: 'idle' })

    // Spawn PTY — may throw if cwd doesn't exist or spawn fails
    try {
      spawnSession(session, config.prompt, config.stdinText)
    } catch {
      session.status = 'failed'
      eventBus.emit({ type: 'status', sessionId: id, status: 'failed' })
    }

    return session
  }

  updateSession(
    sessionId: string,
    patch: Pick<Partial<SessionInfo>, 'title' | 'archived'>
  ): SessionInfo | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null

    if ('title' in patch) {
      const title = patch.title?.trim()
      session.title = title || undefined
    }

    if (typeof patch.archived === 'boolean') {
      session.archived = patch.archived
      session.archivedAt = patch.archived ? Date.now() : undefined
    }

    this.persist()
    eventBus.emit({ type: 'updated', sessionId })
    return session
  }

  sendInput(sessionId: string, data: string): void {
    sendInput(sessionId, data)
  }

  sendPrompt(sessionId: string, prompt: string): void {
    sendPrompt(sessionId, prompt)
  }

  stopSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session && session.status === 'running') {
      session.status = 'closed'
      this.persist()
      eventBus.emit({ type: 'status', sessionId, status: 'closed' })
    }
    stopSession(sessionId)
  }

  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    if (session.status === 'running') {
      stopSession(sessionId)
    }

    this.sessions.delete(sessionId)
    this.persist()
    eventBus.emit({ type: 'deleted', sessionId })
    return true
  }

  moveSession(sessionId: string, direction: 'up' | 'down'): SessionInfo[] {
    const entries = Array.from(this.sessions.entries())
    const index = entries.findIndex(([id]) => id === sessionId)
    if (index === -1) return this.listSessions()

    const nextIndex = direction === 'up' ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= entries.length) return this.listSessions()

    const current = entries[index]
    entries[index] = entries[nextIndex]
    entries[nextIndex] = current

    this.sessions = new Map(entries)
    this.persist()
    eventBus.emit({ type: 'reordered', sessionId })
    return this.listSessions()
  }

  resizeSession(sessionId: string, cols: number, rows: number): void {
    resizeSession(sessionId, cols, rows)
  }

  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values())
  }

  getSession(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId)
  }

  onEvent(callback: (event: SessionEvent) => void): () => void {
    this.eventListeners.push(callback)
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== callback)
    }
  }

  stopAll(): void {
    for (const session of this.sessions.values()) {
      if (session.status === 'running') {
        session.status = 'closed'
        stopSession(session.id)
      }
    }
    this.persist()
  }
}

export const sessionManager = new SessionManager()

