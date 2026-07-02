# EasyAgentCenter

[English](README.md) | [简体中文](README.zh-CN.md) | [Русский](README.ru.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md)

EasyAgentCenter は、Windows デスクトップ向けの軽量な CLI coding agent 管理ツールです。

EasyAgentCenter は Codex CLI、Claude Code、Kimi Code、Hermes、カスタム CLI Agent を 1 つのウィンドウにまとめ、プロジェクト別セッション、内蔵 PTY ターミナル、デスクトップ通知、Markdown 書き出しを提供します。

複数のコーディング Agent を同時に使うユーザーに向いています。プロジェクト別または Agent 別にセッションを確認し、内蔵ターミナルで直接対話し、プロジェクトディレクトリからすばやく起動できます。右クリックメニューからセッションの再起動や書き出しもできます。EasyAgentCenter 自体は API Key を内蔵せず、セッションデータをアップロードしません。各 Agent はそれぞれのログイン状態とローカル設定を使います。

## スクリーンショット

<p>
  <img src="docs/images/easyagentcenter-light-preview.png" alt="EasyAgentCenter light theme preview" width="49%">
  <img src="docs/images/easyagentcenter-dark-preview.png" alt="EasyAgentCenter dark terminal preview" width="49%">
</p>

## 主な機能

- PATH 内にインストール済みの CLI Agent を自動検出。
- プロジェクトフォルダを追加し、選択したプロジェクトで Agent をすばやく起動。
- プロジェクト別または Agent 別にセッションを管理。
- セッション記録の再起動、停止、削除、一括削除、並べ替え、復元。
- 内蔵 PTY ターミナルで Agent と直接対話。
- セッション記録を Markdown に書き出し。
- ターミナル背景色のカスタマイズ。
- Codex CLI の `/status` と `/usage` 出力を補助する任意のクォータパネル。
- 既知の Agent 向けインストール/更新コマンドの補助。
- セッション完了/失敗時の任意のデスクトップ通知。
- UI 言語: 英語、簡体字中国語、ロシア語、日本語、韓国語、スペイン語。

## Roadmap

- より細かなターミナルテーマとレイアウトのカスタマイズ。
- ワークフロー / 自動化オーケストレーションの実験。

Roadmap の項目はアイデアであり、約束ではありません。優先順位は実際の利用状況とフィードバックによって変わります。

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

- 一般ユーザーはポータブル exe をダウンロードすればよく、Node.js は不要です。
- ソース開発では Node.js 24.14.0 を使用します。`.nvmrc` / `.node-version` を参照
- 主な対象プラットフォームは Windows

## ライセンス

[MIT](LICENSE)
