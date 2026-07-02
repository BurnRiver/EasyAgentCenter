import type { AgentInstall } from '../types'

/**
 * Base interface for agent adapters.
 * Keep adapters focused on install detection and interactive session launch.
 * Cross-agent handoff is intentionally outside this core app.
 */
export interface AgentAdapter {
  id: string
  displayName: string
  defaultCommand: string

  /** Check if this agent is installed */
  detectInstall(): Promise<AgentInstall | null>

  /** Build the PTY command to launch this agent with a prompt */
  buildLaunchCommand(prompt?: string): string[]
}
