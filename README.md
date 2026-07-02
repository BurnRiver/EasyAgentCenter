# EasyAgentCenter

[English](README.md) | [简体中文](README.zh-CN.md) | [Русский](README.ru.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md)

A lightweight Windows desktop manager for CLI coding agents.

EasyAgentCenter brings Codex CLI, Claude Code, Kimi Code, Hermes, and custom CLI agents into one place, with project-based sessions, an embedded PTY terminal, desktop notifications, and Markdown export.

It is built for users who work with multiple coding agents at the same time: view sessions by project or by agent, talk directly inside the terminal, quick-start project folders, and restart or export sessions from the context menu. EasyAgentCenter does not include API keys and does not upload your session data. Each agent still uses its own login state and local configuration.

## Screenshots

<p>
  <img src="docs/images/easyagentcenter-light-preview.png" alt="EasyAgentCenter light theme preview" width="49%">
  <img src="docs/images/easyagentcenter-dark-preview.png" alt="EasyAgentCenter dark terminal preview" width="49%">
</p>

## Features

- Discover installed CLI agents from PATH.
- Add project folders and quick-start agents inside the chosen project.
- Manage sessions by project or by agent.
- Restart, stop, delete, batch-delete, reorder, and restore session records.
- Use an embedded PTY terminal for direct agent conversation.
- Export session transcripts to Markdown.
- Customize the terminal background color.
- Optional Codex CLI quota panel for `/status` and `/usage` output.
- Install/update helper for known agents.
- Optional desktop notification when a session finishes or fails.
- UI languages: English, Simplified Chinese, Russian, Japanese, Korean, and Spanish.

## Roadmap

- More detailed terminal theme and layout customization.
- Workflow / automation orchestration experiments.

Roadmap items are ideas, not promises. Priorities depend on real usage and feedback.

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

- End users can download the portable exe and do not need Node.js.
- Source development uses Node.js 24.14.0, see `.nvmrc` / `.node-version`
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
