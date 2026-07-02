# EasyAgentCenter

[English](README.md) | [简体中文](README.zh-CN.md) | [Русский](README.ru.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md)

Lightweight Windows desktop manager for CLI coding agents such as Codex CLI, Kimi Code, Claude Code, OpenClaw, Hermes, PI coding agent, and custom shell commands.

EasyAgentCenter focuses on agent session management and terminal interaction so the app can stay predictable, fast, and close to a native `cmd` / PowerShell experience.

It is built for users who work with multiple coding agents at the same time: view sessions by project or by agent, talk directly inside the embedded terminal, quick-start project folders, and receive desktop notifications when sessions finish or fail. EasyAgentCenter does not include API keys and does not upload your session data. Each agent still uses its own login state and local configuration.

## Screenshots

<p>
  <img src="docs/images/easyagentcenter-light-preview.png" alt="EasyAgentCenter light theme preview" width="49%">
  <img src="docs/images/easyagentcenter-dark-preview.png" alt="EasyAgentCenter dark terminal preview" width="49%">
</p>

## Features

- Discover installed CLI agents from PATH.
- Add project folders and quick-start agents inside the chosen project.
- Manage sessions by project or by agent.
- Stop, delete, batch-delete, reorder, and restore session records.
- Use an embedded PTY terminal for direct agent conversation.
- Customize the terminal background color.
- Optional Codex CLI quota panel for `/status` and `/usage` output.
- Install/update helper for known agents.
- Optional desktop notification when a session finishes or fails.
- UI languages: English, Simplified Chinese, Russian, Japanese, Korean, and Spanish.

## Privacy Notes

EasyAgentCenter keeps session metadata and transcript logs locally on your computer. The app itself does not upload your session data and does not include API keys. Individual CLI agents may use their own login state, environment variables, or local configuration.

If you run the project from source, the generated `data/` and `logs/` folders are only for local development. They are ignored by Git and should not be committed.

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
  i18n.tsx         UI strings
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
