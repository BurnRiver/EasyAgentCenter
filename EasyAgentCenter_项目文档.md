# EasyAgentCenter 项目文档

EasyAgentCenter 是一个面向 Windows 的轻量 CLI agent 会话管理器。

## 当前定位

- Windows 优先。
- 管理 Codex CLI、Kimi Code、Claude Code、OpenClaw、Hermes Agent、PI coding agent 等 CLI agent。
- 支持用户添加自定义 CLI agent 或本地快捷方式。
- 使用 Electron + React + node-pty + xterm.js 提供桌面终端体验。
- 保留项目、会话、日志、agent 发现、安装/更新辅助。

## 核心功能

- Agent 自动发现和状态展示。
- 项目文件夹收藏。
- 按项目或按 agent 查看会话。
- 快速启动 agent 到指定项目。
- 创建自定义 CLI 会话。
- 停止、删除、批量删除、排序、归档、恢复会话记录。
- xterm.js 终端交互，支持选择、复制、粘贴、中文输入兼容。
- 可选 Codex 额度面板。
- 会话进程完成或失败时可选桌面通知。
- 会话记录写入 `logs/`，会话元数据写入 `data/`。

## 本地启动

```powershell
npm ci
npm run dev
```

也可以双击：

```text
start-easy-agent-center.bat
```

隐藏开发启动：

```text
start-easy-agent-center-hidden.vbs
```

## 验证

```powershell
npm run typecheck
npm run build
```

## 开源发布注意

- 不提交 `data/`、`logs/`、`dist/`、`out/`、`node_modules/`。
- 不提交 `.env` 或任何账号、token、API key。
- 打包产物由用户本地运行 `npm run dist` 或 `npm run dist:dir` 生成。
