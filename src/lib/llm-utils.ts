export const SYSTEM_PROMPT =
  "You are an expert author of computer-science graduate-school entrance examinations. You write original, well-posed, technically correct problems and you verify every answer before finalizing.";

/** 去掉模型偶爾包在最外層的 ```markdown 圍欄 */
export function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const m = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/);
  return (m ? m[1] : trimmed).trim();
}

/** 失敗時重試一次（使用者取消時不重試） */
export async function retryOnce<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (signal?.aborted) throw error;
    return fn();
  }
}

/** 以固定並行數執行，回傳結果保留輸入順序 */
export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** 偵測「整張表格被壓成同一行」：含 |---| 分隔線卻不是純分隔列的行 */
export function hasMergedTable(md: string): boolean {
  return md.split("\n").some((line) => /-{3,}\s*\|/.test(line) && !/^\s*\|?[\s:|-]+\|?\s*$/.test(line));
}
