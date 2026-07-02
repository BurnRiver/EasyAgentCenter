# EasyAgentCenter - Agent Reference

CLI coding agent technical reference for EasyAgentCenter.
Neutral notes for CLI detection, installation, and launch behavior.

## Codex CLI

| Field | Value |
|-------|-------|
| CLI name | `codex` |
| Install | `npm install -g @openai/codex` |
| PATH detection | `where codex` / `which codex` |
| Auth | `codex login` (OAuth) or `OPENAI_API_KEY` |
| Requires git repo? | **Yes** |
| Print mode | `codex exec "{{prompt}}"` |
| Interactive | `codex` (needs PTY) |
| ACP | None |
| Headless | Yes |
| Auto-approve | `--yolo` (no sandbox) / `--full-auto` (sandboxed) |
| Resume | Yes |
| Max-turns | Not supported |

### Key flags

| Flag | Effect |
|------|--------|
| `exec "prompt"` | One-shot execution, exits when done |
| `--full-auto` | Sandboxed auto-approve |
| `--yolo` | No sandbox, no approvals (fastest) |
| `review --base <branch>` | PR review mode against branch |
| `review --commit <SHA>` | Review specific commit |
| `review --uncommitted` | Review staged+unstaged+untracked only |
| `review --title "..."` | Custom title for review summary |

### Notes

- `--uncommitted` and `--base` are mutually exclusive
- `--uncommitted` does NOT accept a prompt arg; use `--title`
- Can be slow on large repos (5-10 min on 500+ commit project)

---

## Kimi Code (Moonshot AI)

| Field | Value |
|-------|-------|
| CLI name | `kimi` / `kimi-code` |
| Install | PowerShell: `irm https://code.kimi.com/kimi-code/install.ps1 \| iex` |
| PATH detection | `where kimi` |
| Auth | Kimi Coding Plan subscription (kimi.ai) |
| Requires git repo? | No |
| Print mode | `kimi -p "{{prompt}}"` |
| Interactive | `kimi "{{prompt}}"` (needs PTY) |
| ACP | `kimi acp` |
| Headless | Yes |
| Auto-approve | `--yolo` or `--auto` (cannot combine with `-p`) |
| Resume | `-S <id>` or `-C` |
| Max-turns | Not supported |

### Key flags

| Flag | Effect |
|------|--------|
| `-p, --prompt <text>` | Non-interactive one-shot mode |
| `-y, --yolo` | Auto-approve all actions |
| `--auto` | Auto permission mode (interactive only) |
| `-m, --model <model>` | Override default model |
| `-S, --session [id]` | Resume a session |
| `-C, --continue` | Continue previous session |
| `--plan` | Start in plan mode |
| `--output-format <fmt>` | text or stream-json |

### Notes

- Standalone native binary (not npm-based)
- `-p` CANNOT be combined with `--yolo` or `--auto` - error
- No `--max-turns`, `--allowedTools`, `--max-budget-usd`
- Download host `code.kimi.com` behind Volcengine CDN; MSYS curl may need `--resolve`

---

## Claude Code (Anthropic)

| Field | Value |
|-------|-------|
| CLI name | `claude` |
| Install | `npm install -g @anthropic-ai/claude-code` |
| PATH detection | `where claude` |
| Auth | `claude auth login` or `ANTHROPIC_API_KEY` |
| Requires git repo? | Yes |
| Print mode | `claude -p "{{prompt}}"` |
| Interactive | `claude` (needs PTY) |
| ACP | None |
| Headless | Yes |
| Auto-approve | `--dangerously-skip-permissions` |
| Resume | `-c` (last) or `--resume <id>` |
| Max-turns | `--max-turns <N>` |
| Allowed tools | `--allowedTools <tools...>` |

### Key flags

| Flag | Effect |
|------|--------|
| `-p, --print "query"` | Non-interactive one-shot |
| `-c, --continue` | Resume most recent conversation |
| `--model <alias>` | sonnet, opus, haiku |
| `--effort <level>` | low, medium, high, max, auto |
| `--max-turns <n>` | Limit agentic loops |
| `--max-budget-usd <n>` | Cap API spend |
| `--dangerously-skip-permissions` | Auto-approve all tool use |
| `--allowedTools <tools...>` | Whitelist specific tools |
| `--output-format <fmt>` | text, json, stream-json |
| `--json-schema <schema>` | Force structured JSON output |
| `--bare` | Skip hooks, MCP, CLAUDE.md |
| `--resume <id>` | Resume specific session |

### Notes

- Settings hierarchy: CLI flags > `.claude/settings.local.json` > `.claude/settings.json` > `~/.claude/settings.json`
- Memory files: `~/.claude/CLAUDE.md` (global), `./CLAUDE.md` (git), `.claude/CLAUDE.local.md` (gitignored)
- Hooks: PostToolUse, PreToolUse, Stop
- Known bugs in v2.1.140: 11 confirmed client-side bugs causing excess API consumption

