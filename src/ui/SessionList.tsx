import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useI18n } from '../i18n'
import type { SessionInfo, AgentInstall, SessionConfig, ProjectEditor } from '../types'
import type { DragEvent, MouseEvent } from 'react'

export type ViewMode = 'project' | 'agent'

const VIEW_MODE_KEY = 'easy-agent-center-view-mode'
const PROJECTS_KEY = 'easy-agent-center-projects-v1'
const PINNED_PROJECTS_KEY = 'easy-agent-center-pinned-projects-v1'
const LAST_PROJECT_KEY = 'easy-agent-center-last-project'
const AGENT_DRAG_MIME = 'application/x-easy-agent-center-agent-id'
const HIDDEN_AGENT_IDS = new Set(['codex-app'])

function getInitialViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem(VIEW_MODE_KEY)
    if (stored === 'project' || stored === 'agent') return stored
  } catch {
    // localStorage may be unavailable
  }
  return 'agent'
}

interface Props {
  sessions: SessionInfo[]
  agents: Record<string, AgentInstall | null>
  hiddenAgentIds: Set<string>
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onStopSession: (id: string) => void
  onRestartSession: (session: SessionInfo) => void
  onExportSessionMarkdown: (session: SessionInfo) => void
  onDeleteSession: (id: string) => void
  onDeleteSessions?: (ids: string[]) => void
  onMoveSession: (id: string, direction: 'up' | 'down') => void
  onRenameSession: (id: string, title: string) => void
  onArchiveSession: (id: string, archived: boolean) => void
  onDuplicateSession: (session: SessionInfo) => void
  onCreateForAgent: (agentId: string) => void
  onQuickStart?: (config: SessionConfig) => Promise<SessionInfo | null>
  onOpenProjectDirectory: (cwd: string) => void
  onCopyProjectPath: (cwd: string) => void
  onOpenProjectEditor: (editor: ProjectEditor, cwd: string) => void
  defaultCwd: string
}

const statusColor: Record<string, string> = {
  idle: '#888',
  running: '#d6a241',
  done: '#4caf50',
  failed: '#f44336',
  closed: '#888',
}

const agentPriority: Record<string, number> = {
  'codex-app': 10,
  codex: 20,
  claude: 30,
  kimi: 40,
  gemini: 50,
  'cursor-cli': 55,
  opencode: 60,
  aider: 70,
  goose: 80,
  openhands: 90,
  continue: 100,
  'qwen-code': 110,
  cline: 120,
  'roo-code': 130,
  hermes: 140,
  openclaw: 145,
  pi: 150,
  generic: 900,
}

function agentSortPriority(agentId: string): number {
  if (agentId.startsWith('custom:')) return 850
  return agentPriority[agentId] ?? 500
}

/** Normalize a path for grouping: lowercase + forward slashes + strip trailing slash. */
function normalizeCwd(cwd: string): string {
  return cwd.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase()
}

/** Short label for a directory path (last segment). */
function dirLabel(cwd: string): string {
  return cwd.split(/[/\\]/).filter(Boolean).pop() || cwd
}

function sessionPrimaryLabel(
  session: SessionInfo,
  viewMode: ViewMode,
  agents: Record<string, AgentInstall | null>,
  t: (key: string) => string
): string {
  const title = session.title?.trim()
  if (title) return title
  return viewMode === 'project'
    ? agentDisplayName(session.agentId, agents[session.agentId], t)
    : dirLabel(session.cwd)
}

function sessionSecondaryLabel(
  session: SessionInfo,
  viewMode: ViewMode,
  agents: Record<string, AgentInstall | null>,
  t: (key: string) => string
): string {
  const original = viewMode === 'project'
    ? dirLabel(session.cwd)
    : agentDisplayName(session.agentId, agents[session.agentId], t)
  if (!session.title?.trim()) return original
  const counterpart = viewMode === 'project'
    ? agentDisplayName(session.agentId, agents[session.agentId], t)
    : dirLabel(session.cwd)
  return `${counterpart} · ${original}`
}

function readSavedProjects(): string[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  } catch {
    return []
  }
}

function writeSavedProjects(projects: string[]): void {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
  } catch {
    // ignore
  }
}

function readPinnedProjectKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(PINNED_PROJECTS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(
      parsed
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map(normalizeCwd)
    )
  } catch {
    return new Set()
  }
}

function writePinnedProjectKeys(projectKeys: Set<string>): void {
  try {
    localStorage.setItem(PINNED_PROJECTS_KEY, JSON.stringify([...projectKeys]))
  } catch {
    // ignore
  }
}

function readLastProject(): string {
  try {
    return localStorage.getItem(LAST_PROJECT_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeLastProject(project: string): void {
  try {
    if (project.trim()) {
      localStorage.setItem(LAST_PROJECT_KEY, project.trim())
    } else {
      localStorage.removeItem(LAST_PROJECT_KEY)
    }
  } catch {
    // ignore
  }
}

/** Resolve launch command for a discovered agent. */
function commandForAgent(agentId: string, info?: AgentInstall | null): string {
  if (agentId === 'generic') return 'powershell'
  if (agentId === 'codex-app') return 'codex app'
  if (agentId === 'openclaw') return 'openclaw terminal'
  return info?.command || info?.path || agentId
}

function agentDisplayName(
  agentId: string,
  info: AgentInstall | null | undefined,
  t: (key: string) => string
): string {
  if (agentId === 'generic') return t('agent.customCli')
  return info?.displayName || agentId
}

function agentHealthColor(info?: AgentInstall | null): string {
  if (!info?.found) return '#666'
  if (info.health?.status === 'needs-auth') return '#d6a241'
  if (info.health?.status === 'manual-only') return '#85858f'
  return '#4caf50'
}

function agentHealthLabel(info: AgentInstall | null | undefined, t: (key: string) => string): string {
  if (!info?.found) return t('sessionList.agentHealth.missing')
  if (info.health?.status === 'needs-auth') return t('sessionList.agentHealth.needsAuth')
  if (info.health?.status === 'manual-only') return t('sessionList.agentHealth.manualOnly')
  if (info.capabilities?.headless) return t('sessionList.agentHealth.autoReady')
  return t('sessionList.agentHealth.ready')
}

interface GroupCheckboxProps {
  checked: boolean
  indeterminate: boolean
  onChange: () => void
  title?: string
}

function GroupCheckbox({ checked, indeterminate, onChange, title }: GroupCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      className="session-checkbox group-checkbox"
      checked={checked}
      onChange={onChange}
      title={title}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

export default function SessionList({
  sessions,
  agents,
  hiddenAgentIds,
  activeSessionId,
  onSelectSession,
  onStopSession,
  onRestartSession,
  onExportSessionMarkdown,
  onDeleteSession,
  onDeleteSessions,
  onMoveSession,
  onRenameSession,
  onArchiveSession,
  onDuplicateSession,
  onCreateForAgent,
  onQuickStart,
  onOpenProjectDirectory,
  onCopyProjectPath,
  onOpenProjectEditor,
  defaultCwd,
}: Props) {
  const { t } = useI18n()
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [agentsCollapsed, setAgentsCollapsed] = useState(true) // default collapsed to save space
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set())
  const [savedProjects, setSavedProjects] = useState<string[]>(readSavedProjects)
  const [pinnedProjectKeys, setPinnedProjectKeys] = useState<Set<string>>(readPinnedProjectKeys)
  const [lastProjectCwd, setLastProjectCwd] = useState(readLastProject)
  const [archivedCollapsed, setArchivedCollapsed] = useState(true)
  const [contextMenu, setContextMenu] = useState<{
    session: SessionInfo
    x: number
    y: number
  } | null>(null)
  const activeSessions = useMemo(() => sessions.filter((session) => !session.archived), [sessions])
  const archivedSessions = useMemo(() => sessions.filter((session) => session.archived), [sessions])

  const handleSetViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    setCollapsedGroups(new Set())
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode)
    } catch {
      // ignore
    }
  }, [])

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const persistProjects = useCallback((projects: string[]) => {
    const deduped: string[] = []
    const seen = new Set<string>()
    for (const project of projects) {
      const trimmed = project.trim()
      if (!trimmed) continue
      const key = normalizeCwd(trimmed)
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(trimmed)
    }
    setSavedProjects(deduped)
    writeSavedProjects(deduped)
  }, [])

  const rememberProject = useCallback((project: string) => {
    const trimmed = project.trim()
    if (!trimmed) return
    setLastProjectCwd(trimmed)
    writeLastProject(trimmed)
  }, [])

  const addProject = useCallback(async () => {
    try {
      const picked = await window.easyAgentCenter.pickDirectory(defaultCwd || undefined)
      if (!picked) return
      persistProjects([...savedProjects, picked])
      rememberProject(picked)
      handleSetViewMode('project')
      const projectKey = normalizeCwd(picked)
      setCollapsedGroups((prev) => {
        const next = new Set(prev)
        next.delete(projectKey)
        return next
      })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err))
    }
  }, [defaultCwd, handleSetViewMode, persistProjects, rememberProject, savedProjects])

  const removeProject = useCallback((project: string) => {
    if (!window.confirm(t('sessionList.confirmRemoveProject', { project }))) return
    const target = normalizeCwd(project)
    persistProjects(savedProjects.filter((item) => normalizeCwd(item) !== target))
    setPinnedProjectKeys((prev) => {
      if (!prev.has(target)) return prev
      const next = new Set(prev)
      next.delete(target)
      writePinnedProjectKeys(next)
      return next
    })
  }, [persistProjects, savedProjects, t])

  const togglePinnedProject = useCallback((project: string) => {
    const trimmed = project.trim()
    if (!trimmed) return

    const key = normalizeCwd(trimmed)
    const nextPinnedProjectKeys = new Set(pinnedProjectKeys)
    if (nextPinnedProjectKeys.has(key)) {
      nextPinnedProjectKeys.delete(key)
    } else {
      nextPinnedProjectKeys.add(key)
      if (!savedProjects.some((item) => normalizeCwd(item) === key)) {
        persistProjects([...savedProjects, trimmed])
      }
      rememberProject(trimmed)
    }
    setPinnedProjectKeys(nextPinnedProjectKeys)
    writePinnedProjectKeys(nextPinnedProjectKeys)
  }, [pinnedProjectKeys, persistProjects, rememberProject, savedProjects])

  useEffect(() => {
    if (!contextMenu) return

    const closeMenu = () => setContextMenu(null)
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }

    window.addEventListener('click', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [contextMenu])

  // Build groups based on view mode.
  const groups = useMemo(() => {
    const map = new Map<string, {
      label: string
      title: string
      sessions: SessionInfo[]
      savedProject?: boolean
      pinnedProject?: boolean
    }>()
    if (viewMode === 'project') {
      for (const project of savedProjects) {
        const key = normalizeCwd(project)
        if (!map.has(key)) {
          map.set(key, {
            label: dirLabel(project),
            title: project,
            sessions: [],
            savedProject: true,
            pinnedProject: pinnedProjectKeys.has(key),
          })
        } else {
          map.get(key)!.pinnedProject = pinnedProjectKeys.has(key)
        }
      }
      for (const s of activeSessions) {
        const key = normalizeCwd(s.cwd)
        if (!map.has(key)) {
          map.set(key, {
            label: dirLabel(s.cwd),
            title: s.cwd,
            sessions: [],
            pinnedProject: pinnedProjectKeys.has(key),
          })
        } else {
          map.get(key)!.pinnedProject = pinnedProjectKeys.has(key)
        }
        map.get(key)!.sessions.push(s)
      }
    } else {
      for (const s of activeSessions) {
        const key = s.agentId
        if (!map.has(key)) {
          const info = agents[key]
          map.set(key, {
            label: agentDisplayName(key, info, t),
            title: key,
            sessions: [],
          })
        }
        map.get(key)!.sessions.push(s)
      }
    }
    const result = Array.from(map.entries()).map(([key, g]) => ({ key, ...g }))
    if (viewMode === 'project') {
      result.sort((a, b) => Number(Boolean(b.pinnedProject)) - Number(Boolean(a.pinnedProject)))
    }
    return result
  }, [activeSessions, agents, pinnedProjectKeys, savedProjects, t, viewMode])

  // Remove stale selections when sessions change.
  useEffect(() => {
    setSelectedSessionIds((prev) => {
      const existing = new Set(activeSessions.map((s) => s.id))
      const next = new Set([...prev].filter((id) => existing.has(id)))
      return next.size === prev.size ? prev : next
    })
    if (activeSessions.length === 0) {
      setSelectionMode(false)
    }
  }, [activeSessions])

  const toggleSessionSelected = useCallback((sessionId: string) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev)
      if (next.has(sessionId)) next.delete(sessionId)
      else next.add(sessionId)
      return next
    })
  }, [])

  const toggleGroupSelected = useCallback((groupSessionIds: string[]) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev)
      const allSelected = groupSessionIds.every((id) => next.has(id))
      if (allSelected) {
        groupSessionIds.forEach((id) => next.delete(id))
      } else {
        groupSessionIds.forEach((id) => next.add(id))
      }
      return next
    })
  }, [])

  const selectAllSessions = useCallback(() => {
    setSelectedSessionIds(new Set(activeSessions.map((s) => s.id)))
  }, [activeSessions])

  const clearSelectedSessions = useCallback(() => {
    setSelectedSessionIds(new Set())
  }, [])

  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true)
  }, [])

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    setSelectedSessionIds(new Set())
  }, [])

  const deleteSelectedSessions = useCallback(() => {
    if (selectedSessionIds.size === 0) return
    if (!window.confirm(t('sessionList.confirmDeleteSelected', { count: selectedSessionIds.size }))) return

    if (onDeleteSessions) {
      onDeleteSessions([...selectedSessionIds])
    } else {
      // Fallback to single deletes if batch callback is not provided.
      selectedSessionIds.forEach((id) => onDeleteSession(id))
    }
    exitSelectionMode()
  }, [selectedSessionIds, onDeleteSessions, onDeleteSession, exitSelectionMode, t])

  // Count of found agents for badge display.
  const foundCount = Object.entries(agents)
    .filter(([id, info]) => !HIDDEN_AGENT_IDS.has(id) && !hiddenAgentIds.has(id) && info?.found)
    .length
  const visibleAgents = useMemo(() => {
    return Object.entries(agents)
      .filter(([id, info]) => !HIDDEN_AGENT_IDS.has(id) && !hiddenAgentIds.has(id) && info?.found)
      .sort(([aId, aInfo], [bId, bInfo]) => {
        const priorityDiff = agentSortPriority(aId) - agentSortPriority(bId)
        if (priorityDiff !== 0) return priorityDiff
        return agentDisplayName(aId, aInfo, t).localeCompare(agentDisplayName(bId, bInfo, t))
      })
  }, [agents, hiddenAgentIds, t])
  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const latestSession = activeSessions.length > 0 ? activeSessions[activeSessions.length - 1] : null
  const recentSavedProject = useMemo(() => {
    const savedByKey = new Map(savedProjects.map((project) => [normalizeCwd(project), project]))
    const lastProject = lastProjectCwd.trim()
    if (lastProject) {
      const savedProject = savedByKey.get(normalizeCwd(lastProject))
      if (savedProject) return savedProject
    }
    return savedProjects[savedProjects.length - 1] ?? ''
  }, [lastProjectCwd, savedProjects])
  const quickStartCwd = recentSavedProject || activeSession?.cwd || latestSession?.cwd || defaultCwd

  const startAgent = useCallback(async (agentId: string, info?: AgentInstall | null) => {
    if (!info?.found) return
    if (!onQuickStart) {
      onCreateForAgent(agentId)
      return
    }
    let cwd = quickStartCwd
    if (savedProjects.length === 0) {
      try {
        const picked = await window.easyAgentCenter.pickDirectory(undefined)
        if (!picked) return
        persistProjects([picked])
        rememberProject(picked)
        handleSetViewMode('project')
        cwd = picked
      } catch (err) {
        window.alert(err instanceof Error ? err.message : String(err))
        return
      }
    }
    onQuickStart({
      agentId,
      command: commandForAgent(agentId, info),
      cwd,
    })
  }, [
    handleSetViewMode,
    onCreateForAgent,
    onQuickStart,
    persistProjects,
    quickStartCwd,
    rememberProject,
    savedProjects.length,
  ])

  const handleSelectSession = useCallback((sessionId: string) => {
    const session = sessions.find((item) => item.id === sessionId)
    if (session) rememberProject(session.cwd)
    onSelectSession(sessionId)
  }, [onSelectSession, rememberProject, sessions])

  const handleAgentDragStart = useCallback((event: DragEvent<HTMLDivElement>, agentId: string) => {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData(AGENT_DRAG_MIME, agentId)
    event.dataTransfer.setData('text/plain', agentId)
  }, [])

  const openSessionMenu = useCallback((event: MouseEvent<HTMLDivElement>, session: SessionInfo) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({ session, x: event.clientX, y: event.clientY })
  }, [])

  const renameSession = useCallback((session: SessionInfo) => {
    const currentTitle = session.title?.trim() || sessionPrimaryLabel(session, viewMode, agents, t)
    const nextTitle = window.prompt(t('sessionList.renamePrompt'), currentTitle)
    if (nextTitle === null) return
    onRenameSession(session.id, nextTitle.trim())
  }, [agents, onRenameSession, t, viewMode])

  const duplicateSession = useCallback((session: SessionInfo) => {
    onDuplicateSession(session)
  }, [onDuplicateSession])

  const renderSessionItem = (session: SessionInfo, options?: { archived?: boolean }) => {
    const isSelected = selectedSessionIds.has(session.id)
    return (
      <div
        key={session.id}
        className={`session-item ${session.id === activeSessionId ? 'active' : ''} ${selectionMode && isSelected ? 'session-item-selected' : ''} ${options?.archived ? 'session-item-archived' : ''}`}
        onClick={() => handleSelectSession(session.id)}
        onContextMenu={(event) => openSessionMenu(event, session)}
      >
        {selectionMode && !options?.archived && (
          <input
            type="checkbox"
            className="session-checkbox"
            checked={isSelected}
            onChange={() => toggleSessionSelected(session.id)}
            onClick={(e) => e.stopPropagation()}
            title={t('sessionList.selectSession')}
          />
        )}
        <span className="status-dot" style={{ backgroundColor: statusColor[session.status] }} />
        <div className="session-info">
          <div className="session-agent">
            {sessionPrimaryLabel(session, viewMode, agents, t)}
          </div>
          <div className="session-cwd" title={session.cwd}>
            {sessionSecondaryLabel(session, viewMode, agents, t)}
          </div>
        </div>
        <div className="session-actions">
          {!options?.archived && (
            <>
              <button
                className="btn-icon btn-icon-compact"
                onClick={(e) => {
                  e.stopPropagation()
                  onMoveSession(session.id, 'up')
                }}
                title={t('sessionList.moveUp')}
              >
                ↑
              </button>
              <button
                className="btn-icon btn-icon-compact"
                onClick={(e) => {
                  e.stopPropagation()
                  onMoveSession(session.id, 'down')
                }}
                title={t('sessionList.moveDown')}
              >
                ↓
              </button>
            </>
          )}
          {session.status === 'running' && (
            <button
              className="btn-icon btn-icon-compact"
              onClick={(e) => {
                e.stopPropagation()
                onStopSession(session.id)
              }}
              title={t('sessionList.stop')}
            >
              ■
            </button>
          )}
          <button
            className="btn-icon btn-icon-compact danger"
            onClick={(e) => {
              e.stopPropagation()
              onDeleteSession(session.id)
            }}
            title={t('sessionList.delete')}
          >
            ×
          </button>
        </div>
      </div>
    )
  }

  const contextMenuStyle = contextMenu
    ? {
        left: Math.min(contextMenu.x, Math.max(8, window.innerWidth - 210)),
        top: Math.min(contextMenu.y, Math.max(8, window.innerHeight - 380)),
      }
    : undefined

  return (
    <div className="session-list">
      {/* ── Agents section (collapsible) ── */}
      <div className="session-list-header" onClick={() => setAgentsCollapsed(!agentsCollapsed)} style={{ cursor: 'pointer' }}>
        <h3>{t('sessionList.agents')}</h3>
        <span className="section-toggle">
          {agentsCollapsed ? t('sessionList.expandAgents') : t('sessionList.collapseAgents')}
          <span style={{ fontSize: 10, marginLeft: 4 }}>{agentsCollapsed ? '▶' : '▼'}</span>
        </span>
        {!agentsCollapsed && foundCount > 0 && (
          <span className="agent-count-badge">{foundCount}</span>
        )}
      </div>

      {!agentsCollapsed && (
        <div className="agent-discovery">
          {visibleAgents.map(([id, info]) => (
            <div
              key={id}
              className="agent-item draggable"
              draggable={Boolean(info?.found)}
              onDragStart={(event) => handleAgentDragStart(event, id)}
            >
              {/* Left: status + name */}
              <div className="agent-item-left" onClick={() => startAgent(id, info)}>
                <span
                  className="status-dot"
                  style={{ backgroundColor: agentHealthColor(info) }}
                />
                <span className={`agent-name ${!info?.found ? 'dimmed' : ''}`}>
                  {agentDisplayName(id, info, t)}
                </span>
                <span className={`agent-status agent-health-${info?.health?.status ?? 'unknown'}`} title={info?.health?.message}>
                  {agentHealthLabel(info, t)}
                </span>
              </div>

              {/* Right: quick-start button (only when agent is found and handler provided) */}
              {info?.found && onQuickStart && (
                <button
                  className="btn-quick-start"
                  onClick={(e) => {
                    e.stopPropagation()
                    startAgent(id, info)
                  }}
                  title={`${t('sessionList.quickStart')} — ${agentDisplayName(id, info, t)}`}
                >
                  ▶
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Sessions section (always visible) ── */}
      <div className="session-list-divider" />

      <div className="session-list-header session-controls-header">
        <h3>{t('sessionList.sessions')}</h3>
        <div className="view-mode-switch" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'project'}
            className={`view-mode-btn ${viewMode === 'project' ? 'active' : ''}`}
            onClick={() => handleSetViewMode('project')}
          >
            {t('sessionList.viewMode.project')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'agent'}
            className={`view-mode-btn ${viewMode === 'agent' ? 'active' : ''}`}
            onClick={() => handleSetViewMode('agent')}
          >
            {t('sessionList.viewMode.agent')}
          </button>
        </div>
        {viewMode === 'project' && (
          <button
            type="button"
            className="btn btn-secondary btn-sm add-project-btn"
            onClick={addProject}
            title={t('sessionList.addProject')}
          >
            {t('sessionList.addProject')}
          </button>
        )}
      </div>

      {activeSessions.length > 0 && !selectionMode && (
        <div className="session-selection-toolbar">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={enterSelectionMode}
          >
            {t('sessionList.enterDeleteMode')}
          </button>
        </div>
      )}

      {activeSessions.length > 0 && selectionMode && (
        <div className="session-selection-toolbar">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={selectAllSessions}
            title={t('sessionList.selectAll')}
          >
            {t('sessionList.selectAll')}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={clearSelectedSessions}
            disabled={selectedSessionIds.size === 0}
            title={t('sessionList.clearSelection')}
          >
            {t('sessionList.clearSelection')}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={exitSelectionMode}
            title={t('sessionList.cancelDelete')}
          >
            {t('sessionList.cancelDelete')}
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={deleteSelectedSessions}
            disabled={selectedSessionIds.size === 0}
            title={t('sessionList.deleteSelected')}
          >
            {t('sessionList.deleteSelected')}
          </button>
          {selectedSessionIds.size > 0 && (
            <span className="session-selected-count">
              {t('sessionList.selectedCount', { count: selectedSessionIds.size })}
            </span>
          )}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="empty-hint">{activeSessions.length === 0 ? t('sessionList.empty') : t('sessionList.group.empty')}</div>
      ) : (
        groups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.key)
          const groupIds = group.sessions.map((s) => s.id)
          const selectedInGroup = groupIds.filter((id) => selectedSessionIds.has(id))
          const groupChecked = selectedInGroup.length === groupIds.length && groupIds.length > 0
          const groupIndeterminate = selectedInGroup.length > 0 && selectedInGroup.length < groupIds.length

          return (
            <div key={group.key} className="session-group">
              <div
                className="session-group-header"
                onClick={() => {
                  if (viewMode === 'project') rememberProject(group.title)
                  toggleGroup(group.key)
                }}
                title={group.title}
              >
                {selectionMode && (
                  <GroupCheckbox
                    checked={groupChecked}
                    indeterminate={groupIndeterminate}
                    onChange={() => toggleGroupSelected(groupIds)}
                    title={t('sessionList.selectGroup')}
                  />
                )}
                <span className="group-collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
                <span className="group-label">{group.label}</span>
                {viewMode === 'project' && (
                  <button
                    type="button"
                    className={`btn-icon btn-icon-compact project-pin-btn ${group.pinnedProject ? 'active' : ''}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      togglePinnedProject(group.title)
                    }}
                    title={group.pinnedProject ? t('sessionList.unpinProject') : t('sessionList.pinProject')}
                  >
                    {group.pinnedProject ? '★' : '☆'}
                  </button>
                )}
                <span className="group-count">{group.sessions.length}</span>
                {viewMode === 'project' && group.savedProject && (
                  <button
                    type="button"
                    className="btn-icon btn-icon-compact danger"
                    onClick={(event) => {
                      event.stopPropagation()
                      removeProject(group.title)
                    }}
                    title={t('sessionList.removeProject')}
                  >
                    x
                  </button>
                )}
              </div>
              {!isCollapsed && (
                <div className="session-group-body">
                  {group.sessions.length === 0 ? (
                    <div className="empty-hint">{t('sessionList.group.empty')}</div>
                  ) : (
                    group.sessions.map((session) => renderSessionItem(session))
                  )}
                </div>
              )}
            </div>
          )
        })
      )}

      {archivedSessions.length > 0 && (
        <>
          <div className="session-list-divider" />
          <div className="session-group archived-session-group">
            <div
              className="session-group-header"
              onClick={() => setArchivedCollapsed((collapsed) => !collapsed)}
              title={t('sessionList.archived')}
            >
              <span className="group-collapse-icon">{archivedCollapsed ? '▶' : '▼'}</span>
              <span className="group-label">{t('sessionList.archived')}</span>
              <span className="group-count">{archivedSessions.length}</span>
            </div>
            {!archivedCollapsed && (
              <div className="session-group-body">
                {archivedSessions.map((session) => renderSessionItem(session, { archived: true }))}
              </div>
            )}
          </div>
        </>
      )}

      {contextMenu && (
        <div
          className="session-context-menu"
          style={contextMenuStyle}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              onRestartSession(contextMenu.session)
              setContextMenu(null)
            }}
          >
            {t('sessionList.restart')}
          </button>
          <button
            type="button"
            onClick={() => {
              onExportSessionMarkdown(contextMenu.session)
              setContextMenu(null)
            }}
          >
            {t('sessionList.exportMarkdown')}
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenProjectDirectory(contextMenu.session.cwd)
              setContextMenu(null)
            }}
          >
            {t('projectAction.openFolder')}
          </button>
          <button
            type="button"
            onClick={() => {
              onCopyProjectPath(contextMenu.session.cwd)
              setContextMenu(null)
            }}
          >
            {t('projectAction.copyPath')}
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenProjectEditor('vscode', contextMenu.session.cwd)
              setContextMenu(null)
            }}
          >
            {t('projectAction.openVSCode')}
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenProjectEditor('cursor', contextMenu.session.cwd)
              setContextMenu(null)
            }}
          >
            {t('projectAction.openCursor')}
          </button>
          <button
            type="button"
            onClick={() => {
              renameSession(contextMenu.session)
              setContextMenu(null)
            }}
          >
            {t('sessionList.rename')}
          </button>
          <button
            type="button"
            onClick={() => {
              duplicateSession(contextMenu.session)
              setContextMenu(null)
            }}
          >
            {t('sessionList.duplicate')}
          </button>
          <button
            type="button"
            onClick={() => {
              onArchiveSession(contextMenu.session.id, !contextMenu.session.archived)
              setContextMenu(null)
            }}
          >
            {contextMenu.session.archived ? t('sessionList.unarchive') : t('sessionList.archive')}
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => {
              onDeleteSession(contextMenu.session.id)
              setContextMenu(null)
            }}
          >
            {t('sessionList.delete')}
          </button>
        </div>
      )}
    </div>
  )
}

