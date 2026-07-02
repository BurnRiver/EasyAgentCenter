import { useCallback, useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
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
}

function appendRenderedOutput(previous: string, chunk: string): string {
  const next = previous + chunk
  const maxLength = 240000
  return next.length > maxLength ? next.slice(next.length - maxLength) : next
}

export default function TerminalPane({
  session,
  agentName,
  output,
  onSendInput,
  onResize,
  allowAutoFocus,
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
  const compositionTextRef = useRef('')
  const compositionStartedAtRef = useRef(0)
  const compositionDataRef = useRef('')
  const lastDataRef = useRef({ text: '', at: 0 })

  useEffect(() => {
    onSendInputRef.current = onSendInput
  }, [onSendInput])

  useEffect(() => {
    onResizeRef.current = onResize
  }, [onResize])

  useEffect(() => {
    allowAutoFocusRef.current = allowAutoFocus
  }, [allowAutoFocus])

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
    if (sessionIdRef.current && terminal.cols > 0 && terminal.rows > 0) {
      onResizeRef.current(terminal.cols, terminal.rows)
    }
  }, [])

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
      theme: {
        background: '#000000',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#3a3a3a',
      },
      cursorBlink: true,
      convertEol: false,
      scrollback: 10000,
      rightClickSelectsWord: true,
      windowsPty: isWindows ? { backend: 'conpty' } : undefined,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(container)
    requestAnimationFrame(() => {
      fitTerminal()
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
        onSendInputRef.current(text)
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
      const now = performance.now()
      lastDataRef.current = { text: data, at: now }
      if (compositionStartedAtRef.current > 0 && now >= compositionStartedAtRef.current) {
        compositionDataRef.current += data
      }
      if (sessionIdRef.current) {
        onSendInputRef.current(data)
      }
    })

    const textarea = container.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement | null
    const handleCompositionStart = () => {
      compositionTextRef.current = ''
      compositionDataRef.current = ''
      compositionStartedAtRef.current = performance.now()
    }
    const handleCompositionUpdate = (event: CompositionEvent) => {
      compositionTextRef.current = event.data
    }
    const handleCompositionEnd = (event: CompositionEvent) => {
      const text = event.data || compositionTextRef.current
      if (!text) return

      window.setTimeout(() => {
        const { text: lastText, at } = lastDataRef.current
        const sentByXterm = at >= compositionStartedAtRef.current &&
          (lastText.includes(text) || compositionDataRef.current.includes(text))
        if (!sentByXterm && sessionIdRef.current) {
          onSendInputRef.current(text)
        }
        compositionStartedAtRef.current = 0
        compositionDataRef.current = ''
      }, 120)
    }

    const focusTerminal = () => {
      if (canFocusTerminal()) {
        terminal.focus()
      }
    }
    const handlePaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain')
      if (!text || !sessionIdRef.current) return
      event.preventDefault()
      onSendInputRef.current(text)
    }
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()
      if (!copySelection()) {
        pasteClipboard()
      }
    }

    container.addEventListener('mousedown', focusTerminal)
    container.addEventListener('paste', handlePaste)
    container.addEventListener('contextmenu', handleContextMenu)
    textarea?.addEventListener('compositionstart', handleCompositionStart)
    textarea?.addEventListener('compositionupdate', handleCompositionUpdate)
    textarea?.addEventListener('compositionend', handleCompositionEnd)

    return () => {
      container.removeEventListener('mousedown', focusTerminal)
      container.removeEventListener('paste', handlePaste)
      container.removeEventListener('contextmenu', handleContextMenu)
      textarea?.removeEventListener('compositionstart', handleCompositionStart)
      textarea?.removeEventListener('compositionupdate', handleCompositionUpdate)
      textarea?.removeEventListener('compositionend', handleCompositionEnd)
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [fitTerminal])

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
      }
      renderedSessionIdRef.current = session.id
      renderedOutputRef.current = output
      requestAnimationFrame(() => {
        fitTerminal()
        terminal.scrollToBottom()
        if (canFocusTerminal()) {
          terminal.focus()
        }
      })
    }
  }, [fitTerminal, output, session?.id, session?.status, t])

  useEffect(() => {
    if (!session) return

    const unsubscribe = window.easyAgentCenter.onSessionEvent((event: SessionEvent) => {
      if (event.sessionId !== session.id) return

      if (event.type === 'data' && event.data && terminalRef.current) {
        terminalRef.current.write(event.data)
        renderedOutputRef.current = appendRenderedOutput(renderedOutputRef.current, event.data)
        terminalRef.current.scrollToBottom()
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
      requestAnimationFrame(fitTerminal)
    })
    observer.observe(container)

    return () => observer.disconnect()
  }, [fitTerminal])

  return (
    <div className="terminal-pane">
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