---

## PI Coding Agent (@earendil-works/pi)

| Field | Value |
|-------|-------|
| CLI name | `pi` |
| Install | `npm install -g @earendil-works/pi-coding-agent` |
| PATH detection | `where pi` |
| Auth | Provider env var (e.g. `DEEPSEEK_API_KEY`) or `/login` |
| Requires git repo? | No |
| Print mode | None verified |
| Interactive | `pi` (needs PTY) |
| ACP | None |
| Headless | No |
| Auto-approve | Not available |
| Resume | `-c` or browse with `-r` |
| Max-turns | Not supported |

Smoke test note: `pi "prompt"` opens the interactive TUI and does not exit cleanly, so EasyAgentCenter treats PI as interactive-only for now.

### Supported providers

| Provider | Auth |
|----------|------|
| Anthropic | `ANTHROPIC_API_KEY` or OAuth |
| OpenAI | `OPENAI_API_KEY` or OAuth |
| DeepSeek | `DEEPSEEK_API_KEY` |
| Ollama | Custom provider config |
| Custom | `models.json` - any OpenAI-compatible endpoint |

Switch mid-session: `/model` or `Ctrl+L`

### Notes

- 4 built-in tools: read, write, edit, bash
- Sessions saved as JSONL under `~/.pi/sessions/`
- RPC mode: stdin/stdout JSONL for programmatic control
- Self-extending via TypeScript extensions (hot-reload)
- No built-in sub-agents, no plan mode, no native MCP
- MIT licensed

---

## OpenCode CLI

| Field | Value |
|-------|-------|
| CLI name | `opencode` |
| Install | `npm i -g opencode-ai@latest` |
| PATH detection | `where opencode` |
| Auth | `opencode auth login` or provider env var |
| Requires git repo? | No |
| Print mode | `opencode run "{{prompt}}"` |
| Interactive | `opencode` (needs PTY) |
| ACP | None |
| Headless | Yes |
| Auto-approve | Not available |
| Resume | `-c` or `-s <id>` |
| Max-turns | Not supported |

### Key flags

| Flag | Effect |
|------|--------|
| `run 'prompt'` | One-shot execution and exit |
| `-c, --continue` | Continue last session |
| `-s, --session <id>` | Continue specific session |
| `--agent <name>` | Choose agent (build or plan) |
| `--model <provider/model>` | Force specific model |
| `-f, --file <path>` | Attach file(s) to message |
| `--thinking` | Show model thinking blocks |
| `--variant <level>` | Reasoning effort (high, max, minimal) |

### Notes

- `/exit` opens an agent selector dialog. Use Ctrl+C to kill.

---

## Other agents (overview)

| Agent | CLI | Install method | Headless | Print mode |
|-------|-----|---------------|----------|------------|
| Cursor CLI | `cursor-agent`, `cursor` | Part of Cursor editor | No | None verified |
| Gemini CLI | `gemini` | `npm install -g @google/gemini-cli` | Yes | `gemini exec "prompt"` |
| OpenClaw | `openclaw` | `npm install -g openclaw@latest` | Yes | `openclaw agent --message "prompt" --local` |
| Aider | `aider` | `pip install -U aider-chat` | Yes | `echo "prompt" \| aider --yes` |
| Qwen Code | `qwen`, `qwen-code` | `npm install -g @qwen-code/qwen-code` | No | None |
| Goose | `goose` | goose.sh/download | Yes | `goose run -p "prompt"` |
| SWE-agent | `swe-agent`, `sweagent` | `pip install -U swe-agent` | Yes | `sweagent run --prompt "prompt"` |
| Hermes | `hermes` | `pip install hermes-agent` | Yes | `hermes -z "prompt"` |

---

## Agent detection (where/which commands)

```typescript
const AGENT_COMMANDS: Record<string, string[]> = {
  codex:       ['codex'],
  kimi:        ['kimi', 'kimi-code'],
  claude:      ['claude'],
  pi:          ['pi'],
  opencode:    ['opencode'],
  hermes:      ['hermes'],
  'cursor-cli':['cursor-agent', 'cursor'],
  gemini:      ['gemini'],
  openclaw:    ['openclaw'],
  aider:       ['aider'],
  'qwen-code': ['qwen', 'qwen-code'],
  goose:       ['goose'],
  'swe-agent': ['swe-agent', 'sweagent'],
}
```

---

## Verification Notes

Use a harmless prompt when validating an agent:

```text
Reply only EASY_AGENT_CENTER_SMOKE_OK; do not modify files or run dangerous commands.
```

Suggested checks:

- PATH detection finds the expected executable.
- Interactive launch opens inside the embedded PTY.
- Print mode, when supported, exits cleanly.
- Missing tools stay visible in the install/update modal but do not appear in the quick-start sidebar.
- Agents that need login should fail with a readable message rather than hanging silently.
