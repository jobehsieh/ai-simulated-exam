<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# AI 考研模擬試題產生器（專案藍圖）

> 本檔為跨 Agent 通用的專案藍圖（AGENTS.md 開放標準）。任何 Agent 的每個 session 都應先讀本檔＋`handoff.md`。上方 Next.js 區塊由 `next dev` 自動維護，請勿移除。

## 專案簡介
選擇科目與參照學校的出題形式，由 Google Gemini 生成「試題卷＋解答卷」PDF，使用者預覽確認後存檔。Next.js 全端應用，部署在 Vercel（https://ai-simulated-exam.vercel.app）。技術細節見 `README.md`。

## 關鍵時程
（無）

## 目標與路線圖
- [x] 出題／解答／PDF 渲染三步驟流程（無狀態，由瀏覽器接力）
- [x] 部署到 Vercel（Chromium 冷啟動序列化）
- [x] LLM 後端由 OpenCode Go 換成 Google Gemini，伺服器端金鑰 `GEMINI_API_KEY`
- [ ] 在線上網址完整出一科，驗證 Gemini 流程
- [ ] 視需要精簡/移除前端 BYOK 金鑰視窗

## 資料夾結構
- `src/app/`：頁面與 API（`simulated-exam/` 含 route、solve、render、verify）
- `src/lib/`：出題、LLM 呼叫（`opencode.ts` 實際連 Gemini）、金鑰處理、PDF
- `src/components/`：UI 與首頁區塊
- `scripts/`：考古題清單產生；`docs/`：參考文件

## 同步層級（本專案初始化至第 3 層級）

| 層級 | 平台 | 位置 | 讀取時機 |
|------|------|------|---------|
| L1 | 本地 | `AGENTS.md`＋`handoff.md` | 每個 session |
| L2 | GitHub | jobehsieh/ai-simulated-exam | 指定時 |
| L3 | Obsidian | `ai-simulated-exam/專案工作流程.md` | 有需要時 |

## 工作約定
- 任何 Agent、任何電腦：**開工先讀 `handoff.md`，收工必更新 `handoff.md`**
- 修改共用檔案前先讀最新內容，避免覆蓋其他 Agent 的變更
- 所有回應與文件使用繁體中文
- 修改前先確認計畫，優先保留原有資料結構

## 安全與隱私（不可違反）
- **不把 API key、密碼、憑證寫進 repo**，也不要貼進 `AGENTS.md`／`handoff.md`；一律放 `.env.local`（已被 git 忽略）與 Vercel 環境變數
- 要公開分享前，先確認檔案裡沒有金鑰
