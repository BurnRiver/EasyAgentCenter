/**
 * Agent Specs -- pure technical reference for CLI coding agents.
 *
 * This file contains neutral agent capabilities stripped of project-specific
 * priorities, pricing, and launch patterns. EasyAgentCenter can use it to:
 *   - Build detection commands (where/which)
 *   - Decide launch mode (print vs interactive)
 *   - Resolve flags for auto-approve / headless / max-turns
 *   - Display agent help info in the UI
 *
 * Keep this file as a neutral reference for CLI detection and launch behavior.
 */

// --- CLI flags -----------------------------------------------------------

export interface AgentFlag {
  flag: string
  description: string
  /** e.g. 'print', 'interactive', 'both' */
  mode?: 'print' | 'interactive' | 'both'
}

// --- Launch mode info ----------------------------------------------------

export interface PrintMode {
  /** Template for one-shot non-interactive execution.
   *  Use {{prompt}} as placeholder for user input. */
  command: string
  /** Does this mode need --max-turns or equivalent? */
  supportsMaxTurns: boolean
  /** Can auto-approve all actions? (--yolo, --dangerously-skip-permissions, etc.) */
  supportsAutoApprove: boolean
  notes?: string
}

export interface InteractiveMode {
  /** Template for interactive TUI launch. */
  command: string
  /** Requires PTY (pseudo-terminal)? */
  requiresPty: boolean
}

// --- ACP (Agent Client Protocol) -----------------------------------------

export interface AcpInfo {
  /** ACP launch command */
  command: string
  /** ACP args (e.g. ['acp']) */
  args: string[]
}

// --- Install info --------------------------------------------------------

export interface AgentInstallSource {
  /** Primary install method */
  primary: string
  /** Alternative methods */
  alternatives?: string[]
  /** Package manager type */
  type: 'npm' | 'pip' | 'standalone' | 'powershell'
}

// --- Full agent spec -----------------------------------------------------

export interface AgentSpec {
  id: string
  displayName: string
  /**
   * Commands to try for PATH detection (ordered by priority).
   * First match wins.
   */
  detectCommands: string[]
  /** Capabilities matching AgentCapabilities type */
  capabilities: {
    interactive: boolean
    headless: boolean
    resume?: boolean
    authCheck?: boolean
    autoApprove?: boolean
  }
  /** One-shot (non-interactive) execution mode */
  printMode: PrintMode | null
  /** Interactive TUI mode */
  interactiveMode: InteractiveMode | null
  /** ACP protocol support */
  acp: AcpInfo | null
  /** Installation sources */
  install: AgentInstallSource
  /** Known CLI flags */
  flags: AgentFlag[]
  /** Human-readable notes about behavior quirks */
  notes?: string[]
}

// --- Specs ---------------------------------------------------------------

