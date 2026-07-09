import { useCallback, useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import type { CSSProperties } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useI18n } from '../i18n'
import type { SessionInfo, SessionEvent } from '../types'

interface Props {
  session: SessionInfo | null
  agentName: string
  output: string
  onSendInput: (data: string) => void
  onResize: (cols: number, rows: number) => void
  allowAutoFocus: boolean
  terminalBackgroundColor: string
}

function appendRenderedOutput(previous: string, chunk: string): string {
  const next = previous + chunk
  const maxLength = 240000
  return next.length > maxLength ? next.slice(next.length - maxLength) : next
}

function normalizeTerminalBackgroundColor(value: string): string {
  const trimmed = value.trim()
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed : '#000000'
}

function isLightHexColor(value: string): boolean {
  const color = normalizeTerminalBackgroundColor(value).slice(1)
  const red = parseInt(color.slice(0, 2), 16)
  const green = parseInt(color.slice(2, 4), 16)
  const blue = parseInt(color.slice(4, 6), 16)
  return (red * 299 + green * 587 + blue * 114) / 1000 > 150
}

function getTerminalTheme(backgroundColor: string) {
  const background = normalizeTerminalBackgroundColor(backgroundColor)
  const light = isLightHexColor(background)

  return {
    background,
    foreground: light ? '#242424' : '#d4d4d4',
    cursor: light ? '#242424' : '#d4d4d4',
    selectionBackground: light ? '#c9d7ef' : '#3a3a3a',
    selectionForeground: light ? '#111111' : undefined,
  }
}

function isScrolledToBottom(terminal: Terminal): boolean {
  const buffer = terminal.buffer.active
  return buffer.viewportY >= buffer.baseY
}

