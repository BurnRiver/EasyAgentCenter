import type { AgentAdapter } from './AgentAdapter'
import type { AgentInstall } from '../types'

export const genericAdapter: AgentAdapter = {
  id: 'generic',
  displayName: 'Custom CLI',
  defaultCommand: '',

  async detectInstall(): Promise<AgentInstall | null> {
    return {
      id: 'generic',
      displayName: 'Custom CLI',
      command: '',
      found: true,
    }
  },

  buildLaunchCommand(prompt?: string): string[] {
    if (prompt) {
      return [prompt]
    }
    return []
  },
}

