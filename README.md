# EasyAgentCenter

Lightweight Windows desktop manager for CLI coding agents such as Codex CLI, Kimi Code, Claude Code, OpenClaw, Hermes, PI coding agent, and custom shell commands.

EasyAgentCenter focuses on agent session management and terminal interaction so the app can stay predictable, fast, and close to a native `cmd` / PowerShell experience.

Languages: English, Simplified Chinese, Russian, Japanese, Korean, and Spanish. Switch in the top-right corner of the app.

## Features

- Discover installed CLI agents from PATH.
- Add project folders and quick-start agents inside the chosen project.
- Manage sessions by project or by agent.
- Stop, delete, batch-delete, reorder, and restore session records.
- Use an embedded PTY terminal for direct agent conversation.
- Keep transcript logs under `logs/`.
- Optional Codex CLI quota panel for `/status` and `/usage` output.
- Install/update helper for known agents.
- Optional desktop notification when a one-shot session finishes or fails.

## Privacy Notes

EasyAgentCenter stores local session metadata under `data/` and transcript logs under `logs/` during development. These folders are ignored by Git and should not be published.

The app does not require API keys by itself. Individual CLI agents may use their own login state or environment variables.

## Quick Start

### Development Launch

```bash
npm ci
npm run dev
```

### One-Click Dev Launcher

Double-click:

```text
start-easy-agent-center.bat
```

For a hidden development launcher, use:

```text
start-easy-agent-center-hidden.vbs
```

The hidden launcher starts `npm run dev` without keeping a visible Command Prompt in front. The visible batch file is better when debugging startup failures.

### Package

```bash
npm run dist:dir
```

Then open the unpacked app from:

```text
dist\win-unpacked\easy-agent-center.exe
```

Portable exe:

```bash
npm run dist
```

## Requirements

- Node.js 24.14.0, see `.nvmrc` / `.node-version`
- Windows is the primary target

## Project Structure

```text
electron/          Electron main process and preload bridge
src/
  i18n.tsx         English / Chinese UI strings
  ui/              React UI components
  core/            PTY manager, session manager, event bus
  agents/          Agent specs and package helpers
  discovery/       Agent PATH discovery
  storage/         Session and transcript storage
```

## Scripts

| Command             | Description |
| ------------------- | ----------- |
| `npm run dev`       | Start in development mode |
| `npm run build`     | Build main, preload, and renderer bundles |
| `npm run typecheck` | TypeScript type check |
| `npm run dist:dir`  | Build unpacked Windows app directory |
| `npm run dist`      | Build Windows portable exe |

## License

[MIT](LICENSE)

