import { randomUUID } from "node:crypto";
import { solveProblem } from "@/lib/answer-key";
import { BadRequestError, errorResponse, readJsonBody, requireString } from "@/lib/api-helpers";
import { readApiKey } from "@/lib/api-key-server";
import { parseProblems } from "@/lib/exam";
import { getSubject } from "@/lib/exam-config";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * 生成流程第 2 步：解答單一大題。POST { subject, examBody, problemNo }，金鑰放 header `x-opencode-key`。
 * 用戶端會對每個大題各呼叫一次（並行），每次只需一次 LLM 請求，能在單次執行時限內完成。
 */
export async function POST(request: Request) {
  const auth = readApiKey(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await readJsonBody(request);
    const subject = getSubject(requireString(body.subject, "subject", 40));
    if (!subject) throw new BadRequestError("科目無效");
    const examBody = requireString(body.examBody, "examBody", 60_000);

    // 大題資訊以伺服器解析的結果為準，不信任用戶端另外傳的配分或標題
    const problem = parseProblems(examBody).find((p) => p.no === body.problemNo);
    if (!problem) throw new BadRequestError("找不到指定的大題");

    const { solved, warnings } = await solveProblem({
      apiKey: auth.key,
      subject,
      examBody,
      problem: { no: problem.no, points: problem.points, title: problem.title },
      sessionId: randomUUID(),
      signal: request.signal,
    });
    return Response.json({ ...solved, warnings });
  } catch (error) {
    return errorResponse(error, auth.key);
  }
}