export default function TerminalPane({
  session,
  agentName,
  output,
  onSendInput,
  onResize,
  allowAutoFocus,
  terminalBackgroundColor,
}: Props) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const renderedSessionIdRef = useRef<string | null>(null)
  const renderedOutputRef = useRef('')
  const onSendInputRef = useRef(onSendInput)
  const onResizeRef = useRef(onResize)
  const allowAutoFocusRef = useRef(false)
  const suppressPasteUntilRef = useRef(0)
  const lastResizeRef = useRef<{ sessionId: string; cols: number; rows: number } | null>(null)
  const fitFrameRef = useRef<number | null>(null)
  const terminalBackgroundColorRef = useRef(terminalBackgroundColor)

  useEffect(() => {
    onSendInputRef.current = onSendInput
  }, [onSendInput])

  useEffect(() => {
    onResizeRef.current = onResize
  }, [onResize])

  useEffect(() => {
    allowAutoFocusRef.current = allowAutoFocus
  }, [allowAutoFocus])

  useEffect(() => {
    terminalBackgroundColorRef.current = terminalBackgroundColor
    if (terminalRef.current) {
      terminalRef.current.options.theme = getTerminalTheme(terminalBackgroundColor)
    }
  }, [terminalBackgroundColor])

  const canFocusTerminal = useCallback(() => {
    const container = containerRef.current
    const activeElement = document.activeElement
    if (!allowAutoFocusRef.current || !sessionIdRef.current || !container) return false
    if (document.querySelector('.modal-overlay')) return false
    if (!activeElement || container.contains(activeElement)) return true

    const tagName = activeElement.tagName.toLowerCase()
    if (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      activeElement.getAttribute('contenteditable') === 'true'
    ) {
      return false
    }

    return true
  }, [])

  const fitTerminal = useCallback(() => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    if (!terminal || !fitAddon) return

    fitAddon.fit()
    const sessionId = sessionIdRef.current
    const lastResize = lastResizeRef.current
    if (
      sessionId &&
      terminal.cols > 0 &&
      terminal.rows > 0 &&
      (
        !lastResize ||
        lastResize.sessionId !== sessionId ||
        lastResize.cols !== terminal.cols ||
        lastResize.rows !== terminal.rows
      )
    ) {
      lastResizeRef.current = { sessionId, cols: terminal.cols, rows: terminal.rows }
      onResizeRef.current(terminal.cols, terminal.rows)
    }
  }, [])

  const scheduleFitTerminal = useCallback(() => {
    if (fitFrameRef.current !== null) {
      window.cancelAnimationFrame(fitFrameRef.current)
    }

    fitFrameRef.current = window.requestAnimationFrame(() => {
      fitFrameRef.current = null
      fitTerminal()
    })
  }, [fitTerminal])

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const isWindows = /windows/i.test(navigator.userAgent)
    const terminal = new Terminal({
      fontSize: 15,
      lineHeight: 1.18,
      letterSpacing: 0,
      fontWeight: 'normal',
      fontWeightBold: 'bold',
      fontFamily: '"Cascadia Mono", Consolas, "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans Mono CJK SC", "Courier New", monospace',
      theme: getTerminalTheme(terminalBackgroundColorRef.current),
      cursorBlink: true,
      convertEol: false,
      scrollback: 10000,
      rightClickSelectsWord: false,
      windowsPty: isWindows ? { backend: 'conpty' } : undefined,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(container)
    requestAnimationFrame(() => {
      scheduleFitTerminal()
      if (canFocusTerminal()) {
        terminal.focus()
      }
    })

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    const copySelection = () => {
      const selection = terminal.getSelection()
      if (!selection) return false
      window.easyAgentCenter.writeClipboardText(selection)
      return true
    }

    const pasteClipboard = () => {
      const text = window.easyAgentCenter.readClipboardText()
      if (text && sessionIdRef.current) {
        suppressPasteUntilRef.current = performance.now() + 300
        terminal.paste(text)
      }
    }

    terminal.attachCustomKeyEventHandler((event) => {
      const key = event.key.toLowerCase()
      const modifier = event.ctrlKey || event.metaKey

      if (modifier && key === 'c' && (event.shiftKey || terminal.hasSelection())) {
        copySelection()
        return false
      }

      if (modifier && key === 'v') {
        pasteClipboard()
        return false
      }

      return true
    })

    terminal.onData((data) => {
      if (sessionIdRef.current) {
        onSendInputRef.current(data)
      }
    })

    const focusTerminal = () => {
      if (canFocusTerminal()) {
        terminal.focus()
      }
    }
    const handlePaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain')
      if (!text || !sessionIdRef.current) return
      event.preventDefault()
      event.stopPropagation()
      if (performance.now() < suppressPasteUntilRef.current) return
      terminal.paste(text)
    }
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()
      copySelection()
    }

    container.addEventListener('mousedown', focusTerminal)
    container.addEventListener('paste', handlePaste, true)
    container.addEventListener('contextmenu', handleContextMenu)

    return () => {
      container.removeEventListener('mousedown', focusTerminal)
      container.removeEventListener('paste', handlePaste, true)
      container.removeEventListener('contextmenu', handleContextMenu)
      if (fitFrameRef.current !== null) {
        window.cancelAnimationFrame(fitFrameRef.current)
        fitFrameRef.current = null
      }
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [scheduleFitTerminal])

  useEffect(() => {
    const terminal = terminalRef.current

    if (!session) {
      sessionIdRef.current = null
      renderedSessionIdRef.current = null
      renderedOutputRef.current = ''
      if (terminal) {
        terminal.reset()
        terminal.writeln(`\x1b[90m${t('terminal.noSession')}\x1b[0m`)
      }
      return
    }

    sessionIdRef.current = session.id
    const sessionChanged = renderedSessionIdRef.current !== session.id
    if (sessionChanged) {
      lastResizeRef.current = null
    }
    const shouldRenderSnapshot = sessionChanged ||
      (session.status !== 'running' && !renderedOutputRef.current && Boolean(output))

    if (terminal && shouldRenderSnapshot && (sessionChanged || renderedOutputRef.current !== output)) {
      if (sessionChanged) {
        terminal.reset()
      } else {
        terminal.clear()
      }
      if (output) {
        terminal.write(output)
      } else if (session.status !== 'running') {
        terminal.writeln(`\x1b[90m${t('terminal.sessionClosed')}\x1b[0m`)
      }
      renderedSessionIdRef.current = session.id
      renderedOutputRef.current = output
      requestAnimationFrame(() => {
        scheduleFitTerminal()
        terminal.scrollToBottom()
        if (canFocusTerminal()) {
          terminal.focus()
        }
      })
    }
  }, [scheduleFitTerminal, output, session?.id, session?.status, t])

  useEffect(() => {
    if (!session) return

    const unsubscribe = window.easyAgentCenter.onSessionEvent((event: SessionEvent) => {
      if (event.sessionId !== session.id) return

      if (event.type === 'data' && event.data && terminalRef.current) {
        const terminal = terminalRef.current
        const shouldFollowOutput = isScrolledToBottom(terminal)
        terminal.write(event.data, () => {
          if (shouldFollowOutput) {
            terminal.scrollToBottom()
          }
        })
        renderedOutputRef.current = appendRenderedOutput(renderedOutputRef.current, event.data)
      }

      if (event.type === 'exit' && terminalRef.current) {
        const msg = t('terminal.exited', { code: event.code ?? '?' })
        terminalRef.current.writeln('')
        terminalRef.current.writeln(
          `\r\n\x1b[${event.code === 0 ? '32' : '31'}m${msg}\x1b[0m`
        )
      }
    })

    return unsubscribe
  }, [session?.id, t])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !fitAddonRef.current) return

    const observer = new ResizeObserver(() => {
      scheduleFitTerminal()
    })
    observer.observe(container)

    return () => observer.disconnect()
  }, [scheduleFitTerminal])

  return (
    <div
      className="terminal-pane"
      style={{ '--terminal-bg': normalizeTerminalBackgroundColor(terminalBackgroundColor) } as CSSProperties}
    >
      <div className="terminal-header">
        {session ? (
          <>
            <span
              className="status-dot"
              style={{ backgroundColor: session.status === 'running' ? '#d6a241' : '#888' }}
            />
            <span className="terminal-title">{agentName} - {session.cwd}</span>
          </>
        ) : (
          <span className="terminal-placeholder">{t('terminal.selectHint')}</span>
        )}
      </div>
      <div ref={containerRef} className="terminal-container" />
    </div>
  )
}

