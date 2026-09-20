# AI 考研模擬試題產生器

選擇科目與參照學校的出題形式，由 OpenCode Go 的模型生成「試題卷 + 解答卷」PDF，使用者預覽確認後存入自己選的資料夾（依科目建立子資料夾）。
出題規格來自 [cs-graduate-exam-skills](https://github.com/jobehsieh/cs-graduate-exam-skills) 的 `mock-exam-generator`（EXAM_SPEC / EXAM_PROMPT）。

可在本機執行，也可部署到 Vercel（雲端）——兩種環境的行為一致。

## 啟動（本機）

```
npm install
npm run dev      # http://localhost:3000
```

PDF 由伺服器端的 Chromium 產生：本機優先使用已安裝的 Edge / Chrome；沒有（如 Vercel）就使用打包的 `@sparticuz/chromium`。

## BYOK（自備金鑰）

本專案**不使用伺服器端的環境變數金鑰**。每位使用者在網頁右上角「API 金鑰」貼上自己的 OpenCode Go 金鑰：

- 金鑰存在該瀏覽器的 `localStorage`（key：`ai-simulated-exam:opencode-api-key`），伺服器不儲存、不記錄。
- 呼叫本站 API 時以 header `x-opencode-key` 帶上；伺服器只在該次請求的記憶體中使用，並在錯誤訊息中遮蔽金鑰。
- 沒帶金鑰回 `401 { code: "no-key" }`；金鑰被 OpenCode 拒絕回 `401 { code: "auth" }`，前端據此重新開啟設定視窗。
- 部署到公開網址務必使用 HTTPS，否則金鑰會以明文經過網路。

## 架構：無狀態、由瀏覽器接力

雲端函式有單次執行時限，且不同請求可能落在不同機器上，所以伺服器**不保存任何狀態**，出題流程拆成三個短請求，由瀏覽器依序呼叫：

| 步驟 | API | 說明 |
|------|-----|------|
| 1 | `POST /simulated-exam` `{ subject, schools }` | 依主題權重與學校風格出題（一次 LLM 請求，約 0.5–2 分鐘），回傳題目本文、大題結構、警告 |
| 2 | `POST /simulated-exam/solve` `{ subject, examBody, problemNo }` | 解答單一大題；瀏覽器對每個大題各呼叫一次（並行 4 個） |
| 3 | `POST /simulated-exam/render` `{ kind, subject, dateIso, examBody, solved? }` | 轉成 PDF（`kind` = `exam` 或 `answer`），回傳 `application/pdf` |
| — | `GET /simulated-exam` | 選單資料：科目、學校、各科各校收錄的考古題學年度 |
| — | `POST /simulated-exam/verify` | 用極小請求驗證金鑰是否可用 |

- 卷頭、作答說明、計分表由伺服器依題目結構產生，不交給模型。
- `render` 收到的 Markdown 來自用戶端，視為不可信：原始 HTML 會被跳脫（只放行 `<br>`、`<sub>`、`<sup>`）、不輸出圖片與連結，且瀏覽器內只允許載入內嵌資料與 Google Fonts。
- 每個步驟都設有 `maxDuration = 300`（秒）。

## 儲存

PDF 回傳到瀏覽器後，由瀏覽器寫檔（伺服器在雲端不能寫使用者的硬碟）：

- **Edge / Chrome**：使用 File System Access API。第一次儲存時選一個資料夾（建議選「模擬考題」），之後會記住（存在 IndexedDB），並自動在裡面建立科目子資料夾：`{資料夾}/{科目}/{科目}_116學年度模擬試題_{日期}[_n].pdf` 與 `..._解答卷.pdf`。同名檔案已存在時加流水號，不覆蓋。
- **其他瀏覽器**：改為一般檔案下載。

## 考古題年度清單

雲端讀不到本機磁碟，所以各科各校收錄的學年度以 `src/data/archive-manifest.json` 隨專案附帶。考古題有增減時，重新產生並提交：

```
npm run archive:manifest                       # 預設掃描 D:/d/0-agent/資工所考古題
npm run archive:manifest -- <考古題資料夾路徑>
```

## 頁面

- `/`：產品介紹頁（Landing Page），含 Header / Footer，按鈕導向出題工作台。
- `/studio`：出題工作台（選科目、選學校風格、生成、預覽、確認存檔）。
- 設計語彙（色彩、字型、動畫）定義在 `src/app/globals.css`；Header / Footer 在 `src/components/`，首頁區塊在 `src/components/landing/`。

## 卷面規則（`src/lib/exam-config.ts`、`src/lib/exam.ts`）

- 標題：`116 學年度碩士班入學考試模擬試題`，不含學校名稱，並加註出題日期（台北時區）。
- 作答時間 100 分鐘、總分 100 分；大題 6–8 題，配分總和與子題配分會自動檢查，不符時請模型重寫一次。
- 主題權重與題型比例：以 EXAM_SPEC §3 的各科主題比例為基準，依所選學校（§5）加成後正規化為 100；複選學校時各校平均混合。
- 解答卷四部分：逐題解答、計分明細表、評分標準（由模型逐題撰寫）、計分表（由程式依題目結構產生）。

## 部署到 Vercel

`vercel.json` 已固定為 Next.js 的建置設定。`next.config.ts` 用 `outputFileTracingIncludes` 把 Chromium 執行檔與 MathJax 納入 `/simulated-exam/render` 的部署內容。

- Chromium 首次啟動（冷啟動）需要解壓縮，`render` 第一次呼叫較慢。
- 雲端沒有中文字型，PDF 轉檔時會從 Google Fonts 載入 Noto Sans TC（只下載用到的字元切片）。
- 單次請求上限為 300 秒（`maxDuration`）。

## 環境變數（皆有預設值，皆為選用）

| 變數 | 預設 | 說明 |
|------|------|------|
| `OPENCODE_GO_MODEL` | `glm-5.3` | 模型 ID |
| `OPENCODE_GO_REASONING_EFFORT` | `low` | 推理量。`medium`/`high` 思考過久時上游會中斷串流 |
| `OPENCODE_GO_BASE_URL` | `https://opencode.ai/zen/go/v1` | API 位址 |
| `BROWSER_PATH` | 自動尋找 Edge / Chrome | 本機轉 PDF 用的瀏覽器 |
