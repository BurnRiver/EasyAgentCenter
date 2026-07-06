import { useI18n } from '../i18n'
import type { ProjectEditor, SessionInfo } from '../types'

interface Props {
  session: SessionInfo | null
  agentName: string
  onOpenProjectDirectory: (cwd: string) => void
  onCopyProjectPath: (cwd: string) => void
  onOpenProjectEditor: (editor: ProjectEditor, cwd: string) => void
  onOpenCCSwitch: () => void
}

const statusKeyMap: Record<string, string> = {
  idle: 'status.idle',
  running: 'status.running',
  done: 'status.done',
  failed: 'status.failed',
  closed: 'status.closed',
}

const statusColor: Record<string, string> = {
  idle: '#888',
  running: '#d6a241',
  done: '#4caf50',
  failed: '#f44336',
  closed: '#888',
}

export default function TaskDetailPanel({
  session,
  agentName,
  onOpenProjectDirectory,
  onCopyProjectPath,
  onOpenProjectEditor,
  onOpenCCSwitch,
}: Props) {
  const { t } = useI18n()

  if (!session) {
    return (
      <div className="detail-panel">
        <h3>{t('detail.title')}</h3>
        <div className="empty-hint">{t('detail.empty')}</div>
      </div>
    )
  }

  return (
    <div className="detail-panel">
      <h3>{t('detail.title')}</h3>
      <div className="detail-rows">
        <div className="detail-row">
          <span className="detail-label">{t('detail.agent')}</span>
          <span className="detail-value">{agentName}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">{t('detail.status')}</span>
          <span className="detail-value">
            <span className="status-dot" style={{ backgroundColor: statusColor[session.status] }} />
            {t(statusKeyMap[session.status])}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">{t('detail.command')}</span>
          <span className="detail-value mono">{session.command}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">{t('detail.cwd')}</span>
          <span className="detail-value mono">{session.cwd}</span>
        </div>
        <div className="detail-project-actions">
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={() => onOpenProjectDirectory(session.cwd)}
            title={t('projectAction.openFolder')}
          >
            {t('projectAction.openFolder')}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={() => onCopyProjectPath(session.cwd)}
            title={t('projectAction.copyPath')}
          >
            {t('projectAction.copyPath')}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={() => onOpenProjectEditor('vscode', session.cwd)}
            title={t('projectAction.openVSCode')}
          >
            VS Code
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={() => onOpenProjectEditor('cursor', session.cwd)}
            title={t('projectAction.openCursor')}
          >
            Cursor
          </button>
        </div>
        {session.agentId === 'claude' && (
          <div className="detail-agent-actions">
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={onOpenCCSwitch}
              title={t('projectAction.openCCSwitch')}
            >
              {t('projectAction.openCCSwitch')}
            </button>
          </div>
        )}
        <div className="detail-row">
          <span className="detail-label">{t('detail.sessionId')}</span>
          <span className="detail-value mono">{session.id}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">{t('detail.created')}</span>
          <span className="detail-value">{new Date(session.createdAt).toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}

