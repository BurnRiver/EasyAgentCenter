import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { CSSProperties, DragEvent } from 'react'
import { localeOptions, useI18n } from '../i18n'
import SessionList from './SessionList'
import TerminalPane from './TerminalPane'
import TaskDetailPanel from './TaskDetailPanel'
import CodexQuotaPanel from './CodexQuotaPanel'
import { getAgentPackageSpec } from '../agents/agent_update_catalog'
import type { Locale } from '../i18n'
import type {
  SessionInfo,
  SessionEvent,
  AgentInstall,
  SessionConfig,
  CustomAgent,
  ResolvedCommandFile,
  SessionNotificationPayload,
} from '../types'

declare global {
  interface Window {
    easyAgentCenter: {
      discoverAgents: () => Promise<Record<string, AgentInstall | null>>
      createSession: (config: SessionConfig) => Promise<SessionInfo>
      openCodexThread: (cwd: string, prompt?: string) => Promise<boolean>
      deleteSession: (sessionId: string) => Promise<boolean>
      updateSession: (
        sessionId: string,
        patch: Pick<Partial<SessionInfo>, 'title' | 'archived'>
      ) => Promise<SessionInfo | null>
      moveSession: (sessionId: string, direction: 'up' | 'down') => Promise<SessionInfo[]>
      sendInput: (sessionId: string, data: string) => void
      sendPrompt: (sessionId: string, prompt: string) => void
      stopSession: (sessionId: string) => void
      resizeSession: (sessionId: string, cols: number, rows: number) => void
      listSessions: () => Promise<SessionInfo[]>
      readSessionLog: (sessionId: string) => Promise<string>
      getDefaultCwd: () => Promise<string>
      resolveCommandFile: (filePath: string) => Promise<ResolvedCommandFile>
      showNotification: (payload: SessionNotificationPayload) => Promise<boolean>
      pickImageFile: (defaultPath?: string) => Promise<string | null>
      pickDirectory: (defaultPath?: string) => Promise<string | null>
      readClipboardText: () => string
      writeClipboardText: (text: string) => void
      onSessionEvent: (callback: (event: SessionEvent) => void) => () => void
    }
  }
}

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

function dirLabel(cwd: string): string {
  return cwd.split(/[/\\]/).filter(Boolean).pop() || cwd
}

function isExternalAgent(agentId: string): boolean {
  return agentId === 'codex-app'
}

const HIDDEN_AGENT_IDS = new Set(['codex-app'])
const CODEX_QUOTA_ENABLED_KEY = 'easy-agent-center-codex-quota-enabled'
const CUSTOM_AGENTS_KEY = 'easy-agent-center-custom-agents-v1'
const HIDDEN_AGENT_IDS_KEY = 'easy-agent-center-hidden-agent-ids-v1'
const APPEARANCE_KEY = 'easy-agent-center-appearance-v1'
const SESSION_NOTIFICATIONS_ENABLED_KEY = 'easy-agent-center-session-notifications-enabled'
const RAW_OUTPUT_LIMIT = 240000
const CLEAN_OUTPUT_LIMIT = 16000

type BackgroundMode = 'dark' | 'white' | 'paper' | 'image'

interface AppearanceSettings {
  backgroundMode: BackgroundMode
  customImagePath: string
}

function normalizeBackgroundMode(value: unknown): BackgroundMode {
  if (value === 'white' || value === 'paper' || value === 'image') return value
  return 'dark'
}

function readAppearanceSettings(): AppearanceSettings {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY)
    if (!raw) return { backgroundMode: 'dark', customImagePath: '' }
    const parsed = JSON.parse(raw) as Partial<AppearanceSettings>
    return {
      backgroundMode: normalizeBackgroundMode(parsed.backgroundMode),
      customImagePath: typeof parsed.customImagePath === 'string' ? parsed.customImagePath : '',
    }
  } catch {
    return { backgroundMode: 'dark', customImagePath: '' }
  }
}

function writeAppearanceSettings(settings: AppearanceSettings): void {
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(settings))
  } catch {
    // localStorage may be unavailable
  }
}

function cssUrlFromPath(path: string): string {
  const normalized = path.trim().replace(/\\/g, '/').replace(/"/g, '%22')
  if (/^[A-Za-z]:\//.test(normalized)) return `url("file:///${normalized}")`
  if (normalized.startsWith('//')) return `url("file:${normalized}")`
  return `url("${normalized}")`
}

function getInitialCodexQuotaEnabled(): boolean {
  try {
    return localStorage.getItem(CODEX_QUOTA_ENABLED_KEY) === 'true'
  } catch {
    return false
  }
}

function getInitialSessionNotificationsEnabled(): boolean {
  try {
    const stored = localStorage.getItem(SESSION_NOTIFICATIONS_ENABLED_KEY)
    return stored === null ? true : stored === 'true'
  } catch {
    return true
  }
}

function writeSessionNotificationsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SESSION_NOTIFICATIONS_ENABLED_KEY, String(enabled))
  } catch {
    // localStorage may be unavailable
  }
}

function readCustomAgents(): CustomAgent[] {
  try {
    const raw = localStorage.getItem(CUSTOM_AGENTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeStoredCustomAgent)
      .filter((item): item is CustomAgent => Boolean(item))
  } catch {
    return []
  }
}

function normalizeStoredCustomAgent(item: unknown): CustomAgent | null {
  if (!item || typeof item !== 'object') return null
  const candidate = item as Partial<CustomAgent>
  if (typeof candidate.id !== 'string' || typeof candidate.displayName !== 'string') return null

  const displayName = candidate.displayName.trim()
  const command = typeof candidate.command === 'string' ? candidate.command.trim() : ''
  const shortcutPath = typeof candidate.shortcutPath === 'string' ? candidate.shortcutPath.trim() : ''
  const shortcutCommand = typeof candidate.shortcutCommand === 'string' ? candidate.shortcutCommand.trim() : ''
  if (!displayName || (!command && !shortcutPath && !shortcutCommand)) return null

  return {
    id: candidate.id,
    displayName,
    command,
    ...(shortcutPath ? { shortcutPath } : {}),
    ...(shortcutCommand ? { shortcutCommand } : {}),
  }
}

