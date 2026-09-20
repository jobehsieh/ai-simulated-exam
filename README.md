# AI 考研模擬試題產生器

選擇科目與參照學校的出題形式，由 OpenCode Go 的模型生成「試題卷 + 解答卷」PDF，使用者預覽確認後存入 `模擬考題\{科目}\`。
出題規格來自 [cs-graduate-exam-skills](https://github.com/jobehsieh/cs-graduate-exam-skills) 的 `mock-exam-generator`（EXAM_SPEC / EXAM_PROMPT）。

## 啟動

```
npm run dev      # http://localhost:3000
```

需要本機安裝 Edge 或 Chrome（用來把 HTML 列印成 PDF）。

## BYOK（自備金鑰）

本專案**不使用伺服器端的環境變數金鑰**。每位使用者在網頁右上角「API 金鑰」貼上自己的 OpenCode Go 金鑰：

- 金鑰存在該瀏覽器的 `localStorage`（key：`ai-simulated-exam:opencode-api-key`），伺服器不儲存、不記錄。
- 呼叫 `POST /simulated-exam` 與 `POST /simulated-exam/verify` 時，以 header `x-opencode-key` 帶上；伺服器只在該次請求的記憶體中使用，並在錯誤訊息中遮蔽金鑰。
- 沒帶金鑰回 `401 { code: "no-key" }`；金鑰被 OpenCode 拒絕時，生成串流會送出 `{ type: "error", code: "auth" }`，前端據此重新開啟設定視窗。
- 若部署到公開網址，務必使用 HTTPS，否則金鑰會以明文經過網路。

## 頁面

- `/`：產品介紹頁（Landing Page），含 Header / Footer，按鈕導向出題工作台。
- `/studio`：出題工作台（選科目、選學校風格、生成、預覽、確認存檔）。
- 設計語彙（色彩、字型、動畫）定義在 `src/app/globals.css`；Header / Footer 在 `src/components/`，首頁區塊在 `src/components/landing/`。

## 流程

1. 前端選科目（可複選）與參照學校（可複選，只能選該科在考古題資料夾有資料的學校）。
2. `POST /simulated-exam`（需帶 `x-opencode-key`）：依科目主題權重與學校風格出題 → 逐題撰寫解答 → 轉 PDF，回傳 NDJSON 進度串流。
3. `GET /simulated-exam/preview?id=…&kind=exam|answer`：預覽草稿 PDF（尚未寫入資料夾）。
4. `POST /simulated-exam/save`：使用者確認後，存入 `模擬考題\{科目}\`（檔名已存在時加流水號，不覆蓋）。
5. `GET /simulated-exam`：選單資料（科目、學校、考古題資料夾實際收錄的學年度）。
6. `POST /simulated-exam/verify`（需帶 `x-opencode-key`）：送出極小請求驗證金鑰是否可用。

## 卷面規則（`src/lib/exam-config.ts`、`src/lib/exam.ts`）

- 標題：`116 學年度碩士班入學考試模擬試題`，不含學校名稱，並加註出題日期（台北時區）。卷頭由程式產生，不交給模型。
- 作答時間 100 分鐘、總分 100 分；大題 6–8 題，配分總和與子題配分會自動檢查，不符時請模型重寫一次。
- 主題權重與題型比例：以 EXAM_SPEC §3 的各科主題比例為基準，依所選學校（§5）加成後正規化為 100；複選學校時各校平均混合。
- 解答卷四部分：逐題解答、計分明細表、評分標準（由模型逐題撰寫）、計分表（由程式依題目結構產生）。

## 環境變數（皆有預設值）

| 變數 | 預設 | 說明 |
|------|------|------|
| `OPENCODE_GO_MODEL` | `glm-5.3` | 模型 ID |
| `OPENCODE_GO_REASONING_EFFORT` | `low` | 推理量。`medium`/`high` 思考過久時上游會中斷串流 |
| `OPENCODE_GO_BASE_URL` | `https://opencode.ai/zen/go/v1` | API 位址 |
| `EXAM_OUTPUT_DIR` | `D:\d\0-agent\模擬考題` | 確認後的存檔根目錄 |
| `EXAM_ARCHIVE_DIR` | `D:\d\0-agent\資工所考古題` | 考古題資料夾 |
| `BROWSER_PATH` | 自動尋找 Edge / Chrome | 轉 PDF 用的瀏覽器 |
