# EasyAgentCenter

[English](README.md) | [简体中文](README.zh-CN.md) | [Русский](README.ru.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md)

EasyAgentCenter 是一个快捷、轻量化的 Windows 桌面端 CLI Agent 管理器，用来集中启动和管理 Codex CLI、Kimi Code、Claude Code、Hermes 等多种主流 Agent 工具，也支持用户自定义任何可运行的 Agent 工具或命令，实现快捷启动和管理。

它适合同时使用多个编程 Agent 的用户：你可以按项目或按 Agent 查看会话，在内置终端里直接对话，快速启动项目目录，并在会话完成或失败时收到桌面通知。软件本身不内置 API Key，也不会上传你的会话数据；各 Agent 仍使用它们自己的登录状态和本地配置。

## 界面预览

<p>
  <img src="docs/images/easyagentcenter-light-preview.png" alt="EasyAgentCenter 英文浅色界面预览" width="49%">
  <img src="docs/images/easyagentcenter-dark-preview.png" alt="EasyAgentCenter 中文深色终端预览" width="49%">
</p>

## 主要功能

- 自动发现 PATH 中已安装的 CLI Agent。
- 添加项目目录，并在指定项目中快速启动 Agent。
- 按项目或按 Agent 管理会话。
- 停止、删除、批量删除、排序和恢复会话记录。
- 内置 PTY 终端，接近原生命令行体验。
- 支持自定义终端底色。
- 支持 Codex CLI 额度信息辅助面板。
- 支持 Agent 安装/更新命令提示。
- 支持会话完成/失败后的系统通知。
- 支持英文、简体中文、俄语、日语、韩语和西班牙语界面。

## 隐私说明

EasyAgentCenter 会把会话元数据和会话日志保存在你的本机。软件本身不会上传你的会话数据，也不内置 API Key。各个 CLI Agent 仍使用它们自己的登录状态、环境变量或本地配置。

开发目录中的 `data/` 和 `logs/` 已被 Git 忽略，不应提交到仓库。

## 快速开始

### 开发启动

```bash
npm ci
npm run dev
```

### 一键开发启动

双击：

```text
start-easy-agent-center.bat
```

如果希望隐藏启动时的命令行窗口，可以使用：

```text
start-easy-agent-center-hidden.vbs
```

隐藏启动器会在后台启动 `npm run dev`。如果需要排查启动失败，建议使用可见的 `.bat` 文件。

### 打包

```bash
npm run dist:dir
```

然后从下面路径打开未压缩版本：

```text
dist\win-unpacked\easy-agent-center.exe
```

生成便携版 exe：

```bash
npm run dist
```

## 环境要求

- Node.js 24.14.0，见 `.nvmrc` / `.node-version`
- Windows 是主要目标平台

## 项目结构

```text
electron/          Electron 主进程和 preload 桥接
src/
  i18n.tsx         界面文案
  ui/              React UI 组件
  core/            PTY 管理、会话管理、事件总线
  agents/          Agent 规格和安装/更新辅助
  discovery/       Agent PATH 发现
  storage/         会话和日志存储
```

## 脚本

| 命令                | 说明 |
| ------------------- | ---- |
| `npm run dev`       | 启动开发模式 |
| `npm run build`     | 构建 main、preload 和 renderer |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run dist:dir`  | 构建未压缩的 Windows 应用目录 |
| `npm run dist`      | 构建 Windows 便携版 exe |

## 许可证

[MIT](LICENSE)
