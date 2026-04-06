# 🎙️ VoiceArticle — MP3から記事を自動生成

音声ファイル（MP3等）をアップロードすると、AIが文字起こし・記事生成・図表作成を自動で行うWebアプリです。

## 機能

- 🎵 **MP3/WAV/M4A対応** — OpenAI Whisperで高精度文字起こし（日本語・英語）
- ✨ **AI記事生成** — Claude APIで構造化された記事を自動生成
- 📊 **Mermaid図表** — フロー図・マインドマップ・シーケンス図を自動挿入
- ⚙️ **文体カスタマイズ** — トーン・語尾・記事長さを設定画面から指定
- 📋 **Markdownエクスポート** — Note/Zennへのコピペ投稿に最適化
- 🌙 **ダークUI** — 目に優しいエディタ風インターフェース

## 必要なAPIキー

| サービス | 用途 | 取得先 |
|---|---|---|
| OpenAI API | Whisper音声認識 | https://platform.openai.com |
| Anthropic API | Claude記事生成 | https://console.anthropic.com |

---

## ローカル開発

```bash
# 1. 依存関係インストール
npm install

# 2. 環境変数設定
cp .env.example .env
# .env を編集してAPIキーを記入

# 3. 起動
npm run dev
# → http://localhost:3000
```

---

## Renderへのデプロイ

### 方法1: render.yaml（推奨）

1. このリポジトリをGitHubにプッシュ
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
3. リポジトリを選択 → `render.yaml` が自動検出される
4. **Environment Variables** に以下を追加：
   - `OPENAI_API_KEY` = `sk-...`
   - `ANTHROPIC_API_KEY` = `sk-ant-...`
5. **Apply** をクリック → 自動デプロイ開始

### 方法2: 手動設定

1. Render Dashboard → **New** → **Web Service**
2. GitHubリポジトリを選択
3. 以下を設定：
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Node Version**: 18以上
4. Environment Variables にAPIキーを追加

### Render Free Tierの注意点

- 非アクティブ時（15分）にスリープします
- 初回アクセスは起動に30秒ほどかかります
- `/tmp` ディレクトリのみ書き込み可能（アップロードファイルは処理後即削除）

---

## 使い方

1. **ファイルアップロード** — MP3などをドラッグ&ドロップ、またはクリックで選択
2. **自動文字起こし** — Whisper APIが音声をテキストに変換（左パネルに表示）
3. **設定調整** — 文体・語尾・長さをクイック設定で選択
4. **記事を生成** ボタンをクリック
5. **プレビュー確認** — Markdownプレビューと図表を確認
6. **コピー/エクスポート** — NoteやZennに貼り付け

---

## APIキーの設定方法

### 環境変数（推奨・Render）
Renderのダッシュボード → Service → Environment にキーを設定。

### ブラウザから入力
左パネル下部の「🔑 APIキー設定」を展開して入力。  
※ キーはサーバーには保存されず、セッション中のみ使用されます。

---

## ディレクトリ構成

```
mp3-article-app/
├── src/
│   └── server.js          # Expressサーバー + API処理
├── public/
│   └── index.html         # フロントエンド（シングルファイル）
├── render.yaml            # Renderデプロイ設定
├── .env.example           # 環境変数テンプレート
└── package.json
```
