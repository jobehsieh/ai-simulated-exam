import {
  EXAM_DURATION_MINUTES,
  EXAM_YEAR,
  SCHOOL_NAME_PATTERN,
  buildPlan,
  type ExamPlan,
  type School,
  type Subject,
} from "./exam-config";
import { SYSTEM_PROMPT, hasMergedTable, retryOnce, stripCodeFence } from "./llm-utils";
import { chatCompletion, type ChatMessage } from "./opencode";

export interface ExamDate {
  /** 2026-09-20 */
  iso: string;
  /** 2026 年 9 月 20 日 */
  zh: string;
  /** 20260920 */
  compact: string;
}

/** 以台北時區取得出題日期 */
export function getExamDate(now = new Date()): ExamDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const [y, m, d] = [get("year"), get("month"), get("day")];
  return { iso: `${y}-${m}-${d}`, zh: `${y} 年 ${Number(m)} 月 ${Number(d)} 日`, compact: `${y}${m}${d}` };
}

/** 由 YYYY-MM-DD 重建 ExamDate；格式或日期不合法時丟出錯誤（用戶端傳入的值不可信） */
export function dateFromIso(iso: string): ExamDate {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const parsed = new Date(`${iso}T00:00:00Z`);
  // 例如 2026-02-31 會被 Date 進位成 3 月，所以要比對回轉後的字串
  if (!m || Number.isNaN(parsed.getTime()) || !parsed.toISOString().startsWith(iso)) {
    throw new Error("出題日期格式不正確");
  }
  return { iso, zh: `${m[1]} 年 ${Number(m[2])} 月 ${Number(m[3])} 日`, compact: `${m[1]}${m[2]}${m[3]}` };
}

export const examTitle = `${EXAM_YEAR} 學年度碩士班入學考試模擬試題`;

/** 卷頭由程式產生（不交給模型），確保不含學校名稱、學年度、日期與作答時間正確 */
export function buildExamHeader(subject: Subject, date: ExamDate, kind: "exam" | "answer"): string {
  const title = kind === "exam" ? `# ${examTitle}` : `# ${examTitle} — 解答卷`;
  const lines = [
    title,
    "",
    `- **科目名稱**：${subject.name}`,
    `- **出題日期**：${date.zh}`,
    `- **作答時間**：${EXAM_DURATION_MINUTES} 分鐘`,
    `- **總分**：100 分`,
  ];
  if (kind === "exam") {
    lines.push(
      "",
      "**作答說明 / Instructions：**",
      "1. 本試題總分 100 分，請將答案依序書寫於答案卷上，並標明題號與子題編號。",
      "2. 計算題須列出計算過程，證明題須寫出完整推導。",
      "3. 不得使用電子計算機。",
      "",
      "---",
    );
  } else {
    lines.push("- **說明**：本解答卷含逐題解答、計分明細表、評分標準與計分表四部分。", "", "---");
  }
  return lines.join("\n");
}

export interface ParsedProblem {
  no: number;
  points: number;
  title: string;
  subs: { label: string; points: number }[];
}

const PROBLEM_RE = /^##\s+(\d+)\.\s*\((\d+)%\)\s*(.*)$/;
const SUB_RE = /^\*\*\(([a-z])\)\s*\((\d+)%\)\*\*/;

export function parseProblems(md: string): ParsedProblem[] {
  const problems: ParsedProblem[] = [];
  let inFence = false;
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("```")) inFence = !inFence;
    if (inFence) continue;
    const p = line.match(PROBLEM_RE);
    if (p) {
      problems.push({ no: Number(p[1]), points: Number(p[2]), title: p[3].trim(), subs: [] });
      continue;
    }
    const s = line.match(SUB_RE);
    if (s && problems.length > 0) problems[problems.length - 1].subs.push({ label: s[1], points: Number(s[2]) });
  }
  return problems;
}

/** 檢查配分與禁用字樣，回傳問題清單（空陣列代表通過） */
export function validateExamBody(md: string): string[] {
  const issues: string[] = [];
  const problems = parseProblems(md);
  if (problems.length < 6 || problems.length > 8) {
    issues.push(`大題數為 ${problems.length}，必須是 6–8 題（大題標題格式必須為 "## 1. (12%) Title"）`);
  }
  const total = problems.reduce((sum, p) => sum + p.points, 0);
  if (total !== 100) issues.push(`各大題配分總和為 ${total}，必須剛好 100`);
  for (const p of problems) {
    if (p.subs.length === 0) continue;
    const subTotal = p.subs.reduce((sum, s) => sum + s.points, 0);
    if (subTotal !== p.points) issues.push(`第 ${p.no} 大題標示 ${p.points}%，但子題配分加總為 ${subTotal}%`);
  }
  if (SCHOOL_NAME_PATTERN.test(md)) issues.push("內容出現學校名稱，卷面不得出現任何學校名稱");
  if (hasMergedTable(md)) issues.push("有表格的多列被寫在同一行，每個表格列必須各佔一行，且表格前後要空一行");
  return issues;
}

