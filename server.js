import express from "express";
import multer from "multer";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// dotenv (ESM対応)
try {
  const require = createRequire(import.meta.url);
  const dotenv = require("dotenv");
  dotenv.config();
} catch {}

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// publicフォルダはserver.jsと同階層
app.use(express.static(path.join(__dirname, "public")));

// Renderの/tmpディレクトリを使用（書き込み可能）
const UPLOAD_DIR = process.env.RENDER ? "/tmp/uploads" : path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/mp4", "audio/m4a", "audio/ogg", "audio/webm"];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|m4a|ogg|webm)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("音声ファイルのみアップロード可能です"));
    }
  }
});

function getOpenAI(apiKey) { return new OpenAI({ apiKey }); }
function getClaude(apiKey) { return new Anthropic({ apiKey }); }

// ────────────────────────────────────────
// POST /api/transcribe
// ────────────────────────────────────────
app.post("/api/transcribe", upload.single("audio"), async (req, res) => {
  const filePath = req.file?.path;
  try {
    const openaiKey = req.body.openaiKey || process.env.OPENAI_API_KEY;
    if (!openaiKey) return res.status(400).json({ error: "OpenAI APIキーが必要です" });
    if (!req.file)  return res.status(400).json({ error: "音声ファイルが見つかりません" });

    const openai = getOpenAI(openaiKey);
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      language: "ja",
      response_format: "verbose_json"
    });

    res.json({ text: transcription.text, duration: transcription.duration, language: transcription.language });
  } catch (err) {
    console.error("Transcribe error:", err);
    res.status(500).json({ error: err.message || "文字起こし中にエラーが発生しました" });
  } finally {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
});

// ────────────────────────────────────────
// POST /api/generate
// ────────────────────────────────────────
app.post("/api/generate", async (req, res) => {
  try {
    const { transcript, settings, claudeKey } = req.body;
    const apiKey = claudeKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey)    return res.status(400).json({ error: "Anthropic APIキーが必要です" });
    if (!transcript) return res.status(400).json({ error: "文字起こしテキストが必要です" });

    const claude = getClaude(apiKey);
    const toneInstructions = buildToneInstructions(settings);
    const diagramInstruction = settings?.includeDiagrams
      ? `\n\n## 図表について\n内容に応じてMermaid図表を1〜3個挿入してください：\n\`\`\`mermaid\n（図表コード）\n\`\`\`\n使用可能なタイプ：flowchart / mindmap / sequenceDiagram / classDiagram`
      : "";

    const systemPrompt = `あなたはプロのライター兼テクニカルライターです。
音声の文字起こしテキストをもとに、読みやすく整理された記事を生成してください。

${toneInstructions}

## 出力フォーマット
JSONで以下の形式のみで返答してください（\`\`\`jsonで囲まず、純粋なJSONのみ）：
{
  "title": "記事タイトル（魅力的かつ簡潔に）",
  "summary": "3〜5文の要約",
  "tags": ["タグ1", "タグ2", "タグ3", "タグ4", "タグ5"],
  "body": "Markdown形式の本文",
  "readingTime": 推定読了時間（分・数値のみ）
}`;

    const userPrompt = `以下の文字起こしテキストから記事を生成してください。${diagramInstruction}\n\n【文字起こし】\n${transcript}`;

    const message = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    });

    const rawText = message.content[0].text;
    let parsed;
    try {
      const jsonMatch = rawText.match(/```json\s*([\s\S]*?)```/) || rawText.match(/({[\s\S]*})/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[1] : rawText);
    } catch {
      parsed = { title: "生成された記事", summary: "", tags: [], body: rawText, readingTime: Math.ceil(rawText.length / 400) };
    }

    res.json(parsed);
  } catch (err) {
    console.error("Generate error:", err);
    res.status(500).json({ error: err.message || "記事生成中にエラーが発生しました" });
  }
});

// ────────────────────────────────────────
// POST /api/regenerate-section
// ────────────────────────────────────────
app.post("/api/regenerate-section", async (req, res) => {
  const { section, instruction, claudeKey } = req.body;
  const apiKey = claudeKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(400).json({ error: "APIキーが必要です" });

  try {
    const claude = getClaude(apiKey);
    const message = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: `以下のテキストを指示に従って書き直してください。\n\n指示：${instruction}\n\n元のテキスト：\n${section}\n\n書き直したテキストのみを返してください。` }]
    });
    res.json({ text: message.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ヘルスチェック（Render用）
app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎙️ 起動 → http://localhost:${PORT}`);
  console.log(`環境: ${process.env.RENDER ? "Render" : "ローカル"}`);
});

// ────────────────────────────────────────
// ヘルパー
// ────────────────────────────────────────
function buildToneInstructions(settings) {
  if (!settings) return "## スタイル\n丁寧でわかりやすい文体で書いてください。";
  const lines = ["## スタイル・文体の指定"];
  const tones = { formal: "です・ます調の丁寧な文体を使用してください。", casual: "フランクで親しみやすい口語的な文体を使用してください。", academic: "客観的で論理的な学術的文体を使用してください。", energetic: "熱量高くエネルギッシュな文体で読者を引き込んでください。", gentle: "穏やかで優しい文体を使用してください。" };
  const endings = { desu_masu: "文末は「です」「ます」で統一してください。", da_dearu: "文末は「だ」「である」で統一してください。", casual_yo: "文末に「よ」「ね」「よね」を適度に使って親しみやすくしてください。", question: "読者に語りかけるような疑問形を適度に交えてください。" };
  const lengths = { short: "800〜1200文字程度の短めの記事にしてください。", medium: "1500〜2500文字程度の標準的な長さにしてください。", long: "3000文字以上の詳細な記事にしてください。" };
  if (settings.tone) lines.push(tones[settings.tone] || settings.tone);
  if (settings.ending) lines.push(endings[settings.ending] || `語尾は「${settings.ending}」を使用してください。`);
  if (settings.targetAudience) lines.push(`対象読者：${settings.targetAudience}`);
  if (settings.articleLength) lines.push(lengths[settings.articleLength] || "");
  if (settings.customInstruction) lines.push(`追加指示：${settings.customInstruction}`);
  return lines.join("\n");
}
