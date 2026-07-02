export interface AgentInstall {
  id: string
  displayName: string
  command: string
  found: boolean
  path?: string
  custom?: boolean
  capabilities?: AgentCapabilities
  health?: AgentHealth
}

export interface CustomAgent {
  id: string
  displayName: string
  command: string
  shortcutPath?: string
  shortcutCommand?: string
}

export interface ResolvedCommandFile {
  path: string
  launchCommand: string
  displayName: string
  target?: string
  args?: string
  workingDirectory?: string
}

export interface AgentCapabilities {
  interactive: boolean
  headless: boolean
  resume?: boolean
  authCheck?: boolean
  autoApprove?: boolean
}

export type AgentHealthStatus = 'ready' | 'needs-auth' | 'manual-only' | 'unknown'

export interface AgentHealth {
  status: AgentHealthStatus
  message?: string
  details?: string
}

export type SessionStatus = 'idle' | 'running' | 'done' | 'failed' | 'closed'

export interface SessionConfig {
  agentId: string
  command: string
  args?: string[]
  cwd: string
  title?: string
  prompt?: string
  promptDelayMs?: number
}

export interface SessionInfo {
  id: string
  agentId: string
  command: string
  args?: string[]
  cwd: string
  title?: string
  archived?: boolean
  archivedAt?: number
  status: SessionStatus
  createdAt: number
  promptDelayMs?: number
}

export interface SessionEvent {
  type: 'created' | 'data' | 'exit' | 'status' | 'error' | 'deleted' | 'reordered' | 'updated' | 'restarted'
  sessionId: string
  data?: string
  code?: number
  status?: SessionStatus
  message?: string
}

export interface SessionNotificationPayload {
  title: string
  body: string
}

