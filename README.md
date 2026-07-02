# EasyAgentCenter

中文介绍：EasyAgentCenter 是一个快捷、轻量化的 Windows 桌面端 CLI Agent 管理器，用来集中启动和管理 Codex CLI、Kimi Code、Claude Code、Hermes 等多种主流 Agent 工具，也支持用户自定义任何可运行的 Agent 工具或命令，实现快捷启动和管理。

它适合同时使用多个编程 Agent 的用户：你可以按项目或按 Agent 查看会话，在内置终端里直接对话，快速启动项目目录，并在会话完成或失败时收到桌面通知。软件本身不内置 API Key，也不会上传你的会话数据；各 Agent 仍使用它们自己的登录状态和本地配置。

主要功能：

- 自动发现 PATH 中已安装的 CLI Agent。
- 按项目或按 Agent 管理会话。
- 内置 PTY 终端，接近原生命令行体验。
- 支持 Agent 安装/更新命令提示。
- 支持 Codex CLI 额度信息辅助面板。
- 支持会话完成/失败后的系统通知。
- 支持英文、简体中文、俄语、日语、韩语和西班牙语界面。

## 界面预览 / Screenshots

<p>
  <img src="docs/images/easyagentcenter-light-preview.png" alt="EasyAgentCenter light theme preview" width="49%">
  <img src="docs/images/easyagentcenter-dark-preview.png" alt="EasyAgentCenter dark terminal preview" width="49%">
</p>

---

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
