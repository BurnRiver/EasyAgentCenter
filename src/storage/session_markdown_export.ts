import type { SessionInfo } from '../types'

interface TranscriptBlock {
  timestamp: string
  kind: 'input' | 'output' | 'system'
  content: string
}

const LOG_PREFIX = /^\[([^\]]+)\]\s+(>>>|<<<|---)\s?(.*)$/

function projectLabel(cwd: string): string {
  return cwd.split(/[/\\]/).filter(Boolean).pop() || cwd
}

function sessionTitle(session: SessionInfo): string {
  return session.title?.trim() || `${session.agentId} - ${projectLabel(session.cwd)}`
}

function yamlString(value: string | number | undefined): string {
  return JSON.stringify(String(value ?? '').replace(/\r?\n/g, ' '))
}

function tableValue(value: string | number | undefined): string {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim()
}

function sanitizeFilePart(value: string): string {
  const sanitized = value
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return (sanitized || 'session').slice(0, 80).replace(/[. ]+$/g, '') || 'session'
}

function parseTranscriptLog(log: string): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = []
  let current: TranscriptBlock | null = null

  const pushCurrent = () => {
    if (!current) return
    const content = current.content.trimEnd()
    if (content || current.kind === 'system') {
      blocks.push({ ...current, content })
    }
    current = null
  }

  for (const line of log.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')) {
    const match = line.match(LOG_PREFIX)
    if (match) {
      pushCurrent()
      const marker = match[2]
      current = {
        timestamp: match[1],
        kind: marker === '>>>' ? 'input' : marker === '<<<' ? 'output' : 'system',
        content: match[3] ?? '',
      }
      continue
    }

    if (current) {
      current.content += `${current.content ? '\n' : ''}${line}`
    }
  }

  pushCurrent()
  return blocks
}

function blockTitle(kind: TranscriptBlock['kind']): string {
  if (kind === 'input') return 'User'
  if (kind === 'output') return 'Agent Output'
  return 'System'
}

function fencedBlock(content: string): string {
  const fence = content.includes('```') ? '````' : '```'
  return `${fence}text\n${content || '(empty)'}\n${fence}`
}

export function defaultMarkdownFileName(session: SessionInfo): string {
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${sanitizeFilePart(sessionTitle(session))}-${date}.md`
}

export function buildSessionMarkdown(session: SessionInfo, transcriptLog: string): string {
  const title = sessionTitle(session)
  const exportedAt = new Date().toISOString()
  const createdAt = new Date(session.createdAt).toISOString()
  const args = session.args?.join(' ') ?? ''
  const command = [session.command, args].filter(Boolean).join(' ')
  const blocks = parseTranscriptLog(transcriptLog)
  const lines: string[] = [
    '---',
    `title: ${yamlString(title)}`,
    `agentId: ${yamlString(session.agentId)}`,
    `command: ${yamlString(command)}`,
    `cwd: ${yamlString(session.cwd)}`,
    `sessionId: ${yamlString(session.id)}`,
    `status: ${yamlString(session.status)}`,
    `createdAt: ${yamlString(createdAt)}`,
    `exportedAt: ${yamlString(exportedAt)}`,
    '---',
    '',
    `# ${title}`,
    '',
    '## Session',
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Agent | ${tableValue(session.agentId)} |`,
    `| Command | ${tableValue(command)} |`,
    `| Working Directory | ${tableValue(session.cwd)} |`,
    `| Session ID | ${tableValue(session.id)} |`,
    `| Status | ${tableValue(session.status)} |`,
    `| Created | ${tableValue(createdAt)} |`,
    `| Exported | ${tableValue(exportedAt)} |`,
    '',
    '## Transcript',
    '',
  ]

  if (blocks.length === 0) {
    lines.push('_No transcript log was found for this session._', '')
    return lines.join('\n')
  }

  for (const block of blocks) {
    lines.push(`### ${blockTitle(block.kind)} - ${block.timestamp}`, '', fencedBlock(block.content), '')
  }

  return lines.join('\n')
}
