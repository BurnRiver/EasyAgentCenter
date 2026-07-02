import { useMemo } from 'react'
import { useI18n } from '../i18n'
import type { SessionInfo } from '../types'

interface Props {
  session: SessionInfo | null
  output: string
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  onRefresh: () => void
}

interface QuotaMetric {
  remainingPercent?: number
  resetText?: string
  rawLine?: string
}

interface ParsedQuota {
  fiveHour: QuotaMetric
  weekly: QuotaMetric
  summaryLines: string[]
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function parseNumber(value: string): number {
  return Number(value.replace(/,/g, ''))
}

function parseResetText(line: string): string | undefined {
  const resetMatch = line.match(/\breset(?:s)?\b\s*(?:at|in|on)?\s*[:\-]?\s*(.+)$/i)
  if (resetMatch?.[1]) return resetMatch[1].trim()

  const zhResetMatch = line.match(/重置\s*[:：]?\s*(.+)$/)
  if (zhResetMatch?.[1]) return zhResetMatch[1].trim()

  return undefined
}

function parseRemainingPercent(line: string): number | undefined {
  const percentMatches = Array.from(line.matchAll(/(\d+(?:\.\d+)?)\s*%/g))
  if (percentMatches.length > 0) {
    const percent = clampPercent(Number(percentMatches[0][1]))
    if (/remain|remaining|left|available|剩余|可用/i.test(line)) return percent
    if (/used|usage|consumed|已用|使用/i.test(line)) return clampPercent(100 - percent)
    return percent
  }

  const fractionMatch = line.match(/([\d,.]+)\s*\/\s*([\d,.]+)/)
  if (fractionMatch) {
    const first = parseNumber(fractionMatch[1])
    const second = parseNumber(fractionMatch[2])
    if (second > 0) {
      const ratio = clampPercent((first / second) * 100)
      if (/remain|remaining|left|available|剩余|可用/i.test(line)) return ratio
      return clampPercent(100 - ratio)
    }
  }

  return undefined
}

function parseQuotaMetric(lines: string[], scope: 'fiveHour' | 'weekly'): QuotaMetric {
  const scopePattern = scope === 'fiveHour'
    ? /(5\s*(?:h|hr|hour|hours)|five\s*hour|5小时|五小时|rolling)/i
    : /(week|weekly|7\s*(?:d|day|days)|周|本周|weekly)/i
  const relevant = lines.filter((line) => scopePattern.test(line))
  const metric: QuotaMetric = {}

  for (const line of relevant) {
    const remainingPercent = parseRemainingPercent(line)
    const resetText = parseResetText(line)

    if (remainingPercent !== undefined) {
      metric.remainingPercent = remainingPercent
      metric.rawLine = line
    }
    if (resetText) {
      metric.resetText = resetText
      metric.rawLine = metric.rawLine ?? line
    }
  }

  return metric
}

function findLastLineIndex(lines: string[], pattern: RegExp): number {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (pattern.test(lines[index])) return index
  }
  return -1
}

function getLatestStatusLines(lines: string[]): string[] {
  const codexStart = findLastLineIndex(lines, /OpenAI\s+Codex/i)
  const commandStart = findLastLineIndex(lines, /^\/status\b/i)
  const statusStart = Math.max(codexStart, commandStart)
  return statusStart >= 0 ? lines.slice(statusStart) : lines
}

function getPrimaryQuotaLines(lines: string[]): string[] {
  const statusLines = getLatestStatusLines(lines)
  const firstQuotaIndex = statusLines.findIndex((line) =>
    /(5\s*h|5\s*hour|weekly|week)\s+limit/i.test(line)
  )
  if (firstQuotaIndex < 0) return statusLines

  const quotaLines = statusLines.slice(firstQuotaIndex)
  const nextModelLimitIndex = quotaLines.findIndex((line, index) =>
    index > 0 && /\b(?:gpt|codex|spark|model).*\blimit\s*:/i.test(line)
  )

  return nextModelLimitIndex > 0 ? quotaLines.slice(0, nextModelLimitIndex) : quotaLines
}

function normalizeOutput(output: string): string[] {
  return output
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/[│┃┆┊║]/g, ' ')
    .replace(/[─━═]/g, '-')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function parseCodexQuota(output: string): ParsedQuota {
  const lines = normalizeOutput(output)
  const primaryQuotaLines = getPrimaryQuotaLines(lines)
  const summaryLines = primaryQuotaLines
    .filter((line) => /(usage|limit|rate|reset|token|context|5\s*h|5\s*hour|week|weekly|额度|用量|限制|重置|剩余|上下文)/i.test(line))
    .slice(0, 10)

  return {
    fiveHour: parseQuotaMetric(primaryQuotaLines, 'fiveHour'),
    weekly: parseQuotaMetric(primaryQuotaLines, 'weekly'),
    summaryLines,
  }
}

function formatPercent(value?: number): string {
  if (value === undefined) return '--'
  const rounded = Math.round(value)
  return `${rounded}%`
}

function quotaClass(value?: number): string {
  if (value === undefined) return 'unknown'
  if (value <= 10) return 'danger'
  if (value <= 25) return 'warn'
  return 'ok'
}

function QuotaMeter({ label, metric }: { label: string; metric: QuotaMetric }) {
  const percent = metric.remainingPercent
  const barWidth = percent === undefined ? 0 : clampPercent(percent)

  return (
    <div className={`quota-meter quota-meter-${quotaClass(percent)}`}>
      <div className="quota-meter-top">
        <span>{label}</span>
        <strong>{formatPercent(percent)}</strong>
      </div>
      <div className="quota-bar">
        <div className="quota-bar-fill" style={{ width: `${barWidth}%` }} />
      </div>
      {metric.resetText && (
        <div className="quota-reset">{metric.resetText}</div>
      )}
    </div>
  )
}

export default function CodexQuotaPanel({
  session,
  output,
  enabled,
  onEnabledChange,
  onRefresh,
}: Props) {
  const { t } = useI18n()
  const parsed = useMemo(() => parseCodexQuota(output), [output])

  if (!session || session.agentId !== 'codex') return null

  return (
    <div className="quota-panel">
      <div className="quota-header">
        <h3>{t('quota.title')}</h3>
        <label className="quota-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          <span>{t('quota.enabled')}</span>
        </label>
      </div>

      {enabled && (
        <>
          <div className="quota-grid">
            <QuotaMeter label={t('quota.fiveHour')} metric={parsed.fiveHour} />
            <QuotaMeter label={t('quota.weekly')} metric={parsed.weekly} />
          </div>

          <button className="btn btn-secondary btn-xs quota-refresh" onClick={onRefresh}>
            {t('quota.refresh')}
          </button>

          <div className="quota-hint">{t('quota.hint')}</div>

          {parsed.summaryLines.length > 0 ? (
            <details className="quota-raw">
              <summary>{t('quota.parsedLines')}</summary>
              {parsed.summaryLines.map((line, index) => (
                <div key={`${line}-${index}`}>{line}</div>
              ))}
            </details>
          ) : (
            <div className="quota-empty">{t('quota.empty')}</div>
          )}
        </>
      )}
    </div>
  )
}