function describePlan(plan: ExamPlan): string {
  const topics = plan.topics.map((t) => `- ${t.name}: ${t.weight} points (${t.focus})`).join("\n");
  return `Topic weights (points out of 100; each topic's total should be within ±3 of its target):\n${topics}\n\nQuestion-type mix by points: computation ${plan.mix.calc}%, proof/design ${plan.mix.proof}%, concept judgement ${plan.mix.concept}%.\nDifficulty mix by points: basic 30%, medium 40%, advanced 30%.`;
}

function buildExamPrompt(subject: Subject, schools: School[], plan: ExamPlan): string {
  const styles =
    schools.length > 0
      ? `Blend the following paper styles roughly equally (style hints only; never name any school):\n${schools.map((s) => `- ${s.style}`).join("\n")}`
      : "Use a neutral, standard entrance-exam style.";
  return `Write the problem body of a mock graduate-entrance exam paper for the subject "${subject.name}".

${describePlan(plan)}

${styles}

Hard requirements:
- Total 100 points, 6–8 major problems. A strong candidate must be able to finish in ${EXAM_DURATION_MINUTES} minutes, so calibrate length and difficulty accordingly.
- Write the problems in English.
- Output ONLY the problem body as Markdown. No title, no header block, no instructions, no preface or closing remarks, no hints, no solutions. The application adds the title and header itself.
- Never mention any school, university, exam board, or the words "past exam". The paper must be an original composition: do not copy published exam problems; use fresh numbers and scenarios.
- Each major problem starts with an H2 heading in EXACTLY this form: "## 1. (12%) Short topic title". The percentages of all major problems must sum to exactly 100.
- Sub-questions start a line with EXACTLY this form: "**(a) (4%)** question text". The sub-question percentages of a problem must sum to that problem's percentage. A problem without sub-questions is fine.
- Multi-select / single-choice options are listed as bullet items "- (i) ...", "- (ii) ...". State the scoring rule when relevant (e.g. all correct choices required).
- Math uses LaTeX: $...$ inline and $$...$$ for display. A literal dollar sign must be written as \\$. Pseudocode goes in fenced code blocks.
- Tables must be valid GitHub-flavored Markdown: a header row, a "|---|---|" separator row, every row on its own line, and a blank line before and after the table.
- Every problem must be well-posed with a unique, verifiable answer.`;
}

export interface GeneratedExam {
  /** 題目本文（不含卷頭），用戶端在後續步驟會原樣帶回 */
  body: string;
  problems: ParsedProblem[];
  warnings: string[];
  plan: ExamPlan;
}

/** 卷頭（程式產生）+ 題目本文，即試題卷 Markdown */
export function buildExamMarkdown(subject: Subject, dateIso: string, body: string): string {
  return `${buildExamHeader(subject, dateFromIso(dateIso), "exam")}\n\n${body}\n`;
}

/** 第一步：出題。回傳題目本文與解析出的大題結構；配分不對時自動請模型重寫一次 */
export async function generateExamBody(opts: {
  apiKey: string;
  subject: Subject;
  schools: School[];
  sessionId: string;
  signal?: AbortSignal;
}): Promise<GeneratedExam> {
  const { apiKey, subject, schools, sessionId, signal } = opts;
  const plan = buildPlan(subject, schools);
  const warnings: string[] = [];

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildExamPrompt(subject, schools, plan) },
  ];

  let body = stripCodeFence(await retryOnce(() => chatCompletion({ apiKey, messages, sessionId, signal }), signal));

  // 配分不對是試卷的根本缺陷，自動請模型修正一次
  const issues = validateExamBody(body);
  if (issues.length > 0) {
    const retryMessages: ChatMessage[] = [
      ...messages,
      { role: "assistant", content: body },
      {
        role: "user",
        content: `The paper has these problems:\n${issues.map((i) => `- ${i}`).join("\n")}\n\nRewrite the complete problem body with all of them fixed, following every original requirement. Output only the Markdown body.`,
      },
    ];
    body = stripCodeFence(
      await retryOnce(() => chatCompletion({ apiKey, messages: retryMessages, sessionId, signal }), signal),
    );
    warnings.push(...validateExamBody(body).map((i) => `試題檢查未通過：${i}，請人工確認或重新生成`));
  }

  return { body, problems: parseProblems(body), warnings, plan };
}
