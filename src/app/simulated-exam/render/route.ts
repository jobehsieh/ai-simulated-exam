import { buildAnswerMarkdown, type SolvedProblem } from "@/lib/answer-key";
import { BadRequestError, errorResponse, readJsonBody, requireString } from "@/lib/api-helpers";
import { readApiKey } from "@/lib/api-key-server";
import { buildExamMarkdown, dateFromIso, parseProblems } from "@/lib/exam";
import { getSubject } from "@/lib/exam-config";
import { markdownToPdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";
// 雲端首次呼叫需解壓縮並啟動 Chromium，加上載入中文字型，給足時間
export const maxDuration = 300;

function parseSolved(value: unknown, expected: number): SolvedProblem[] {
  if (!Array.isArray(value) || value.length !== expected) throw new BadRequestError("解答數量與題目數不一致");
  return value.map((item) => {
    const o = (item ?? {}) as Record<string, unknown>;
    if (
      typeof o.solution !== "string" ||
      typeof o.rubric !== "string" ||
      o.solution.length > 60_000 ||
      o.rubric.length > 60_000 ||
      !Array.isArray(o.tableRows) ||
      o.tableRows.length > 60 ||
      !o.tableRows.every((r) => typeof r === "string" && r.length <= 2_000)
    ) {
      throw new BadRequestError("解答內容格式不正確");
    }
    return { solution: o.solution, rubric: o.rubric, tableRows: o.tableRows as string[] };
  });
}

/**
 * 生成流程第 3 步：把試題卷或解答卷轉成 PDF。
 * POST { kind: "exam" | "answer", subject, dateIso, examBody, solved? }，回傳 application/pdf。
 * 卷頭與計分表由伺服器依題目結構產生；伺服器無狀態，內容全由用戶端帶來，所以只做轉檔、不呼叫模型。
 * 仍要求帶金鑰 header，只是為了擋掉無關的匿名請求（不會拿去打模型）。
 */
export async function POST(request: Request) {
  const auth = readApiKey(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await readJsonBody(request);
    const subject = getSubject(requireString(body.subject, "subject", 40));
    if (!subject) throw new BadRequestError("科目無效");
    const dateIso = requireString(body.dateIso, "dateIso", 10);
    try {
      dateFromIso(dateIso);
    } catch {
      throw new BadRequestError("出題日期格式不正確");
    }
    const examBody = requireString(body.examBody, "examBody", 60_000);
    const problems = parseProblems(examBody);
    if (problems.length === 0) throw new BadRequestError("題目內容不含任何大題");

    let markdown: string;
    if (body.kind === "exam") {
      markdown = buildExamMarkdown(subject, dateIso, examBody);
    } else if (body.kind === "answer") {
      markdown = buildAnswerMarkdown(subject, dateIso, examBody, parseSolved(body.solved, problems.length));
    } else {
      throw new BadRequestError("kind 必須是 exam 或 answer");
    }

    const pdf = await markdownToPdf(markdown);
    return new Response(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error, auth.key);
  }
}
