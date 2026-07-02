# EasyAgentCenter

[English](README.md) | [简体中文](README.zh-CN.md) | [Русский](README.ru.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md)

EasyAgentCenter は、Windows デスクトップ向けの軽量な CLI Agent 管理ツールです。Codex CLI、Kimi Code、Claude Code、Hermes などの主要な Agent ツールをまとめて起動・管理でき、任意の実行可能な Agent ツールやコマンドもカスタム Agent として登録できます。

複数のコーディング Agent を同時に使うユーザーに向いています。プロジェクト別または Agent 別にセッションを確認し、内蔵ターミナルで直接対話し、プロジェクトディレクトリからすばやく起動できます。セッションが完了または失敗したときにはデスクトップ通知も受け取れます。EasyAgentCenter 自体は API Key を内蔵せず、セッションデータをアップロードしません。各 Agent はそれぞれのログイン状態とローカル設定を使います。

## スクリーンショット

<p>
  <img src="docs/images/easyagentcenter-light-preview.png" alt="EasyAgentCenter light theme preview" width="49%">
  <img src="docs/images/easyagentcenter-dark-preview.png" alt="EasyAgentCenter dark terminal preview" width="49%">
</p>

## 主な機能

- PATH 内にインストール済みの CLI Agent を自動検出。
- プロジェクトフォルダを追加し、選択したプロジェクトで Agent をすばやく起動。
- プロジェクト別または Agent 別にセッションを管理。
- セッション記録の停止、削除、一括削除、並べ替え、復元。
- 内蔵 PTY ターミナルで Agent と直接対話。
- ターミナル背景色のカスタマイズ。
- Codex CLI の `/status` と `/usage` 出力を補助する任意のクォータパネル。
- 既知の Agent 向けインストール/更新コマンドの補助。
- セッション完了/失敗時の任意のデスクトップ通知。
- UI 言語: 英語、簡体字中国語、ロシア語、日本語、韓国語、スペイン語。

## プライバシー

EasyAgentCenter はセッションのメタデータとログをあなたの PC 上にローカル保存します。アプリ本体はセッションデータをアップロードせず、API Key も内蔵しません。個別の CLI Agent は、それぞれのログイン状態、環境変数、ローカル設定を使用する場合があります。

ソースコードからプロジェクトを実行する場合、生成される `data/` と `logs/` フォルダはローカル開発専用です。これらは Git で無視され、リポジトリにコミットしない想定です。

## クイックスタート

### 開発起動

```bash
npm ci
npm run dev
```

### ワンクリック開発ランチャー

ダブルクリック:

```text
start-easy-agent-center.bat
```

コマンドプロンプトを表示せずに起動したい場合:

```text
start-easy-agent-center-hidden.vbs
```

隠しランチャーは `npm run dev` をバックグラウンドで起動します。起動失敗を確認したい場合は、表示される `.bat` ファイルを使う方が便利です。

### パッケージ

```bash
npm run dist:dir
```

展開済みアプリを開く:

```text
dist\win-unpacked\easy-agent-center.exe
```

ポータブル exe:

```bash
npm run dist
```

## 要件

- Node.js 24.14.0。`.nvmrc` / `.node-version` を参照
- 主な対象プラットフォームは Windows

## ライセンス

[MIT](LICENSE)
