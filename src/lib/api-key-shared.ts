// BYOK（Bring Your Own Key）：前後端共用的常數與驗證。
// 使用者的 OpenCode API key 只存在自己瀏覽器的 localStorage，呼叫本站 API 時放在這個 header 帶上。

export const API_KEY_HEADER = "x-opencode-key";

const KEY_PATTERN = /^[\x21-\x7E]+$/; // 可見 ASCII，不含空白；也避免 header 值出現無法傳送的字元

/** 回傳錯誤訊息；格式正確時回傳 null */
export function validateKeyFormat(key: string): string | null {
  if (!key) return "請貼上 API 金鑰";
  if (key.length < 8 || key.length > 256) return "金鑰長度看起來不對，請確認是否完整複製";
  if (!KEY_PATTERN.test(key)) return "金鑰含有空白或不合法字元，請重新複製（前後多的空白會自動移除）";
  return null;
}

/** 只顯示頭尾，例如 sk-••••••ab12 */
export function maskKey(key: string): string {
  if (key.length <= 10) return "••••••••";
  return `${key.slice(0, 3)}••••••${key.slice(-4)}`;
}
