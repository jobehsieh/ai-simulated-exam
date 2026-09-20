const BASE_URL = process.env.OPENCODE_GO_BASE_URL ?? "https://opencode.ai/zen/go/v1";
const MODEL = process.env.OPENCODE_GO_MODEL ?? "glm-5.3";
// 推理模型預設思考量很大（可能數萬字仍無輸出），出題預設用 low；可設為 medium / high 換取更嚴謹的驗算
const REASONING_EFFORT = process.env.OPENCODE_GO_REASONING_EFFORT ?? "low";

/** 金鑰被 OpenCode Go 拒絕（401/403）。不該重試，前端會據此提示重新設定金鑰 */
export class OpenCodeAuthError extends Error {
  constructor() {
    super("OpenCode Go 拒絕了這把 API 金鑰，請檢查金鑰是否正確、訂閱是否仍有效");
    this.name = "OpenCodeAuthError";
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface StreamChunk {
  choices?: { delta?: { content?: string | null; reasoning_content?: string | null }; finish_reason?: string | null }[];
  error?: { message?: string };
}

export interface CompletionOptions {
  /** 使用者自帶的 OpenCode API key（BYOK），每次呼叫由請求 header 傳入 */
  apiKey: string;
  messages: ChatMessage[];
  /** 同一段對話請共用同一個 session id（OpenCode Go 用來路由與快取） */
  sessionId: string;
  signal?: AbortSignal;
  maxTokens?: number;
  /** 推理量，未指定時用環境變數 OPENCODE_GO_REASONING_EFFORT（預設 low） */
  reasoningEffort?: "low" | "medium" | "high";
  /** 每收到一段內容就呼叫，reasoning 為推理過程（不會進入結果） */
  onProgress?: (info: { contentChars: number; reasoningChars: number }) => void;
}

/** 呼叫 OpenCode Go 的 OpenAI 相容 chat completions（串流），回傳完整內容文字 */
export async function chatCompletion({
  apiKey,
  messages,
  sessionId,
  signal,
  maxTokens = 32000,
  reasoningEffort = REASONING_EFFORT as "low" | "medium" | "high",
  onProgress,
}: CompletionOptions): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "x-opencode-session": sessionId,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      max_tokens: maxTokens,
      temperature: 0.7,
      reasoning_effort: reasoningEffort,
    }),
    signal,
  });

  if (res.status === 401 || res.status === 403) throw new OpenCodeAuthError();
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenCode Go API 錯誤 (${res.status})：${detail.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let reasoningChars = 0;
  let finishReason: string | null = null;

  const handleLine = (line: string) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    let chunk: StreamChunk;
    try {
      chunk = JSON.parse(data);
    } catch {
      return;
    }
    if (chunk.error) throw new Error(`OpenCode Go API 錯誤：${chunk.error.message ?? "未知錯誤"}`);
    const choice = chunk.choices?.[0];
    if (choice?.delta?.content) content += choice.delta.content;
    if (choice?.delta?.reasoning_content) reasoningChars += choice.delta.reasoning_content.length;
    if (choice?.finish_reason) finishReason = choice.finish_reason;
    onProgress?.({ contentChars: content.length, reasoningChars });
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) handleLine(line.trim());
  }
  if (buffer.trim()) handleLine(buffer.trim());

  if (finishReason === "length") throw new Error("模型輸出被長度上限截斷");
  // 上游偶爾會在生成中途切斷串流；沒有結束標記的內容可能斷在句子中間，一律視為失敗
  if (!finishReason) throw new Error(`串流提前中斷（已收到 ${content.length} 字，思考 ${reasoningChars} 字）`);
  if (!content.trim()) throw new Error(`模型沒有回傳內容（思考 ${reasoningChars} 字）`);
  return content;
}
