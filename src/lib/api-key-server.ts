import { API_KEY_HEADER, validateKeyFormat } from "./api-key-shared";

export type ApiKeyResult = { ok: true; key: string } | { ok: false; response: Response };

/**
 * 從請求 header 取出使用者自帶的 OpenCode API key。
 * 金鑰只在該次請求的記憶體內使用：不寫檔、不記錄、不回傳給前端。
 */
export function readApiKey(request: Request): ApiKeyResult {
  const key = request.headers.get(API_KEY_HEADER)?.trim() ?? "";
  if (!key) {
    return {
      ok: false,
      response: Response.json(
        { error: "尚未設定 OpenCode API 金鑰，請先到「API 金鑰」設定", code: "no-key" },
        { status: 401 },
      ),
    };
  }
  const problem = validateKeyFormat(key);
  if (problem) {
    return { ok: false, response: Response.json({ error: problem, code: "bad-key" }, { status: 401 }) };
  }
  return { ok: true, key };
}

/** 錯誤訊息回傳前，把可能夾帶的金鑰遮掉 */
export function redactKey(message: string, key: string): string {
  return key ? message.split(key).join("***") : message;
}
