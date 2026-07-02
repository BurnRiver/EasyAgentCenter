import { codexAdapter } from '../agents/codex_adapter'
import { kimiAdapter } from '../agents/kimi_adapter'
import { genericAdapter } from '../agents/generic_adapter'
import { AGENT_SPECS, AGENT_ORDER, getAgentSpec } from '../agents/agent-specs'
import { commandExists } from './windows_path_scan'
import type { AgentCapabilities, AgentHealth, AgentInstall } from '../types'

/** All known agent adapters. Generic is always available as a fallback. */
const adapters = [codexAdapter, kimiAdapter, genericAdapter]

interface AgentCatalogEntry {
  id: string
  displayName: string
  commands: string[]
}

/** Build the discovery catalog directly from the single source of truth. */
const agentCatalog: AgentCatalogEntry[] = AGENT_ORDER.map((id) => {
  const spec = AGENT_SPECS[id]
  return {
    id,
    displayName: spec.displayName,
    commands: spec.detectCommands,
  }
})

const defaultCapabilities: AgentCapabilities = {
  interactive: true,
  headless: false,
}

function agentCapabilities(agentId: string): AgentCapabilities {
  return getAgentSpec(agentId)?.capabilities ?? defaultCapabilities
}

function agentHealth(agentId: string, found: boolean): AgentHealth {
  if (!found) {
    return {
      status: 'unknown',
      message: 'Not installed or not found in PATH.',
    }
  }

  const capabilities = agentCapabilities(agentId)
  if (!capabilities.headless && agentId !== 'generic') {
    return {
      status: 'manual-only',
      message: 'Installed, but EasyAgentCenter only knows how to launch it as an interactive session for now.',
    }
  }

  return {
    status: 'ready',
  }
}

function enrichInstall(install: AgentInstall): AgentInstall {
  const spec = getAgentSpec(install.id)
  return {
    ...install,
    displayName: spec?.displayName ?? install.displayName,
    capabilities: agentCapabilities(install.id),
    health: agentHealth(install.id, install.found),
  }
}

/** Scan one command via where/which. */
async function scanCommand(commandName: string): Promise<string | null> {
  return commandExists(commandName)
}

/** Scan one catalog entry. Missing entries are still returned so the UI can show full names. */
async function scanCatalogEntry(entry: AgentCatalogEntry): Promise<AgentInstall> {
  for (const command of entry.commands) {
    const path = await scanCommand(command)
    if (path) {
      return {
        id: entry.id,
        displayName: entry.displayName,
        command,
        found: true,
        path,
        capabilities: agentCapabilities(entry.id),
        health: agentHealth(entry.id, true),
      }
    }
  }

  return {
    id: entry.id,
    displayName: entry.displayName,
    command: entry.commands[0] ?? '',
    found: false,
    capabilities: agentCapabilities(entry.id),
    health: agentHealth(entry.id, false),
  }
}

/**
 * Discover all available agents.
 * Returns a map of agent ID to install info (null if not found).
 */
export async function discoverAgents(): Promise<Record<string, AgentInstall | null>> {
  const results: Record<string, AgentInstall | null> = {}

  // Run adapter detection
  const adapterResults = await Promise.allSettled(
    adapters.map(async (adapter) => ({
      id: adapter.id,
      result: await adapter.detectInstall(),
    }))
  )

  for (const r of adapterResults) {
    if (r.status === 'fulfilled') {
      const adapter = adapters.find((item) => item.id === r.value.id)
      results[r.value.id] = enrichInstall(r.value.result ?? {
        id: r.value.id,
        displayName: adapter?.displayName ?? r.value.id,
        command: adapter?.defaultCommand ?? '',
        found: false,
      })
    }
  }

  // Scan the canonical agent catalog derived from AGENT_SPECS. Some are
  // CLI-first, while others are editor-centric; we only mark them found when a
  // launch command exists.
  const catalogResults = await Promise.allSettled(agentCatalog.map(scanCatalogEntry))

  for (const r of catalogResults) {
    if (r.status === 'fulfilled' && !results[r.value.id]) {
      results[r.value.id] = r.value
    }
  }

  return results
}