function writeCustomAgents(agents: CustomAgent[]): void {
  try {
    localStorage.setItem(CUSTOM_AGENTS_KEY, JSON.stringify(agents))
  } catch {
    // localStorage may be unavailable
  }
}

function readHiddenAgentIds(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_AGENT_IDS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set()
  }
}

function writeHiddenAgentIds(agentIds: Set<string>): void {
  try {
    localStorage.setItem(HIDDEN_AGENT_IDS_KEY, JSON.stringify([...agentIds]))
  } catch {
    // localStorage may be unavailable
  }
}

function quoteLaunchPath(path: string): string {
  if (path && !/[\s&()^=;!'+,`~[\]{}]/.test(path)) return path
  return `"${path.replace(/"/g, '\\"')}"`
}

function customAgentLaunchCommand(agent: CustomAgent): string {
  return agent.command.trim() ||
    agent.shortcutCommand?.trim() ||
    (agent.shortcutPath ? quoteLaunchPath(agent.shortcutPath.trim()) : '')
}

function customAgentToInstall(agent: CustomAgent): AgentInstall {
  const launchCommand = customAgentLaunchCommand(agent)
  return {
    id: agent.id,
    displayName: agent.displayName,
    command: launchCommand,
    path: agent.command.trim() || agent.shortcutPath || launchCommand,
    found: true,
    custom: true,
    capabilities: { interactive: true, headless: false },
    health: { status: 'ready', message: 'Custom launch command.' },
  }
}

function mergeAgents(
  discovered: Record<string, AgentInstall | null>,
  customAgents: CustomAgent[]
): Record<string, AgentInstall | null> {
  const merged: Record<string, AgentInstall | null> = { ...discovered }
  for (const agent of customAgents) {
    merged[agent.id] = customAgentToInstall(agent)
  }
  return merged
}

function createCustomAgentId(): string {
  return `custom:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
}

function getDroppedFilePath(event: DragEvent<HTMLElement>): string | null {
  const file = event.dataTransfer.files[0] as (File & { path?: string }) | undefined
  if (file?.path) return file.path

  const text = event.dataTransfer.getData('text/plain').trim()
  if (/^[A-Za-z]:[\\/]/.test(text) || text.startsWith('\\\\')) return text
  return null
}

export default function App() {
  const { locale, setLocale, t } = useI18n()
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [rawSessionOutputs, setRawSessionOutputs] = useState<Record<string, string>>({})
  const [sessionOutputs, setSessionOutputs] = useState<Record<string, string>>({})
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [agents, setAgents] = useState<Record<string, AgentInstall | null>>({})
  const [customAgents, setCustomAgents] = useState<CustomAgent[]>(readCustomAgents)
  const [hiddenAgentIds, setHiddenAgentIds] = useState<Set<string>>(readHiddenAgentIds)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAgentListModal, setShowAgentListModal] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [showOptionsModal, setShowOptionsModal] = useState(false)
  const [initialAgentId, setInitialAgentId] = useState('generic')
  const [defaultCwd, setDefaultCwd] = useState('C:\\')
  const [codexQuotaEnabled, setCodexQuotaEnabledState] = useState(getInitialCodexQuotaEnabled)
  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings>(readAppearanceSettings)
  const [sessionNotificationsEnabled, setSessionNotificationsEnabledState] = useState(getInitialSessionNotificationsEnabled)
  const [isBooting, setIsBooting] = useState(true)
  const [focusMode, setFocusMode] = useState(false)
  const sessionsRef = useRef<SessionInfo[]>([])
  const allAgentsRef = useRef<Record<string, AgentInstall | null>>({})
  const sessionNotificationsEnabledRef = useRef(sessionNotificationsEnabled)
  const tRef = useRef(t)
  const notifiedSessionIdsRef = useRef<Set<string>>(new Set())
  const allAgents = useMemo(() => mergeAgents(agents, customAgents), [agents, customAgents])

  useEffect(() => {
    sessionsRef.current = sessions
  }, [sessions])

  useEffect(() => {
    allAgentsRef.current = allAgents
  }, [allAgents])

  useEffect(() => {
    sessionNotificationsEnabledRef.current = sessionNotificationsEnabled
  }, [sessionNotificationsEnabled])

  useEffect(() => {
    tRef.current = t
  }, [t])

  useEffect(() => {
    let cancelled = false

    async function boot() {
      const [agentResult, cwdResult, sessionResult] = await Promise.allSettled([
        window.easyAgentCenter.discoverAgents(),
        window.easyAgentCenter.getDefaultCwd(),
        window.easyAgentCenter.listSessions(),
      ])

      if (cancelled) return

      if (agentResult.status === 'fulfilled') {
        setAgents(agentResult.value)
      }
      if (cwdResult.status === 'fulfilled') {
        setDefaultCwd(cwdResult.value)
      }
      if (sessionResult.status === 'fulfilled') {
        setSessions(sessionResult.value)
        setActiveSessionId((current) => current ?? sessionResult.value.at(-1)?.id ?? null)
      }
      setIsBooting(false)
    }

    void boot()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const unsubscribe = window.easyAgentCenter.onSessionEvent((event: SessionEvent) => {
      if (event.type === 'created') {
        window.easyAgentCenter.listSessions().then(setSessions)
      } else if (event.type === 'data' && event.data) {
        setRawSessionOutputs((prev) => {
          const nextRaw = appendOutput(prev[event.sessionId] ?? '', event.data ?? '', RAW_OUTPUT_LIMIT)
          setSessionOutputs((cleanPrev) => ({
            ...cleanPrev,
            [event.sessionId]: cleanSessionOutput(nextRaw).slice(-CLEAN_OUTPUT_LIMIT),
          }))
          return { ...prev, [event.sessionId]: nextRaw }
        })
      } else if (event.type === 'status' || event.type === 'exit') {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === event.sessionId
              ? { ...s, status: event.status ?? s.status }
              : s
          )
        )

        if (
          event.type === 'status' &&
          (event.status === 'done' || event.status === 'failed') &&
          sessionNotificationsEnabledRef.current &&
          !notifiedSessionIdsRef.current.has(event.sessionId)
        ) {
          notifiedSessionIdsRef.current.add(event.sessionId)
          const session = sessionsRef.current.find((item) => item.id === event.sessionId)
          const currentT = tRef.current
          const agentName = session
            ? agentDisplayName(session.agentId, allAgentsRef.current[session.agentId], currentT)
            : currentT('agent.customCli')
          const sessionLabel = session?.title?.trim() || agentName
          const project = session ? dirLabel(session.cwd) : event.sessionId
          void window.easyAgentCenter.showNotification({
            title: currentT(event.status === 'done'
              ? 'notification.sessionDoneTitle'
              : 'notification.sessionFailedTitle'),
            body: currentT(event.status === 'done'
              ? 'notification.sessionDoneBody'
              : 'notification.sessionFailedBody', {
                session: sessionLabel,
                project,
              }),
          })
        }
      } else if (event.type === 'deleted') {
        notifiedSessionIdsRef.current.delete(event.sessionId)
        setRawSessionOutputs((prev) => {
          const next = { ...prev }
          delete next[event.sessionId]
          return next
        })
        setSessionOutputs((prev) => {
          const next = { ...prev }
          delete next[event.sessionId]
          return next
        })
        window.easyAgentCenter.listSessions().then(setSessions)
      } else if (event.type === 'reordered' || event.type === 'updated') {
        window.easyAgentCenter.listSessions().then(setSessions)
      }
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!activeSessionId || rawSessionOutputs[activeSessionId]) return

    let cancelled = false
    window.easyAgentCenter.readSessionLog(activeSessionId).then((log) => {
      if (cancelled || !log) return
      const rawLog = restoreTranscriptOutput(log)
      setRawSessionOutputs((prev) => {
        if (prev[activeSessionId]) return prev
        return { ...prev, [activeSessionId]: appendOutput('', rawLog, RAW_OUTPUT_LIMIT) }
      })
      setSessionOutputs((prev) => {
        if (prev[activeSessionId]) return prev
        return { ...prev, [activeSessionId]: cleanSessionOutput(rawLog).slice(-CLEAN_OUTPUT_LIMIT) }
      })
    })

    return () => {
      cancelled = true
    }
  }, [activeSessionId, rawSessionOutputs])

  const launchSession = useCallback(async (config: SessionConfig): Promise<SessionInfo | null> => {
    if (isExternalAgent(config.agentId)) {
      await window.easyAgentCenter.openCodexThread(config.cwd, config.prompt)
      return null
    }

    const session = await window.easyAgentCenter.createSession(config)
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === session.id)
      if (exists) return prev.map((s) => (s.id === session.id ? session : s))
      return [...prev, session]
    })
    setActiveSessionId(session.id)
    return session
  }, [])

  const handleCreateSession = useCallback(async (config: SessionConfig) => {
    await launchSession(config)
    setShowCreateModal(false)
  }, [launchSession])

  const handleStopSession = useCallback((sessionId: string) => {
    window.easyAgentCenter.stopSession(sessionId)
  }, [])

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId)
    const label = session ? `${session.agentId} - ${session.cwd}` : sessionId
    if (!window.confirm(t('sessionList.deleteConfirm', { session: label }))) return

    const index = sessions.findIndex((s) => s.id === sessionId)
    const deleted = await window.easyAgentCenter.deleteSession(sessionId)
    if (!deleted) return

    const nextSessions = sessions.filter((s) => s.id !== sessionId)
    setSessions(nextSessions)

    if (activeSessionId === sessionId) {
      const fallback = nextSessions[index] ?? nextSessions[index - 1] ?? null
      setActiveSessionId(fallback?.id ?? null)
    }
  }, [activeSessionId, sessions, t])

  const handleDeleteSessions = useCallback(async (sessionIds: string[]) => {
    if (sessionIds.length === 0) return

    // Sequential single deletes; backend is responsible for stopping running sessions first.
    const deletedIds: string[] = []
    for (const sessionId of sessionIds) {
      const deleted = await window.easyAgentCenter.deleteSession(sessionId)
      if (deleted) deletedIds.push(sessionId)
    }

    if (deletedIds.length === 0) return

    const deletedSet = new Set(deletedIds)
    const nextSessions = sessions.filter((s) => !deletedSet.has(s.id))
    setSessions(nextSessions)

    if (activeSessionId && deletedSet.has(activeSessionId)) {
      setActiveSessionId(nextSessions.at(-1)?.id ?? null)
    }
  }, [activeSessionId, sessions])

  const handleMoveSession = useCallback(async (sessionId: string, direction: 'up' | 'down') => {
    const nextSessions = await window.easyAgentCenter.moveSession(sessionId, direction)
    setSessions(nextSessions)
  }, [])

  const handleRenameSession = useCallback(async (sessionId: string, title: string) => {
    const updated = await window.easyAgentCenter.updateSession(sessionId, { title })
    if (!updated) return
    setSessions((prev) => prev.map((session) => session.id === sessionId ? updated : session))
  }, [])

  const handleArchiveSession = useCallback(async (sessionId: string, archived: boolean) => {
    const updated = await window.easyAgentCenter.updateSession(sessionId, { archived })
    if (!updated) return
    setSessions((prev) => prev.map((session) => session.id === sessionId ? updated : session))
    if (archived && activeSessionId === sessionId) {
      setActiveSessionId((current) => {
        if (current !== sessionId) return current
        return sessions.find((session) => session.id !== sessionId && !session.archived)?.id ?? null
      })
    }
  }, [activeSessionId, sessions])

  const handleDuplicateSession = useCallback(async (session: SessionInfo) => {
    const baseTitle = session.title?.trim() || agentDisplayName(session.agentId, allAgents[session.agentId], t)
    const copiedTitle = t('sessionList.copyTitle', { title: baseTitle })
    await launchSession({
      agentId: session.agentId,
      command: session.command,
      args: session.args,
      cwd: session.cwd,
      title: copiedTitle,
      promptDelayMs: session.promptDelayMs,
    })
  }, [allAgents, launchSession, t])

  /** Quick-start: create a session immediately with the given defaults, no modal. */
  const handleQuickStart = useCallback(async (config: SessionConfig) => {
    return launchSession(config)
  }, [launchSession])

  const setCodexQuotaEnabled = useCallback((enabled: boolean) => {
    setCodexQuotaEnabledState(enabled)
    try {
      localStorage.setItem(CODEX_QUOTA_ENABLED_KEY, String(enabled))
    } catch {
      // ignore
    }
  }, [])

  const setSessionNotificationsEnabled = useCallback((enabled: boolean) => {
    setSessionNotificationsEnabledState(enabled)
    writeSessionNotificationsEnabled(enabled)
  }, [])

  const handleSaveAgentList = useCallback((nextAgents: CustomAgent[], nextHiddenAgentIds: Set<string>) => {
    const validAgentIds = new Set([...Object.keys(agents), ...nextAgents.map((agent) => agent.id)])
    const cleanedHiddenAgentIds = new Set(
      [...nextHiddenAgentIds].filter((id) => validAgentIds.has(id) && !HIDDEN_AGENT_IDS.has(id))
    )

    setCustomAgents(nextAgents)
    setHiddenAgentIds(cleanedHiddenAgentIds)
    writeCustomAgents(nextAgents)
    writeHiddenAgentIds(cleanedHiddenAgentIds)
  }, [agents])

  const handleSaveOptions = useCallback((
    nextLocale: Locale,
    nextAppearance: AppearanceSettings,
    nextSessionNotificationsEnabled: boolean
  ) => {
    const cleanedAppearance = {
      backgroundMode: normalizeBackgroundMode(nextAppearance.backgroundMode),
      customImagePath: nextAppearance.customImagePath.trim(),
    }
    setLocale(nextLocale)
    setAppearanceSettings(cleanedAppearance)
    setSessionNotificationsEnabled(nextSessionNotificationsEnabled)
    writeAppearanceSettings(cleanedAppearance)
    setShowOptionsModal(false)
  }, [setLocale, setSessionNotificationsEnabled])

  const handleRefreshCodexQuota = useCallback(() => {
    if (!activeSessionId) return
    window.easyAgentCenter.sendInput(activeSessionId, '/status\r')
    window.setTimeout(() => {
      window.easyAgentCenter.sendInput(activeSessionId, '/usage\r')
    }, 600)
  }, [activeSessionId])

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null
  const activeAgentName = activeSession
    ? agentDisplayName(activeSession.agentId, allAgents[activeSession.agentId], t)
    : ''
  const modalOpen = showCreateModal || showAgentListModal || showUpdateModal || showOptionsModal || isBooting
  const effectiveBackgroundMode = appearanceSettings.backgroundMode === 'image' && !appearanceSettings.customImagePath.trim()
    ? 'paper'
    : appearanceSettings.backgroundMode
  const appStyle = appearanceSettings.backgroundMode === 'image' && appearanceSettings.customImagePath.trim()
    ? ({ '--app-custom-bg-image': cssUrlFromPath(appearanceSettings.customImagePath) } as CSSProperties)
    : undefined

  return (
    <div className={`app app-background-${effectiveBackgroundMode}`} style={appStyle}>
      <div className="header">
        <div className="header-left">
          <h1>EasyAgentCenter</h1>
          <span className="header-subtitle">{t('header.subtitle')}</span>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              setInitialAgentId('generic')
              setShowCreateModal(true)
            }}
          >
            {t('btn.newSession')}
          </button>
          <button
            className={`btn btn-secondary ${focusMode ? 'active' : ''}`}
            onClick={() => setFocusMode((current) => !current)}
          >
            {focusMode ? t('btn.exitFocusMode') : t('btn.focusMode')}
          </button>
          <button className="btn btn-secondary" onClick={() => window.easyAgentCenter.discoverAgents().then(setAgents)}>
            {t('btn.refreshAgents')}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowUpdateModal(true)}>
            {t('btn.manageAgents')}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowAgentListModal(true)}>
            {t('btn.customAgents')}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowOptionsModal(true)}>
            {t('btn.options')}
          </button>
        </div>
      </div>

      <div className="main-layout">
        <SessionList
          sessions={sessions}
          agents={allAgents}
          hiddenAgentIds={hiddenAgentIds}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onStopSession={handleStopSession}
          onDeleteSession={handleDeleteSession}
          onDeleteSessions={handleDeleteSessions}
          onMoveSession={handleMoveSession}
          onRenameSession={handleRenameSession}
          onArchiveSession={handleArchiveSession}
          onDuplicateSession={handleDuplicateSession}
          onCreateForAgent={(agentId) => {
            setInitialAgentId(agentId)
            setShowCreateModal(true)
          }}
          onQuickStart={handleQuickStart}
          defaultCwd={activeSession?.cwd || defaultCwd}
        />

        <div className="center-panel">
          <TerminalPane
            session={activeSession}
            agentName={activeAgentName}
            output={activeSession ? rawSessionOutputs[activeSession.id] ?? '' : ''}
            onSendInput={(data) => {
              if (activeSessionId && activeSession?.status === 'running') {
                window.easyAgentCenter.sendInput(activeSessionId, data)
              }
            }}
            onResize={(cols, rows) => {
              if (activeSessionId) {
                window.easyAgentCenter.resizeSession(activeSessionId, cols, rows)
              }
            }}
            allowAutoFocus={!modalOpen}
          />
        </div>

        {!focusMode && (
          <div className="right-panel">
            <TaskDetailPanel session={activeSession} agentName={activeAgentName} />
            <CodexQuotaPanel
              session={activeSession}
              output={activeSession ? sessionOutputs[activeSession.id] ?? '' : ''}
              enabled={codexQuotaEnabled}
              onEnabledChange={setCodexQuotaEnabled}
              onRefresh={handleRefreshCodexQuota}
            />
          </div>
        )}

      </div>

      {showCreateModal && (
        <CreateSessionModal
          agents={allAgents}
          initialAgentId={initialAgentId}
          defaultCwd={activeSession?.cwd || defaultCwd}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateSession}
        />
      )}

      {showAgentListModal && (
        <AgentListModal
          agents={allAgents}
          customAgents={customAgents}
          hiddenAgentIds={hiddenAgentIds}
          onClose={() => setShowAgentListModal(false)}
          onSave={handleSaveAgentList}
        />
      )}

      {showUpdateModal && (
        <AgentUpdateModal
          agents={agents}
          defaultCwd={activeSession?.cwd || defaultCwd}
          onClose={() => setShowUpdateModal(false)}
          onUpdate={handleQuickStart}
        />
      )}

      {showOptionsModal && (
        <OptionsModal
          locale={locale}
          appearance={appearanceSettings}
          sessionNotificationsEnabled={sessionNotificationsEnabled}
          onClose={() => setShowOptionsModal(false)}
          onSave={handleSaveOptions}
        />
      )}

      {isBooting && (
        <div className="startup-overlay">
          <div className="startup-loading">
            <h1>EasyAgentCenter</h1>
            <p>{t('app.loading')}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function cleanSessionOutput(output: string): string {
  const cleaned = output
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-9;?<>]*[ -/]*[@-~]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  return renderAgentJsonOutput(restoreTranscriptOutput(cleaned))
}

function appendOutput(previous: string, chunk: string, limit: number): string {
  const next = previous + chunk
  if (next.length <= limit) return next
  return next.slice(next.length - limit)
}

function renderAgentJsonOutput(output: string): string {
  const trimmed = output.trim()
  if (!trimmed) return output

  const jsonCandidates = [
    trimmed,
    trimmed.slice(trimmed.indexOf('{'), trimmed.lastIndexOf('}') + 1),
    ...trimmed.split('\n').map((line) => line.trim()),
  ].filter((candidate) => candidate.startsWith('{') && candidate.endsWith('}'))

  for (const candidate of jsonCandidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>
      const result = parsed.result
      if (typeof result === 'string' && result.trim()) {
        return result.trim()
      }

      const content = parsed.content
      if (typeof content === 'string' && content.trim()) {
        return content.trim()
      }
    } catch {
      // Output may be normal terminal text, partial JSON, or mixed logs.
    }
  }

  return output
}

function restoreTranscriptOutput(output: string): string {
  const lines = output.split('\n')
  const transcriptLine = /^\[\d{4}-\d{2}-\d{2}T[^\]]+\]\s+(<<<|>>>|---)\s?(.*)$/

  if (!lines.some((line) => transcriptLine.test(line))) {
    return output
  }

  const restored: string[] = []
  let currentType: 'input' | 'output' | 'system' | null = null

  for (const line of lines) {
    const match = line.match(transcriptLine)
    if (match) {
      const marker = match[1]
      const content = match[2] ?? ''
      currentType = marker === '<<<' ? 'output' : marker === '>>>' ? 'input' : 'system'

      if (currentType === 'output') {
        restored.push(content)
      } else if (currentType === 'input') {
        restored.push(content ? `> ${content}` : '>')
      }
      continue
    }

    if (currentType === 'output') {
      restored.push(line)
    } else if (currentType === 'input') {
      restored.push(line ? `  ${line}` : '')
    }
  }

  return restored.join('\n').trimEnd()
}

function OptionsModal({
  locale,
  appearance,
  sessionNotificationsEnabled,
  onClose,
  onSave,
}: {
  locale: Locale
  appearance: AppearanceSettings
  sessionNotificationsEnabled: boolean
  onClose: () => void
  onSave: (
    locale: Locale,
    appearance: AppearanceSettings,
    sessionNotificationsEnabled: boolean
  ) => void
}) {
  const { t } = useI18n()
  const [selectedLocale, setSelectedLocale] = useState<Locale>(locale)
  const [draftAppearance, setDraftAppearance] = useState<AppearanceSettings>(appearance)
  const [draftSessionNotificationsEnabled, setDraftSessionNotificationsEnabled] = useState(sessionNotificationsEnabled)
  const languageRef = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    languageRef.current?.focus()
  }, [])

  const setBackgroundMode = (backgroundMode: BackgroundMode) => {
    setDraftAppearance((prev) => ({ ...prev, backgroundMode }))
  }

  const setCustomImagePath = (customImagePath: string) => {
    setDraftAppearance((prev) => ({ ...prev, customImagePath }))
  }

  const pickImage = async () => {
    const picked = await window.easyAgentCenter.pickImageFile(draftAppearance.customImagePath || undefined)
    if (!picked) return
    setDraftAppearance({ backgroundMode: 'image', customImagePath: picked })
  }

  const handleImageDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    const filePath = getDroppedFilePath(event)
    if (!filePath) return
    setDraftAppearance({ backgroundMode: 'image', customImagePath: filePath })
  }

  const backgroundModes: BackgroundMode[] = ['dark', 'white', 'paper', 'image']

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal options-modal" onClick={(event) => event.stopPropagation()}>
        <h2>{t('options.title')}</h2>

        <div className="options-section">
          <label className="options-label" htmlFor="options-language">
            {t('options.language')}
          </label>
          <select
            id="options-language"
            ref={languageRef}
            className="options-select"
            value={selectedLocale}
            onChange={(event) => setSelectedLocale(event.target.value as Locale)}
          >
            {localeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="options-section">
          <div className="options-label">{t('options.background')}</div>
          <div className="appearance-choice-grid">
            {backgroundModes.map((mode) => (
              <button
                key={mode}
                type="button"
                className={`appearance-choice appearance-choice-${mode} ${draftAppearance.backgroundMode === mode ? 'active' : ''}`}
                onClick={() => setBackgroundMode(mode)}
              >
                <span className="appearance-swatch" />
                <span>{t(`options.background.${mode}`)}</span>
              </button>
            ))}
          </div>
        </div>

        <div
          className={`options-section image-path-section ${draftAppearance.backgroundMode === 'image' ? 'active' : ''}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleImageDrop}
        >
          <label className="options-label" htmlFor="options-image-path">
            {t('options.imagePath')}
          </label>
          <div className="image-path-row">
            <input
              id="options-image-path"
              type="text"
              value={draftAppearance.customImagePath}
              onChange={(event) => {
                setCustomImagePath(event.target.value)
                setBackgroundMode('image')
              }}
              placeholder={t('options.imagePathPlaceholder')}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={pickImage}>
              {t('options.pickImage')}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDraftAppearance({ backgroundMode: 'paper', customImagePath: '' })}
            >
              {t('options.clearImage')}
            </button>
          </div>
        </div>

        <div className="options-section">
          <div className="options-label">{t('options.notifications')}</div>
          <label className="options-check-row">
            <input
              type="checkbox"
              checked={draftSessionNotificationsEnabled}
              onChange={(event) => setDraftSessionNotificationsEnabled(event.target.checked)}
            />
            <span>
              <strong>{t('options.sessionNotifications')}</strong>
              <small>{t('options.sessionNotificationsHint')}</small>
            </span>
          </label>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            {t('modal.cancel')}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => onSave(
              selectedLocale,
              draftAppearance,
              draftSessionNotificationsEnabled
            )}
          >
            {t('options.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateSessionModal({
  agents,
  initialAgentId,
  defaultCwd,
  onClose,
  onCreate,
}: {
  agents: Record<string, AgentInstall | null>
  initialAgentId: string
  defaultCwd: string
  onClose: () => void
  onCreate: (config: SessionConfig) => void
}) {
  const { t } = useI18n()
  const [agentId, setAgentId] = useState(initialAgentId)
  const [command, setCommand] = useState(commandForAgent(initialAgentId, agents[initialAgentId]))
  const [cwd, setCwd] = useState(defaultCwd)
  const [prompt, setPrompt] = useState('')
  const [commandDropActive, setCommandDropActive] = useState(false)
  const commandInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setCommand(commandForAgent(agentId, agents[agentId]))
  }, [agentId, agents])

  useEffect(() => {
    commandInputRef.current?.focus()
  }, [])

  const handleCreate = () => {
    if (!cwd.trim() || !command.trim()) return
    onCreate({ agentId, command: command.trim(), cwd: cwd.trim(), prompt: prompt.trim() || undefined })
  }

  // Open native OS directory picker; keep manual input intact when user cancels.
  const handleBrowse = async () => {
    const picked = await window.easyAgentCenter.pickDirectory(cwd)
    if (picked) setCwd(picked)
  }

  const handleCommandDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setCommandDropActive(false)
    const filePath = getDroppedFilePath(event)
    if (!filePath) return
    const resolved = await window.easyAgentCenter.resolveCommandFile(filePath)
    setCommand(resolved.launchCommand)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('modal.newSession')}</h2>

        <div className="form-group">
          <label>{t('modal.agent')}</label>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            {Object.entries(agents)
              .filter(([id]) => !HIDDEN_AGENT_IDS.has(id))
              .map(([id, info]) => (
              <option key={id} value={id} disabled={id !== 'generic' && !info?.found}>
                {agentDisplayName(id, info, t)} {id !== 'generic' && !info?.found ? t('modal.notFound') : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>{t('modal.command')}</label>
          <div
            className={`drop-input ${commandDropActive ? 'drag-over' : ''}`}
            onDragOver={(event) => {
              event.preventDefault()
              setCommandDropActive(true)
            }}
            onDragLeave={() => setCommandDropActive(false)}
            onDrop={handleCommandDrop}
          >
            <input
              ref={commandInputRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder={t('modal.command.ph')}
            />
            <div className="drop-hint">{t('modal.command.dropHint')}</div>
          </div>
        </div>

        <div className="form-group">
          <label>{t('modal.cwd')}</label>
          <div className="cwd-input-group">
            <input
              type="text"
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              placeholder={t('modal.cwd.ph')}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleBrowse}
            >
              {t('modal.browse')}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>{t('modal.prompt')}</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('modal.prompt.ph')}
            rows={3}
          />
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            {t('modal.cancel')}
          </button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={!cwd.trim() || !command.trim()}>
            {t('modal.create')}
          </button>
        </div>
      </div>
    </div>
  )
}

function AgentListModal({
  agents,
  customAgents,
  hiddenAgentIds,
  onClose,
  onSave,
}: {
  agents: Record<string, AgentInstall | null>
  customAgents: CustomAgent[]
  hiddenAgentIds: Set<string>
  onClose: () => void
  onSave: (agents: CustomAgent[], hiddenAgentIds: Set<string>) => void
}) {
  const { t } = useI18n()
  const [customRows, setCustomRows] = useState<CustomAgent[]>(customAgents)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set(hiddenAgentIds))
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [shortcutPath, setShortcutPath] = useState('')
  const [shortcutCommand, setShortcutCommand] = useState('')
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameInputRef.current?.focus()
  }, [])

  const builtInAgents = useMemo(() => {
    return Object.entries(agents)
      .filter(([id, info]) => !HIDDEN_AGENT_IDS.has(id) && !info?.custom)
      .sort(([aId, aInfo], [bId, bInfo]) => {
        const aFound = Number(Boolean(aInfo?.found))
        const bFound = Number(Boolean(bInfo?.found))
        if (aFound !== bFound) return bFound - aFound
        return agentDisplayName(aId, aInfo, t).localeCompare(agentDisplayName(bId, bInfo, t))
      })
  }, [agents, t])

  const setAgentVisible = (id: string, visible: boolean) => {
    setHiddenIds((prev) => {
      const next = new Set(prev)
      if (visible) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const updateAgent = (id: string, patch: Partial<CustomAgent>) => {
    setCustomRows((prev) => prev.map((agent) => (agent.id === id ? { ...agent, ...patch } : agent)))
  }

  const deleteAgent = (agent: CustomAgent) => {
    if (!window.confirm(t('customAgent.deleteConfirm', { agent: agent.displayName.trim() || agent.id }))) return
    const id = agent.id
    setCustomRows((prev) => prev.filter((agent) => agent.id !== id))
    setAgentVisible(id, true)
  }

  const resolveShortcut = async (path: string): Promise<ResolvedCommandFile | null> => {
    const trimmed = path.trim()
    if (!trimmed) return null
    return window.easyAgentCenter.resolveCommandFile(trimmed)
  }

  const prepareCustomAgent = async (agent: CustomAgent): Promise<CustomAgent | null> => {
    const displayName = agent.displayName.trim()
    const launchCommand = agent.command.trim()
    const savedShortcutPath = agent.shortcutPath?.trim() ?? ''
    const resolved = savedShortcutPath ? await resolveShortcut(savedShortcutPath) : null
    const savedShortcutCommand = resolved?.launchCommand.trim() || agent.shortcutCommand?.trim() || ''
    if (!displayName || (!launchCommand && !savedShortcutPath && !savedShortcutCommand)) return null

    return {
      id: agent.id,
      displayName,
      command: launchCommand,
      ...(savedShortcutPath ? { shortcutPath: savedShortcutPath } : {}),
      ...(savedShortcutCommand ? { shortcutCommand: savedShortcutCommand } : {}),
    }
  }

  const addAgent = async () => {
    const resolved = shortcutPath.trim() ? await resolveShortcut(shortcutPath) : null
    const displayName = name.trim() || resolved?.displayName || ''
    const launchCommand = command.trim()
    const savedShortcutPath = shortcutPath.trim()
    const savedShortcutCommand = resolved?.launchCommand.trim() || shortcutCommand.trim()

    if (!displayName || (!launchCommand && !savedShortcutPath && !savedShortcutCommand)) {
      setError(t('customAgent.invalid'))
      return
    }

    const id = createCustomAgentId()
    setCustomRows((prev) => [
      ...prev,
      {
        id,
        displayName,
        command: launchCommand,
        ...(savedShortcutPath ? { shortcutPath: savedShortcutPath } : {}),
        ...(savedShortcutCommand ? { shortcutCommand: savedShortcutCommand } : {}),
      },
    ])
    setAgentVisible(id, true)
    setName('')
    setCommand('')
    setShortcutPath('')
    setShortcutCommand('')
    setError('')
  }

  const applyNewShortcutDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDropTarget(null)
    const filePath = getDroppedFilePath(event)
    if (!filePath) return
    const resolved = await window.easyAgentCenter.resolveCommandFile(filePath)
    setShortcutPath(filePath)
    setShortcutCommand(resolved.launchCommand)
    if (!name.trim()) setName(resolved.displayName)
    setError('')
  }

  const applyAgentShortcutDrop = async (event: DragEvent<HTMLElement>, id: string) => {
    event.preventDefault()
    setDropTarget(null)
    const filePath = getDroppedFilePath(event)
    if (!filePath) return
    const resolved = await window.easyAgentCenter.resolveCommandFile(filePath)
    updateAgent(id, {
      shortcutPath: filePath,
      shortcutCommand: resolved.launchCommand,
    })
    setError('')
  }

  const save = async () => {
    setSaving(true)
    try {
      const cleaned: CustomAgent[] = []
      for (const agent of customRows) {
        const prepared = await prepareCustomAgent(agent)
        if (!prepared) {
          setSaving(false)
          setError(t('customAgent.invalid'))
          return
        }
        cleaned.push(prepared)
      }

      const savedIds = new Set([...builtInAgents.map(([id]) => id), ...cleaned.map((agent) => agent.id)])
      const nextHiddenIds = new Set([...hiddenIds].filter((id) => savedIds.has(id)))
      onSave(cleaned, nextHiddenIds)
      onClose()
    } catch (err) {
      setSaving(false)
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide custom-agent-modal agent-list-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('customAgent.title')}</h2>
        <p className="custom-agent-description">{t('customAgent.description')}</p>

        <div className="agent-list-section">
          <div className="agent-list-section-header">
            <h3>{t('customAgent.builtinTitle')}</h3>
          </div>
          <div className="agent-visibility-list">
            {builtInAgents.map(([id, info]) => (
              <label className="agent-visibility-row" key={id}>
                <input
                  type="checkbox"
                  checked={!hiddenIds.has(id)}
                  onChange={(event) => setAgentVisible(id, event.target.checked)}
                />
                <span
                  className="status-dot"
                  style={{ backgroundColor: info?.found ? '#4caf50' : '#666' }}
                />
                <span className="agent-visibility-name">{agentDisplayName(id, info, t)}</span>
                <span className={`agent-visibility-status ${info?.found ? 'found' : 'missing'}`}>
                  {info?.found ? t('customAgent.visibleReady') : t('agentUpdate.notFound')}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="agent-list-section">
          <div className="agent-list-section-header">
            <h3>{t('customAgent.customTitle')}</h3>
            <span>{t('customAgent.launchRule')}</span>
          </div>

        <div className="custom-agent-list">
          {customRows.length === 0 ? (
            <div className="empty-hint">{t('customAgent.empty')}</div>
          ) : (
            customRows.map((agent) => (
              <div className="custom-agent-row" key={agent.id}>
                <input
                  type="checkbox"
                  className="custom-agent-visible-check"
                  checked={!hiddenIds.has(agent.id)}
                  onChange={(event) => setAgentVisible(agent.id, event.target.checked)}
                  title={t('customAgent.visible')}
                />
                <input
                  type="text"
                  value={agent.displayName}
                  onChange={(event) => updateAgent(agent.id, { displayName: event.target.value })}
                  placeholder={t('customAgent.namePlaceholder')}
                />
                <input
                  type="text"
                  value={agent.command}
                  onChange={(event) => updateAgent(agent.id, { command: event.target.value })}
                  placeholder={t('customAgent.commandPlaceholder')}
                />
                <input
                  type="text"
                  className={dropTarget === agent.id ? 'drag-over' : ''}
                  value={agent.shortcutPath ?? ''}
                  onChange={(event) => updateAgent(agent.id, {
                    shortcutPath: event.target.value,
                    shortcutCommand: '',
                  })}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDropTarget(agent.id)
                  }}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(event) => applyAgentShortcutDrop(event, agent.id)}
                  placeholder={t('customAgent.shortcutPlaceholder')}
                />
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => deleteAgent(agent)}
                >
                  {t('customAgent.delete')}
                </button>
              </div>
            ))
          )}
        </div>
        </div>

        <div
          className={`custom-agent-add ${dropTarget === 'new' ? 'drag-over' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDropTarget('new')
          }}
          onDragLeave={() => setDropTarget(null)}
          onDrop={applyNewShortcutDrop}
        >
          <div className="custom-agent-add-grid">
            <div className="form-group">
              <label>{t('customAgent.name')}</label>
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('customAgent.namePlaceholder')}
              />
            </div>
            <div className="form-group">
              <label>{t('customAgent.command')}</label>
              <input
                type="text"
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder={t('customAgent.commandPlaceholder')}
              />
            </div>
            <div className="form-group">
              <label>{t('customAgent.shortcut')}</label>
              <input
                type="text"
                className={dropTarget === 'new' ? 'drag-over' : ''}
                value={shortcutPath}
                onChange={(event) => {
                  setShortcutPath(event.target.value)
                  setShortcutCommand('')
                }}
                placeholder={t('customAgent.shortcutPlaceholder')}
              />
              <div className="drop-hint">{t('customAgent.dropHint')}</div>
            </div>
          </div>
          {error && <div className="form-error">{error}</div>}
          <button type="button" className="btn btn-secondary" onClick={addAgent} disabled={saving}>
            {t('customAgent.add')}
          </button>
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            {t('modal.cancel')}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {t('customAgent.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface AgentUpdateRow {
  agentId: string
  displayName: string
  found: boolean
  path?: string
  installCommand: string
  updateCommand: string
  selected: boolean
  risk: string
  noteKey: string
}

type AgentPackageMode = 'update' | 'install'

function AgentUpdateModal({
  agents,
  defaultCwd,
  onClose,
  onUpdate,
}: {
  agents: Record<string, AgentInstall | null>
  defaultCwd: string
  onClose: () => void
  onUpdate: (config: SessionConfig) => Promise<SessionInfo | null>
}) {
  const { t } = useI18n()
  const [mode, setMode] = useState<AgentPackageMode>('update')
  const [rows, setRows] = useState<AgentUpdateRow[]>(() =>
    Object.entries(agents)
      .filter(([id]) => !HIDDEN_AGENT_IDS.has(id))
      .map(([agentId, info]) => {
        const spec = getAgentPackageSpec(agentId, info)
        return {
          agentId,
          displayName: spec.displayName,
          found: Boolean(info?.found),
          path: info?.path,
          installCommand: spec.installCommand,
          updateCommand: spec.updateCommand,
          selected: Boolean(info?.found && spec.updateCommand),
          risk: spec.risk,
          noteKey: spec.noteKey,
        }
      })
      .sort((a, b) => Number(b.found) - Number(a.found) || a.displayName.localeCompare(b.displayName))
  )
  const firstCommandInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstCommandInputRef.current?.focus()
  }, [])

  const commandKey = mode === 'update' ? 'updateCommand' : 'installCommand'
  const selectedCount = rows.filter((row) => row.selected && row[commandKey].trim()).length

  const updateRow = (agentId: string, patch: Partial<AgentUpdateRow>) => {
    setRows((prev) => prev.map((row) => (row.agentId === agentId ? { ...row, ...patch } : row)))
  }

  const switchMode = (nextMode: AgentPackageMode) => {
    setMode(nextMode)
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        selected: nextMode === 'update'
          ? Boolean(row.found && row.updateCommand.trim())
          : false,
      }))
    )
  }

  const selectSupported = () => {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        selected: Boolean(row.found && row.updateCommand.trim()),
      }))
    )
  }

  const clearSelection = () => {
    setRows((prev) => prev.map((row) => ({ ...row, selected: false })))
  }

  const updateCommand = (row: AgentUpdateRow, value: string) => {
    const selected = row.selected && Boolean(value.trim())
    if (mode === 'update') {
      updateRow(row.agentId, { updateCommand: value, selected })
    } else {
      updateRow(row.agentId, { installCommand: value, selected })
    }
  }

  const handleRun = async () => {
    const selectedRows = rows.filter((row) => row.selected && row[commandKey].trim())
    for (const row of selectedRows) {
      await onUpdate({
        agentId: row.agentId,
        command: row[commandKey].trim(),
        cwd: defaultCwd,
        prompt: undefined,
      })
    }
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide agent-update-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('agentUpdate.title')}</h2>
        <p className="agent-update-warning">{t('agentUpdate.warning')}</p>

        <div className="agent-update-tabs">
          <button
            type="button"
            className={`agent-update-mode-btn ${mode === 'update' ? 'active' : ''}`}
            onClick={() => switchMode('update')}
          >
            {t('agentUpdate.mode.update')}
          </button>
          <button
            type="button"
            className={`agent-update-mode-btn ${mode === 'install' ? 'active' : ''}`}
            onClick={() => switchMode('install')}
          >
            {t('agentUpdate.mode.install')}
          </button>
        </div>

        <div className="agent-update-toolbar">
          {mode === 'update' && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={selectSupported}>
              {t('agentUpdate.selectFound')}
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={clearSelection}>
            {t('agentUpdate.clear')}
          </button>
          {mode === 'install' && (
            <span className="agent-update-install-note">{t('agentUpdate.installNoSelectAll')}</span>
          )}
        </div>

        <div className="agent-update-list">
          {rows.map((row, index) => (
            <div className="agent-update-row" key={row.agentId}>
              <label className="agent-update-check">
                <input
                  type="checkbox"
                  checked={row.selected}
                  disabled={!row[commandKey].trim()}
                  onChange={(event) => updateRow(row.agentId, { selected: event.target.checked })}
                />
                <span className="agent-update-name">{row.displayName}</span>
                <span className={`agent-update-found ${row.found ? 'found' : 'missing'}`}>
                  {row.found ? t('agentUpdate.found') : t('agentUpdate.notFound')}
                </span>
              </label>
              <input
                ref={index === 0 ? firstCommandInputRef : undefined}
                type="text"
                className="agent-update-command"
                value={row[commandKey]}
                onChange={(event) => updateCommand(row, event.target.value)}
                placeholder={mode === 'update'
                  ? t('agentUpdate.updateCommandPlaceholder')
                  : t('agentUpdate.installCommandPlaceholder')}
              />
              <div className="agent-update-note">
                <span className={`agent-update-risk risk-${row.risk}`}>
                  {t(`agentUpdate.risk.${row.risk}`)}
                </span>
                <span>{t(row.noteKey)}</span>
                {row.path && <span className="agent-update-path">{row.path}</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            {t('modal.cancel')}
          </button>
          <button className="btn btn-primary" onClick={handleRun} disabled={selectedCount === 0}>
            {mode === 'update'
              ? t('agentUpdate.startUpdate', { count: selectedCount })
              : t('agentUpdate.startInstall', { count: selectedCount })}
          </button>
        </div>
      </div>
    </div>
  )
}

