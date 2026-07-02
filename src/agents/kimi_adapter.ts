import type { AgentAdapter } from './AgentAdapter'
import type { AgentInstall } from '../types'
import { commandExists } from '../discovery/windows_path_scan'

export const kimiAdapter: AgentAdapter = {
  id: 'kimi',
  displayName: 'Kimi Code',
  defaultCommand: 'kimi',

  async detectInstall(): Promise<AgentInstall | null> {
    try {
      for (const command of ['kimi', 'kimi-code']) {
        const path = commandExists(command)
        if (path) {
          return {
            id: 'kimi',
            displayName: 'Kimi Code',
            command,
            found: true,
            path,
          }
        }
      }
      return null
    } catch {
      return null
    }
  },

  buildLaunchCommand(prompt?: string): string[] {
    if (prompt) {
      return [this.defaultCommand, prompt]
    }
    return [this.defaultCommand]
  },
}
