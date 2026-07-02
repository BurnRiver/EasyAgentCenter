import { useI18n } from '../i18n'
import type { SessionInfo } from '../types'

interface Props {
  session: SessionInfo | null
  agentName: string
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

export default function TaskDetailPanel({ session, agentName }: Props) {
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

