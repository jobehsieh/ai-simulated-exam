import { randomUUID } from "node:crypto";
import { readApiKey, redactKey } from "@/lib/api-key-server";
import { OUTPUT_DIR, scanAllArchives } from "@/lib/archive";
import { createDraft } from "@/lib/drafts";
import { generatePaper, getExamDate } from "@/lib/exam";
import {
  EXAM_DURATION_MINUTES,
  EXAM_YEAR,
  SCHOOLS,
  SUBJECTS,
  buildPlan,
  getSchool,
  getSubject,
  type School,
  type Subject,
} from "@/lib/exam-config";
import { OpenCodeAuthError } from "@/lib/opencode";
import { markdownToPdf, pdfSupported } from "@/lib/pdf";

export const dynamic = "force-dynamic";

/** 前端選單所需資料：科目、學校，以及考古題資料夾中各科各校實際收錄的學年度 */
export async function GET() {
  const archives = await scanAllArchives();
  return Response.json({
    year: EXAM_YEAR,
    durationMinutes: EXAM_DURATION_MINUTES,
    outputDir: OUTPUT_DIR,
    // 部署在沒有 Edge/Chrome 的環境（如 Vercel）時為 false，前端會提示改在本機執行
    capabilities: { pdf: pdfSupported() },
    schools: SCHOOLS.map((s) => ({ id: s.id, name: s.name })),
    subjects: SUBJECTS.map((s) => ({
      id: s.id,
      name: s.name,
      archive: archives[s.id],
      plan: buildPlan(s, []),
    })),
  });
}

interface GenerateBody {
  subjects?: unknown;
  schools?: unknown;
}

function pickIds<T>(value: unknown, lookup: (id: string) => T | undefined): T[] | null {
  if (!Array.isArray(value)) return null;
  const items: T[] = [];
  for (const id of value) {
    const item = typeof id === "string" ? lookup(id) : undefined;
    if (!item) return null;
    if (!items.includes(item)) items.push(item);
  }
  return items;
}

/**
 * 生成試題卷與解答卷（統一輸出 PDF）。
 * 回應為 NDJSON 串流：每行一個事件（status / progress / done / error / end），
 * 因為一份試卷需要數分鐘，前端才能即時顯示進度。
 */
export async function POST(request: Request) {
  // BYOK：金鑰由使用者的瀏覽器經 header 帶來，只在這次請求中使用
  const auth = readApiKey(request);
  if (!auth.ok) return auth.response;
  const apiKey = auth.key;

  // 事先擋下：無法產生 PDF 的環境不該先呼叫模型（會白白消耗使用者的金鑰額度）才失敗
  if (!pdfSupported()) {
    return Response.json(
      {
        error: "此伺服器環境沒有 Edge 或 Chrome，無法產生 PDF。請在安裝了瀏覽器的本機執行本專案（npm run dev）",
        code: "no-browser",
      },
      { status: 503 },
    );
  }

  let body: GenerateBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求內容必須是 JSON" }, { status: 400 });
  }
  const subjects = pickIds<Subject>(body.subjects, getSubject);
  const schools = pickIds<School>(body.schools, getSchool);
  if (!subjects || subjects.length === 0) return Response.json({ error: "請至少選擇一個科目" }, { status: 400 });
  if (!schools) return Response.json({ error: "學校清單無效" }, { status: 400 });

  const archives = await scanAllArchives();
  const encoder = new TextEncoder();
  const date = getExamDate();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // 前端已中斷連線
        }
      };

      for (const subject of subjects) {
        const sessionId = randomUUID();
        try {
          // 只採用該科目考古題資料夾中確實有資料的學校
          const available = new Set(archives[subject.id].map((a) => a.school));
          const usable = schools.filter((s) => available.has(s.id));
          const skipped = schools.filter((s) => !available.has(s.id));

          send({ type: "status", subject: subject.id, message: "開始出題" });
          const paper = await generatePaper({
            apiKey,
            subject,
            schools: usable,
            date,
            sessionId,
            signal: request.signal,
            onProgress: (p) => send({ type: "progress", subject: subject.id, ...p }),
          });
          if (skipped.length > 0) {
            paper.warnings.unshift(
              `考古題資料夾沒有「${subject.name}」的 ${skipped.map((s) => s.name).join("、")} 資料，這些學校未納入風格與權重`,
            );
          }

          send({ type: "status", subject: subject.id, message: "轉換為 PDF" });
          const [examPdf, answerPdf] = await Promise.all([markdownToPdf(paper.examMd), markdownToPdf(paper.answerMd)]);
          const id = await createDraft({ subjectId: subject.id, dateCompact: date.compact }, examPdf, answerPdf);

          send({
            type: "done",
            subject: subject.id,
            id,
            warnings: paper.warnings,
            plan: paper.plan,
            schools: usable.map((s) => s.name),
          });
        } catch (error) {
          if (request.signal.aborted) break;
          const message = redactKey(error instanceof Error ? error.message : String(error), apiKey);
          const authFailed = error instanceof OpenCodeAuthError;
          send({ type: "error", subject: subject.id, message, ...(authFailed && { code: "auth" }) });
          // 金鑰被拒絕時，後面的科目也一定會失敗，直接結束
          if (authFailed) break;
        }
      }
      send({ type: "end" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
