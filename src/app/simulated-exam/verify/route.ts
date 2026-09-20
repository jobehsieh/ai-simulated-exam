import { randomUUID } from "node:crypto";
import { readApiKey, redactKey } from "@/lib/api-key-server";
import { OpenCodeAuthError, chatCompletion } from "@/lib/opencode";

export const dynamic = "force-dynamic";

/** 驗證使用者填的 OpenCode API 金鑰是否可用（送一個極小的請求，約數十 token）：POST，金鑰放 header */
export async function POST(request: Request) {
  const auth = readApiKey(request);
  if (!auth.ok) return auth.response;

  try {
    await chatCompletion({
      apiKey: auth.key,
      messages: [{ role: "user", content: "Reply with the single word: ok" }],
      sessionId: randomUUID(),
      signal: AbortSignal.timeout(60_000),
      maxTokens: 64,
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof OpenCodeAuthError) {
      return Response.json({ ok: false, error: error.message, code: "auth" }, { status: 401 });
    }
    const message = redactKey(error instanceof Error ? error.message : String(error), auth.key);
    return Response.json({ ok: false, error: `無法確認金鑰：${message}` }, { status: 502 });
  }
}
