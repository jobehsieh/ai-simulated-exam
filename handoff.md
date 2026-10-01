# 交接檔（handoff.md）

> 任何 Agent、任何電腦接手前**必讀**；收工時**必更新**。詳細脈絡見 Obsidian：`ai-simulated-exam/專案工作流程.md`。

## ⏯️ 目前做到哪
LLM 後端換成 Google Gemini（預設 `gemini-flash-latest`），伺服器端讀 `GEMINI_API_KEY`；Vercel 三個環境已設好；README 與 UI 文案已更新並推上 main。

## 🚦 目前狀態
程式可編譯（tsc 通過），Gemini 串流請求用 curl 測通。線上 `/simulated-exam/verify` 回 ok（伺服器金鑰可呼叫 Gemini），但尚未完整出一科驗證。

## ➡️ 下一步
1. 開 https://ai-simulated-exam.vercel.app 實際出一科，確認出題→解答→PDF 全流程
2. 該把已貼進對話的 Gemini 金鑰重新產生，並更新 Vercel 與本機 `.env.local` 的 `GEMINI_API_KEY`
3. 視需要精簡前端 BYOK 金鑰視窗

## ⚠️ 注意事項
- `gemini-2.5-flash` 對此金鑰已停用，用 `gemini-flash-latest`（可由 `LLM_MODEL` 覆寫）
- `src/lib/opencode.ts` 檔名與 `OpenCodeAuthError` 為歷史命名，實際連 Gemini；localStorage key、`x-opencode-key` header 刻意未改
- 姊妹專案「國中英文模擬試題站」（G:\我的雲端硬碟\國中英文模擬試題站，repo jobehsieh/junior-high-english-exam）已同樣換成 Gemini 並部署到 https://junior-high-english-exam.vercel.app
- `vercel link` 會在 `.env.local` 寫入 `VERCEL_OIDC_TOKEN`（本機暫時憑證，已被 git 忽略）

## 🕐 最後更新
- 時間：2026-10-01 18:54
- 更新者：Claude Code @ DESKTOP-9CRMHFD
- Git push：✅ 已推
