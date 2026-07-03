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

interface UsageMetric {
  remainingPercent?: number
  resetText?: string
  rawLine?: string
}

interface ParsedKimiUsage {
  fiveHour: UsageMetric
  weekly: UsageMetric
  sevenDay: UsageMetric
  summaryLines: string[]
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function parseNumber(value: string): number {
  return Number(value.replace(/,/g, ''))
}

function normalizeOutput(output: string): string[] {
  return output
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-9;?<>]*[ -/]*[@-~]/g, '')
    .replace(/[│┃┆┊║]/g, ' ')
    .replace(/[─━═]/g, '-')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function findLastLineIndex(lines: string[], pattern: RegExp): number {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (pattern.test(lines[index])) return index
  }
  return -1
}

function getLatestUsageLines(lines: string[]): string[] {
  const usageStart = findLastLineIndex(lines, /^\/(?:usage|status)\b/i)
  const quotaStart = findLastLineIndex(lines, /(quota|usage|limit|用量|额度|限制)/i)
  const start = Math.max(usageStart, quotaStart)
  return start >= 0 ? lines.slice(start) : lines
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
    if (/used|usage|consumed|spent|已用|使用|消耗/i.test(line)) return clampPercent(100 - percent)
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

function parseUsageMetric(lines: string[], scope: 'fiveHour' | 'weekly' | 'sevenDay'): UsageMetric {
  const scopePattern = scope === 'fiveHour'
    ? /(5\s*(?:h|hr|hour|hours)|five\s*hour|5小时|五小时)/i
    : scope === 'sevenDay'
      ? /(7\s*(?:d|day|days)|seven\s*day|7天|七天)/i
      : /(week|weekly|本周|周)/i
  const metric: UsageMetric = {}

  for (const line of lines.filter((item) => scopePattern.test(item))) {
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

function parseKimiUsage(output: string): ParsedKimiUsage {
  const lines = normalizeOutput(output)
  const usageLines = getLatestUsageLines(lines)
  const summaryLines = usageLines
    .filter((line) => /(usage|quota|limit|rate|reset|token|5\s*h|5\s*hour|7\s*day|week|weekly|用量|额度|限制|重置|剩余|可用|令牌)/i.test(line))
    .slice(0, 12)

  return {
    fiveHour: parseUsageMetric(usageLines, 'fiveHour'),
    weekly: parseUsageMetric(usageLines, 'weekly'),
    sevenDay: parseUsageMetric(usageLines, 'sevenDay'),
    summaryLines,
  }
}

function formatPercent(value?: number): string {
  if (value === undefined) return '--'
  return `${Math.round(value)}%`
}

function quotaClass(value?: number): string {
  if (value === undefined) return 'unknown'
  if (value <= 10) return 'danger'
  if (value <= 25) return 'warn'
  return 'ok'
}

function UsageMeter({ label, metric }: { label: string; metric: UsageMetric }) {
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

export default function KimiUsagePanel({
  session,
  output,
  enabled,
  onEnabledChange,
  onRefresh,
}: Props) {
  const { t } = useI18n()
  const parsed = useMemo(() => parseKimiUsage(output), [output])

  if (!session || session.agentId !== 'kimi') return null

  return (
    <div className="quota-panel">
      <div className="quota-header">
        <h3>{t('kimiUsage.title')}</h3>
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
            <UsageMeter label={t('kimiUsage.fiveHour')} metric={parsed.fiveHour} />
            <UsageMeter label={t('kimiUsage.weekly')} metric={parsed.weekly} />
            <UsageMeter label={t('kimiUsage.sevenDay')} metric={parsed.sevenDay} />
          </div>

          <button className="btn btn-secondary btn-xs quota-refresh" onClick={onRefresh}>
            {t('kimiUsage.refresh')}
          </button>

          <div className="quota-hint">{t('kimiUsage.hint')}</div>

          {parsed.summaryLines.length > 0 ? (
            <details className="quota-raw">
              <summary>{t('quota.parsedLines')}</summary>
              {parsed.summaryLines.map((line, index) => (
                <div key={`${line}-${index}`}>{line}</div>
              ))}
            </details>
          ) : (
            <div className="quota-empty">{t('kimiUsage.empty')}</div>
          )}
        </>
      )}
    </div>
  )
}