export const AGENT_SPECS: Record<string, AgentSpec> = {
  codex: {
    id: 'codex',
    displayName: 'Codex CLI',
    detectCommands: ['codex'],
    capabilities: { interactive: true, headless: true, resume: true, authCheck: true, autoApprove: true },
    printMode: {
      command: 'codex exec "{{prompt}}"',
      supportsMaxTurns: false,
      supportsAutoApprove: true,  // --yolo
      notes: 'Use --yolo for auto-approve; use --full-auto for sandboxed auto-approve',
    },
    interactiveMode: { command: 'codex', requiresPty: true },
    acp: null,
    install: { primary: 'npm install -g @openai/codex', type: 'npm' },
    flags: [
      { flag: 'exec "prompt"', description: 'One-shot execution, exits when done', mode: 'print' },
      { flag: '--full-auto', description: 'Sandboxed auto-approve file changes', mode: 'both' },
      { flag: '--yolo', description: 'No sandbox, no approvals (fastest)', mode: 'both' },
      { flag: 'review --base <branch>', description: 'PR review mode against branch', mode: 'print' },
      { flag: 'review --commit <SHA>', description: 'Review a specific commit', mode: 'print' },
      { flag: 'review --uncommitted', description: 'Review staged+unstaged+untracked changes only', mode: 'print' },
      { flag: 'review --title "..."', description: 'Custom title for review summary', mode: 'print' },
    ],
    notes: [
      'Must run inside a git repository',
      'review --uncommitted and review --base are mutually exclusive',
      'review --uncommitted does NOT accept a prompt arg; use --title for context',
      'review mode can be slow on large repos (600s+ on 500+ commits with 68+ files)',
    ],
  },

  kimi: {
    id: 'kimi',
    displayName: 'Kimi Code',
    detectCommands: ['kimi', 'kimi-code'],
    capabilities: { interactive: true, headless: true, resume: true, authCheck: true, autoApprove: true },
    printMode: {
      command: 'kimi -p "{{prompt}}"',
      supportsMaxTurns: false,
      supportsAutoApprove: false,
      notes: '-p (print mode) CANNOT be combined with --yolo or --auto. Just use bare -p.',
    },
    interactiveMode: { command: 'kimi "{{prompt}}"', requiresPty: true },
    acp: { command: 'kimi', args: ['acp'] },
    install: {
      primary: 'PowerShell: irm https://code.kimi.com/kimi-code/install.ps1 | iex',
      alternatives: ['Manual download from code.kimi.com'],
      type: 'standalone',
    },
    flags: [
      { flag: '-p, --prompt <text>', description: 'Non-interactive one-shot mode', mode: 'print' },
      { flag: '-y, --yolo', description: 'Auto-approve all actions (print mode only)', mode: 'print' },
      { flag: '--auto', description: 'Auto permission mode', mode: 'interactive' },
      { flag: '-m, --model <model>', description: 'Override default model', mode: 'both' },
      { flag: '-S, --session [id]', description: 'Resume a session', mode: 'both' },
      { flag: '-C, --continue', description: 'Continue previous session', mode: 'both' },
      { flag: '--plan', description: 'Start in plan mode', mode: 'both' },
      { flag: '--output-format <fmt>', description: 'text or stream-json', mode: 'both' },
    ],
    notes: [
      'No --max-turns, --allowedTools, or --max-budget-usd flags',
      'Standalone native binary, NOT npm-based',
      'code.kimi.com is behind Volcengine CDN; MSYS curl may need --resolve workaround',
    ],
  },

  claude: {
    id: 'claude',
    displayName: 'Claude Code',
    detectCommands: ['claude'],
    capabilities: { interactive: true, headless: true, resume: true, authCheck: true, autoApprove: true },
    printMode: {
      command: 'claude -p "{{prompt}}"',
      supportsMaxTurns: true,
      supportsAutoApprove: true,
      notes: 'Use --max-turns <N> to limit agentic loops; --dangerously-skip-permissions for auto-approve',
    },
    interactiveMode: { command: 'claude', requiresPty: true },
    acp: null,
    install: { primary: 'npm install -g @anthropic-ai/claude-code', type: 'npm' },
    flags: [
      { flag: '-p, --print "query"', description: 'Non-interactive one-shot', mode: 'print' },
      { flag: '-c, --continue', description: 'Resume most recent conversation in cwd', mode: 'both' },
      { flag: '--model <alias>', description: 'sonnet, opus, haiku', mode: 'both' },
      { flag: '--effort <level>', description: 'low, medium, high, max, auto', mode: 'both' },
      { flag: '--max-turns <n>', description: 'Limit agentic loops (print mode only)', mode: 'print' },
      { flag: '--max-budget-usd <n>', description: 'Cap API spend', mode: 'both' },
      { flag: '--dangerously-skip-permissions', description: 'Auto-approve all tool use', mode: 'both' },
      { flag: '--allowedTools <tools...>', description: 'Whitelist specific tools', mode: 'both' },
      { flag: '--output-format <fmt>', description: 'text, json, stream-json', mode: 'both' },
      { flag: '--json-schema <schema>', description: 'Force structured JSON output', mode: 'both' },
      { flag: '--bare', description: 'Skip hooks, plugins, MCP, CLAUDE.md (fastest)', mode: 'both' },
      { flag: '--resume <id>', description: 'Resume a specific session', mode: 'both' },
    ],
    notes: [
      'Known bugs in v2.1.140: 11 confirmed client-side bugs causing excessive API consumption',
      'Lock to v2.1.109 with DISABLE_AUTOUPDATER=1 as mitigation',
      'Settings hierarchy: CLI flags > .claude/settings.local.json > .claude/settings.json > ~/.claude/settings.json',
      'Memory files: ~/.claude/CLAUDE.md (global), ./CLAUDE.md (project git-tracked), .claude/CLAUDE.local.md (gitignored)',
      'Hooks system: PostToolUse, PreToolUse, Stop',
    ],
  },

  pi: {
    id: 'pi',
    displayName: 'PI coding agent',
    detectCommands: ['pi'],
    capabilities: { interactive: true, headless: false, resume: true, authCheck: true, autoApprove: false },
    printMode: null,
    interactiveMode: { command: 'pi', requiresPty: true },
    acp: null,
    install: { primary: 'npm install -g @earendil-works/pi-coding-agent', type: 'npm' },
    flags: [
      { flag: '-c', description: 'Continue last session', mode: 'both' },
      { flag: '-r', description: 'Browse sessions', mode: 'both' },
    ],
    notes: [
      'Not Inflection\'s Pi; it is @earendil-works/pi-coding-agent',
      'Multi-provider: Anthropic, OpenAI, DeepSeek, Ollama, custom OpenAI-compatible',
      'RPC mode: stdin/stdout JSONL for programmatic control',
      'Sessions saved as JSONL under ~/.pi/sessions/',
      '4 built-in tools: read, write, edit, bash',
      'No built-in sub-agents, no plan mode, no native MCP (use mcporter)',
      'Self-extending via TypeScript extensions (hot-reload)',
      'MIT licensed',
      'Smoke test: pi "prompt" opens an interactive TUI and does not exit; no stable non-interactive mode found.',
    ],
  },

  opencode: {
    id: 'opencode',
    displayName: 'OpenCode',
    detectCommands: ['opencode'],
    capabilities: { interactive: true, headless: true, resume: true, authCheck: true, autoApprove: false },
    printMode: {
      command: 'opencode run "{{prompt}}"',
      supportsMaxTurns: false,
      supportsAutoApprove: false,
    },
    interactiveMode: { command: 'opencode', requiresPty: true },
    acp: null,
    install: { primary: 'npm i -g opencode-ai@latest', type: 'npm' },
    flags: [
      { flag: 'run \'prompt\'', description: 'One-shot execution and exit', mode: 'print' },
      { flag: '-c, --continue', description: 'Continue last session', mode: 'both' },
      { flag: '-s, --session <id>', description: 'Continue specific session', mode: 'both' },
      { flag: '--agent <name>', description: 'Choose agent (build or plan)', mode: 'both' },
      { flag: '--model <provider/model>', description: 'Force specific model', mode: 'both' },
      { flag: '-f, --file <path>', description: 'Attach file(s) to message', mode: 'both' },
      { flag: '--thinking', description: 'Show model thinking blocks', mode: 'both' },
      { flag: '--variant <level>', description: 'Reasoning effort (high, max, minimal)', mode: 'both' },
    ],
    notes: [
      '/exit opens an agent selector dialog instead of exiting. Use Ctrl+C or kill process.',
    ],
  },

  hermes: {
    id: 'hermes',
    displayName: 'Hermes Agent',
    detectCommands: ['hermes'],
    capabilities: { interactive: true, headless: true, resume: false, authCheck: false, autoApprove: true },
    printMode: {
      command: 'hermes -z "{{prompt}}"',
      supportsMaxTurns: false,
      supportsAutoApprove: true,
      notes: '-z / --oneshot prints the final reply to stdout without banner, spinner, or session_id. approvals are bypassed. `hermes chat -q "{{prompt}}"` is an alternative but noisier.',
    },
    interactiveMode: { command: 'hermes', requiresPty: true },
    acp: null,
    install: { primary: 'pip install hermes-agent', type: 'pip' },
    flags: [],
    notes: [
      'Hermes supports both interactive TUI mode and headless oneshot mode.',
      'Use `hermes -z "{{prompt}}"` for non-interactive one-shot calls when needed.',
      '`hermes chat -q "{{prompt}}"` also works, but `-z` is cleaner for scripts.',
    ],
  },

  openclaw: {
    id: 'openclaw',
    displayName: 'OpenClaw',
    detectCommands: ['openclaw'],
    capabilities: { interactive: true, headless: true, resume: true, authCheck: true, autoApprove: false },
    printMode: {
      command: 'openclaw agent --message "{{prompt}}" --local',
      supportsMaxTurns: false,
      supportsAutoApprove: false,
      notes: 'Local one-shot mode. Add --agent <id>, --session-key, or delivery flags for routed Gateway sessions.',
    },
    interactiveMode: { command: 'openclaw terminal', requiresPty: true },
    acp: null,
    install: {
      primary: 'npm install -g openclaw@latest',
      alternatives: ['pnpm add -g openclaw@latest', 'bun add -g openclaw@latest'],
      type: 'npm',
    },
    flags: [
      { flag: 'terminal', description: 'Open local terminal UI (alias for tui --local)', mode: 'interactive' },
      { flag: 'tui --local', description: 'Open embedded local TUI', mode: 'interactive' },
      { flag: 'agent --message "..." --local', description: 'Run one local agent turn', mode: 'print' },
      { flag: 'onboard', description: 'Guided first-run setup', mode: 'both' },
      { flag: 'gateway status', description: 'Check Gateway status', mode: 'both' },
    ],
    notes: [
      'OpenClaw is a local-first personal assistant with Gateway, channels, skills, and terminal UI.',
      '`openclaw terminal` is the best EasyAgentCenter launch command for interactive use.',
      'Gateway/channel setup may modify ~/.openclaw and install optional plugin dependencies.',
    ],
  },

  'cursor-cli': {
    id: 'cursor-cli',
    displayName: 'Cursor CLI',
    detectCommands: ['cursor-agent', 'cursor'],
    capabilities: { interactive: true, headless: false, resume: true, authCheck: true, autoApprove: false },
    printMode: null,
    interactiveMode: { command: 'cursor-agent', requiresPty: true },
    acp: null,
    install: { primary: 'Part of Cursor editor installation', type: 'standalone' },
    flags: [],
    notes: [
      'Usually managed by the Cursor desktop app updater',
      'cursor-agent may not be available as standalone CLI outside Cursor install',
      'Smoke test: `cursor` on Windows launches the Cursor editor, not a coding-agent CLI; no verified headless mode.',
    ],
  },

  gemini: {
    id: 'gemini',
    displayName: 'Gemini CLI',
    detectCommands: ['gemini'],
    capabilities: { interactive: true, headless: true, resume: true, authCheck: true, autoApprove: false },
    printMode: {
      command: 'gemini exec "{{prompt}}"',
      supportsMaxTurns: false,
      supportsAutoApprove: false,
    },
    interactiveMode: { command: 'gemini', requiresPty: true },
    acp: null,
    install: { primary: 'npm install -g @google/gemini-cli', type: 'npm' },
    flags: [],
  },

  aider: {
    id: 'aider',
    displayName: 'Aider',
    detectCommands: ['aider'],
    capabilities: { interactive: true, headless: true, resume: true, authCheck: true, autoApprove: true },
    printMode: {
      command: 'echo "{{prompt}}" | aider --no-suggest-shell-commands --yes',
      supportsMaxTurns: false,
      supportsAutoApprove: true,
      notes: '--yes auto-approves all changes',
    },
    interactiveMode: { command: 'aider', requiresPty: true },
    acp: null,
    install: { primary: 'pip install -U aider-chat', type: 'pip' },
    flags: [
      { flag: '--yes', description: 'Auto-approve all changes', mode: 'both' },
      { flag: '--no-suggest-shell-commands', description: 'Disable shell command suggestions', mode: 'both' },
      { flag: '--model <model>', description: 'Specify model', mode: 'both' },
    ],
  },

  'qwen-code': {
    id: 'qwen-code',
    displayName: 'Qwen Code',
    detectCommands: ['qwen', 'qwen-code'],
    capabilities: { interactive: true, headless: false, resume: false, authCheck: false, autoApprove: false },
    printMode: null,
    interactiveMode: { command: 'qwen', requiresPty: true },
    acp: null,
    install: { primary: 'npm install -g @qwen-code/qwen-code', type: 'npm' },
    flags: [],
  },

  goose: {
    id: 'goose',
    displayName: 'Goose',
    detectCommands: ['goose'],
    capabilities: { interactive: true, headless: true, resume: false, authCheck: false, autoApprove: true },
    printMode: {
      command: 'goose run -p "{{prompt}}"',
      supportsMaxTurns: false,
      supportsAutoApprove: true,
    },
    interactiveMode: { command: 'goose session', requiresPty: true },
    acp: null,
    install: { primary: 'See goose.sh/download for platform-specific install', type: 'standalone' },
    flags: [
      { flag: 'run -p "prompt"', description: 'One-shot execution', mode: 'print' },
      { flag: 'session', description: 'Start interactive session', mode: 'interactive' },
    ],
  },

  'swe-agent': {
    id: 'swe-agent',
    displayName: 'SWE-agent',
    detectCommands: ['swe-agent', 'sweagent'],
    capabilities: { interactive: false, headless: true, resume: false, authCheck: false, autoApprove: true },
    printMode: {
      command: 'sweagent run --prompt "{{prompt}}"',
      supportsMaxTurns: true,
      supportsAutoApprove: true,
      notes: 'Designed for automated SWE bench runs; inherently headless',
    },
    interactiveMode: null,
    acp: null,
    install: { primary: 'pip install -U swe-agent', type: 'pip' },
    flags: [
      { flag: 'run --prompt "..."', description: 'Run with prompt', mode: 'print' },
      { flag: '--agent <name>', description: 'Agent config to use', mode: 'print' },
    ],
  },
}

// --- Helpers ---------------------------------------------------------------

/** Ordered list of known agent IDs (for UI display ordering). */
export const AGENT_ORDER: string[] = [
  'codex',
  'kimi',
  'claude',
  'pi',
  'opencode',
  'hermes',
  'cursor-cli',
  'gemini',
  'openclaw',
  'aider',
  'qwen-code',
  'goose',
  'swe-agent',
]

/** Get spec for an agent, or undefined if unknown. */
export function getAgentSpec(id: string): AgentSpec | undefined {
  return AGENT_SPECS[id]
}

/** Build detection commands (for `where`/`which`) from all agent specs. */
export function getAllDetectCommands(): { id: string; commands: string[] }[] {
  return Object.entries(AGENT_SPECS).map(([id, spec]) => ({
    id,
    commands: spec.detectCommands,
  }))
}

