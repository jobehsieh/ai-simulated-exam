import { apiKeyHeaders } from "./api-key-client";

// 雲端版的出題流程由瀏覽器接力，每一步都是一個短請求（各自能在無伺服器平台的執行時限內完成）：
//   1. POST /simulated-exam         出題
//   2. POST /simulated-exam/solve   逐題解答（每個大題一次，並行）
//   3. POST /simulated-exam/render  轉成 PDF（試題卷與解答卷各一次，並行）

export class ApiError extends Error {
  constructor(
    message: string,
    /** 伺服器回傳的錯誤代碼：no-key / bad-key / auth 都代表金鑰需要（重新）設定 */
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isKeyProblem(): boolean {
    return this.code === "no-key" || this.code === "bad-key" || this.code === "auth";
  }
}

function friendlyStatus(status: number): string {
  if (status === 504 || status === 408) return `伺服器處理逾時（HTTP ${status}），請稍後重試`;
  if (status >= 500) return `伺服器錯誤（HTTP ${status}），請稍後重試`;
  return `請求失敗（HTTP ${status}）`;
}

async function post(url: string, body: unknown, apiKey: string, signal: AbortSignal): Promise<Response> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...apiKeyHeaders(apiKey) },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    // 平台逾時等情況回的不是 JSON，解析失敗就用狀態碼組訊息
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new ApiError(data.error ?? friendlyStatus(res.status), data.code, res.status);
  }
  return res;
}

/** 失敗時重試一次（使用者取消、金鑰問題、請求本身不合法時不重試） */
async function retryOnce<T>(fn: () => Promise<T>, signal: AbortSignal): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (signal.aborted || (error instanceof ApiError && (error.isKeyProblem || error.status === 400))) throw error;
    return fn();
  }
}

/** 以固定並行數執行；任何一項失敗就停止領取新工作並讓其他進行中的請求中止 */
async function pool<T, R>(
  items: T[],
  limit: number,
  outer: AbortSignal,
  fn: (item: T, signal: AbortSignal) => Promise<R>,
): Promise<R[]> {
  const inner = new AbortController();
  const onOuterAbort = () => inner.abort();
  outer.addEventListener("abort", onOuterAbort);
  const results = new Array<R>(items.length);
  let next = 0;
  let firstError: unknown;

  const worker = async () => {
    while (next < items.length && !inner.signal.aborted) {
      const index = next++;
      try {
        results[index] = await fn(items[index], inner.signal);
      } catch (error) {
        if (firstError === undefined) firstError = error;
        inner.abort();
        return;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  outer.removeEventListener("abort", onOuterAbort);
  if (firstError !== undefined) throw firstError;
  return results;
}

export interface PlanInfo {
  topics: { name: string; weight: number }[];
  mix: { calc: number; proof: number; concept: number };
}

export interface SubjectRun {
  examPdf: Blob;
  answerPdf: Blob;
  warnings: string[];
  plan: PlanInfo;
  usedSchools: string[];
  /** yyyymmdd，用於檔名 */
  dateCompact: string;
}

interface ExamResponse {
  dateIso: string;
  examBody: string;
  problems: { no: number; points: number; title: string }[];
  warnings: string[];
  plan: PlanInfo;
  usedSchools: string[];
}

interface SolveResponse {
  solution: string;
  tableRows: string[];
  rubric: string;
  warnings: string[];
}

export async function runSubject(opts: {
  apiKey: string;
  subjectId: string;
  schoolIds: string[];
  signal: AbortSignal;
  onStatus: (message: string) => void;
}): Promise<SubjectRun> {
  const { apiKey, subjectId, schoolIds, signal, onStatus } = opts;

  onStatus("出題中（約 1–2 分鐘）…");
  const exam = (await (
    await post("/simulated-exam", { subject: subjectId, schools: schoolIds }, apiKey, signal)
  ).json()) as ExamResponse;

  const total = exam.problems.length;
  let done = 0;
  onStatus(`撰寫解答（0/${total} 題完成）…`);
  const solved = await pool(exam.problems, 4, signal, async (problem, innerSignal) => {
    const result = await retryOnce(
      async () =>
        (await (
          await post("/simulated-exam/solve", { subject: subjectId, examBody: exam.examBody, problemNo: problem.no }, apiKey, innerSignal)
        ).json()) as SolveResponse,
      innerSignal,
    );
    done += 1;
    onStatus(`撰寫解答（${done}/${total} 題完成）…`);
    return result;
  });

  onStatus("轉換為 PDF…");
  const renderBase = { subject: subjectId, dateIso: exam.dateIso, examBody: exam.examBody };
  const render = async (body: Record<string, unknown>) =>
    (await retryOnce(() => post("/simulated-exam/render", { ...renderBase, ...body }, apiKey, signal), signal)).blob();
  const [examPdf, answerPdf] = await Promise.all([
    render({ kind: "exam" }),
    render({ kind: "answer", solved: solved.map(({ solution, tableRows, rubric }) => ({ solution, tableRows, rubric })) }),
  ]);

  return {
    examPdf,
    answerPdf,
    warnings: [...exam.warnings, ...solved.flatMap((s) => s.warnings)],
    plan: exam.plan,
    usedSchools: exam.usedSchools,
    dateCompact: exam.dateIso.replaceAll("-", ""),
  };
}
