import type { AgentAdapter } from './AgentAdapter'
import type { AgentInstall } from '../types'
import { commandExists } from '../discovery/windows_path_scan'

export const codexAdapter: AgentAdapter = {
  id: 'codex',
  displayName: 'Codex CLI',
  defaultCommand: 'codex',

  async detectInstall(): Promise<AgentInstall | null> {
    try {
      const path = commandExists('codex')
      if (!path) return null
      return {
        id: 'codex',
        displayName: 'Codex CLI',
        command: 'codex',
        found: true,
        path,
      }
    } catch {
      return null
    }
  },

  buildLaunchCommand(prompt?: string): string[] {
    if (prompt) {
      return ['codex', prompt]
    }
    return ['codex']
  },
}
