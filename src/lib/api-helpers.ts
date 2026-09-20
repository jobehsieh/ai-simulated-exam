import { redactKey } from "./api-key-server";
import { OpenCodeAuthError } from "./opencode";

// 雲端版的伺服器是無狀態的：每個請求獨立、內容由用戶端帶來，所以要限制大小並驗證型別。
const MAX_BODY_CHARS = 800_000;

export class BadRequestError extends Error {}

/** 讀取並解析 JSON 請求本文，超過大小限制或不是 JSON 時丟出 BadRequestError */
export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) throw new BadRequestError("請求內容過大");
  try {
    const value: unknown = JSON.parse(text);
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch {
    // 落到下方統一的錯誤
  }
  throw new BadRequestError("請求內容必須是 JSON 物件");
}

export function requireString(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    throw new BadRequestError(`欄位 ${name} 無效`);
  }
  return value;
}

/** 把例外轉成回應：金鑰被拒 401（前端據此重新開啟金鑰設定）、請求不合法 400、其餘 500；訊息中的金鑰一律遮掉 */
export function errorResponse(error: unknown, apiKey: string): Response {
  if (error instanceof OpenCodeAuthError) {
    return Response.json({ error: error.message, code: "auth" }, { status: 401 });
  }
  if (error instanceof BadRequestError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  const message = redactKey(error instanceof Error ? error.message : String(error), apiKey);
  return Response.json({ error: message }, { status: 500 });
}
