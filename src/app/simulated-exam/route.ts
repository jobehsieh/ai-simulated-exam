import { randomUUID } from "node:crypto";
import { BadRequestError, errorResponse, readJsonBody, requireString } from "@/lib/api-helpers";
import { readApiKey } from "@/lib/api-key-server";
import { scanAllArchives } from "@/lib/archive";
import { generateExamBody, getExamDate } from "@/lib/exam";
import {
  EXAM_DURATION_MINUTES,
  EXAM_YEAR,
  SCHOOLS,
  SUBJECTS,
  buildPlan,
  getSchool,
  getSubject,
  type School,
} from "@/lib/exam-config";

export const dynamic = "force-dynamic";
// 出題（一次 LLM 請求）通常 1–2 分鐘；配分不符需重寫時可能加倍。解答與 PDF 由後續請求分別處理
export const maxDuration = 300;

/** 前端選單所需資料：科目、學校，以及考古題資料夾中各科各校收錄的學年度 */
export async function GET() {
  const archives = scanAllArchives();
  return Response.json({
    year: EXAM_YEAR,
    durationMinutes: EXAM_DURATION_MINUTES,
    schools: SCHOOLS.map((s) => ({ id: s.id, name: s.name })),
    subjects: SUBJECTS.map((s) => ({
      id: s.id,
      name: s.name,
      archive: archives[s.id],
      plan: buildPlan(s, []),
    })),
  });
}

/**
 * 生成流程第 1 步：出題。POST { subject, schools }，金鑰放 header `x-opencode-key`。
 * 回傳題目本文與大題結構；之後用戶端依序呼叫 /simulated-exam/solve（逐題解答）與 /simulated-exam/render（轉 PDF）。
 * 拆成多個短請求，是為了能在無伺服器平台的單次執行時限內完成。
 */
export async function POST(request: Request) {
  // BYOK：金鑰由使用者的瀏覽器經 header 帶來，只在這次請求中使用
  const auth = readApiKey(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await readJsonBody(request);
    const subject = getSubject(requireString(body.subject, "subject", 40));
    if (!subject) throw new BadRequestError("科目無效");

    if (!Array.isArray(body.schools) || body.schools.length > SCHOOLS.length) throw new BadRequestError("學校清單無效");
    const schools: School[] = [];
    for (const id of body.schools) {
      const school = typeof id === "string" ? getSchool(id) : undefined;
      if (!school) throw new BadRequestError("學校清單無效");
      if (!schools.includes(school)) schools.push(school);
    }

    // 只採用該科目考古題中確實有資料的學校
    const available = new Set(scanAllArchives()[subject.id].map((a) => a.school));
    const usable = schools.filter((s) => available.has(s.id));
    const skipped = schools.filter((s) => !available.has(s.id));

    const exam = await generateExamBody({
      apiKey: auth.key,
      subject,
      schools: usable,
      sessionId: randomUUID(),
      signal: request.signal,
    });
    if (skipped.length > 0) {
      exam.warnings.unshift(
        `考古題資料夾沒有「${subject.name}」的 ${skipped.map((s) => s.name).join("、")} 資料，這些學校未納入風格與權重`,
      );
    }

    return Response.json({
      subject: subject.id,
      dateIso: getExamDate().iso,
      examBody: exam.body,
      problems: exam.problems.map(({ no, points, title }) => ({ no, points, title })),
      warnings: exam.warnings,
      plan: exam.plan,
      usedSchools: usable.map((s) => s.name),
    });
  } catch (error) {
    return errorResponse(error, auth.key);
  }
}
