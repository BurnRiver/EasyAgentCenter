import type { AgentInstall } from '../types'
import { getAgentSpec } from './agent-specs'

export type AgentPackageRisk = 'low' | 'medium' | 'manual'

export interface AgentPackageSpec {
  agentId: string
  displayName: string
  installCommand: string
  updateCommand: string
  risk: AgentPackageRisk
  noteKey: string
}

interface AgentPackageDefinition {
  installCommand?: string
  updateCommand?: string
  risk: AgentPackageRisk
  noteKey: string
}

const packageDefinitions: Record<string, AgentPackageDefinition> = {
  codex: {
    installCommand: 'cmd.exe /k npm install -g @openai/codex@latest',
    updateCommand: 'cmd.exe /k npm install -g @openai/codex@latest',
    risk: 'medium',
    noteKey: 'agentUpdate.note.npmGlobal',
  },
  'codex-app': {
    installCommand: 'cmd.exe /k npm install -g @openai/codex@latest',
    updateCommand: 'cmd.exe /k npm install -g @openai/codex@latest',
    risk: 'medium',
    noteKey: 'agentUpdate.note.npmGlobal',
  },
  claude: {
    installCommand: 'cmd.exe /k npm install -g @anthropic-ai/claude-code@latest',
    updateCommand: 'cmd.exe /k npm install -g @anthropic-ai/claude-code@latest',
    risk: 'medium',
    noteKey: 'agentUpdate.note.npmGlobal',
  },
  gemini: {
    installCommand: 'cmd.exe /k npm install -g @google/gemini-cli@latest',
    updateCommand: 'cmd.exe /k npm install -g @google/gemini-cli@latest',
    risk: 'medium',
    noteKey: 'agentUpdate.note.npmGlobal',
  },
  opencode: {
    installCommand: 'cmd.exe /k npm install -g opencode-ai@latest',
    updateCommand: 'cmd.exe /k npm install -g opencode-ai@latest',
    risk: 'medium',
    noteKey: 'agentUpdate.note.npmGlobalVerify',
  },
  openclaw: {
    installCommand: 'cmd.exe /k npm install -g openclaw@latest',
    updateCommand: 'cmd.exe /k npm install -g openclaw@latest',
    risk: 'medium',
    noteKey: 'agentUpdate.note.npmGlobal',
  },
  aider: {
    installCommand: 'cmd.exe /k python -m pip install -U aider-chat',
    updateCommand: 'cmd.exe /k python -m pip install -U aider-chat',
    risk: 'medium',
    noteKey: 'agentUpdate.note.pythonGlobal',
  },
  'swe-agent': {
    installCommand: 'cmd.exe /k python -m pip install -U swe-agent',
    updateCommand: 'cmd.exe /k python -m pip install -U swe-agent',
    risk: 'medium',
    noteKey: 'agentUpdate.note.pythonGlobal',
  },
  'qwen-code': {
    installCommand: 'cmd.exe /k npm install -g @qwen-code/qwen-code@latest',
    updateCommand: 'cmd.exe /k npm install -g @qwen-code/qwen-code@latest',
    risk: 'medium',
    noteKey: 'agentUpdate.note.npmGlobalVerify',
  },
  amp: {
    installCommand: 'cmd.exe /k npm install -g @sourcegraph/amp@latest',
    updateCommand: 'cmd.exe /k npm install -g @sourcegraph/amp@latest',
    risk: 'medium',
    noteKey: 'agentUpdate.note.npmGlobalVerify',
  },
  plandex: {
    updateCommand: 'cmd.exe /k plandex upgrade',
    risk: 'low',
    noteKey: 'agentUpdate.note.selfUpdate',
  },
  kimi: {
    risk: 'manual',
    noteKey: 'agentUpdate.note.manualInstall',
  },
  openhands: {
    risk: 'manual',
    noteKey: 'agentUpdate.note.manualInstall',
  },
  cline: {
    risk: 'manual',
    noteKey: 'agentUpdate.note.editorExtension',
  },
  goose: {
    risk: 'manual',
    noteKey: 'agentUpdate.note.manualInstall',
  },
  continue: {
    risk: 'manual',
    noteKey: 'agentUpdate.note.editorExtension',
  },
  crush: {
    risk: 'manual',
    noteKey: 'agentUpdate.note.manualInstall',
  },
  'kilo-code': {
    risk: 'manual',
    noteKey: 'agentUpdate.note.editorExtension',
  },
  'roo-code': {
    risk: 'manual',
    noteKey: 'agentUpdate.note.editorExtension',
  },
  tabby: {
    risk: 'manual',
    noteKey: 'agentUpdate.note.manualInstall',
  },
  'cursor-cli': {
    risk: 'manual',
    noteKey: 'agentUpdate.note.appManaged',
  },
  warp: {
    risk: 'manual',
    noteKey: 'agentUpdate.note.appManaged',
  },
  hermes: {
    risk: 'manual',
    noteKey: 'agentUpdate.note.manualInstall',
  },
  pi: {
    risk: 'manual',
    noteKey: 'agentUpdate.note.manualInstall',
  },
  generic: {
    risk: 'manual',
    noteKey: 'agentUpdate.note.custom',
  },
}

/**
 * Derive a Windows install/update command from AGENT_SPECS when no explicit
 * command is provided. This keeps install instructions in one place while
 * preserving the risk classifications above.
 */
function deriveInstallCommand(agentId: string): string | undefined {
  const spec = getAgentSpec(agentId)
  if (!spec) return undefined

  const { primary, type } = spec.install
  const npmPackage = primary.match(/npm\s+(?:install|i)\s+-g\s+(.+)$/i)?.[1]?.trim()
  const pipPackage = primary.match(/(?:python\s+-m\s+)?pip\s+install\s+(?:-U\s+)?(.+)$/i)?.[1]?.trim()

  if (type === 'npm') {
    return npmPackage
      ? `cmd.exe /k npm install -g ${npmPackage}@latest`
      : `cmd.exe /k ${primary}`
  }
  if (type === 'pip') {
    return pipPackage
      ? `cmd.exe /k python -m pip install -U ${pipPackage}`
      : `cmd.exe /k ${primary}`
  }
  if (type === 'powershell') {
    return primary
  }
  // standalone installs are typically editor/app managed; keep as reference text
  return primary
}

export function getAgentPackageSpec(
  agentId: string,
  info: AgentInstall | null | undefined
): AgentPackageSpec {
  const definition = packageDefinitions[agentId] ?? {
    risk: 'manual' as AgentPackageRisk,
    noteKey: 'agentUpdate.note.manualInstall',
  }

  const derivedCommand = definition.installCommand ?? deriveInstallCommand(agentId)

  return {
    agentId,
    displayName: info?.displayName ?? agentId,
    installCommand: derivedCommand ?? '',
    updateCommand: definition.updateCommand ?? derivedCommand ?? definition.installCommand ?? '',
    risk: definition.risk,
    noteKey: definition.noteKey,
  }
}

