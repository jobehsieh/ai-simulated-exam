import { buildExamHeader, dateFromIso, parseProblems, type ParsedProblem } from "./exam";
import { SCHOOL_NAME_PATTERN, type Subject } from "./exam-config";
import { hasMergedTable, retryOnce, stripCodeFence, SYSTEM_PROMPT } from "./llm-utils";
import { chatCompletion } from "./opencode";

const MARK_SOLUTION = "===SOLUTION===";
const MARK_TABLE = "===TABLE===";
const MARK_RUBRIC = "===RUBRIC===";

/** 解答單一大題所需的題目資訊（由用戶端從出題結果帶回） */
export interface ProblemRef {
  no: number;
  points: number;
  title: string;
}

/** 單一大題的解答，三部分分開保存，最後由 buildAnswerMarkdown 組成完整解答卷 */
export interface SolvedProblem {
  solution: string;
  tableRows: string[];
  rubric: string;
}

function buildAnswerPrompt(subject: Subject, examBody: string, problem: ProblemRef): string {
  return `Below is the full problem body of a mock exam for "${subject.name}". Write the answer key for problem ${problem.no} ONLY (the other problems are given for context). Write in Traditional Chinese (keep technical terms and math in English/LaTeX).

<exam>
${examBody}
</exam>

Output exactly three sections, each introduced by its marker on a line of its own, in this order:

${MARK_SOLUTION}
Start with the heading "### ${problem.no}. (${problem.points}%) ${problem.title}", then for every sub-question use "**(a) (4%)** ..." with the final answer, the full calculation or proof, and for choice / true-false items the correct choices with a short reason. Recompute every number carefully; if the problem statement is ambiguous or flawed, state the reading you adopt explicitly and solve under it.

${MARK_TABLE}
Markdown table rows only (no header row, no separator row), one row per sub-question, or a single row when the problem has no sub-questions, with exactly five cells: | ${problem.no} | (a) | points | 題型 (計算/證明/概念) | 答案要點 |. Use "—" as the sub-question cell when there are no sub-questions. The points of the rows must sum to ${problem.points}.

${MARK_RUBRIC}
Bullet-list scoring rules for this problem: computation — final answer correct X points / correct process but wrong answer Y points / wrong process 0; proof — list the scoring points; concept items — all-or-nothing or partial rule, matching the exam's stated rule.

Markdown tables must have every row on its own line with a blank line before and after. Never mention any school or university name. Math uses LaTeX ($...$ / $$...$$); a literal dollar sign must be written as \\$.`;
}

function parseSolved(text: string): SolvedProblem | null {
  const i1 = text.indexOf(MARK_SOLUTION);
  const i2 = text.indexOf(MARK_TABLE);
  const i3 = text.indexOf(MARK_RUBRIC);
  if (i1 < 0 || i2 < i1 || i3 < i2) return null;
  const solution = stripCodeFence(text.slice(i1 + MARK_SOLUTION.length, i2));
  const rubric = stripCodeFence(text.slice(i3 + MARK_RUBRIC.length));
  const tableRows = text
    .slice(i2 + MARK_TABLE.length, i3)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|") && !/^\|[\s:-]+\|/.test(l));
  if (hasMergedTable(solution) || hasMergedTable(rubric)) return null;
  return solution && rubric && tableRows.length > 0 ? { solution, tableRows, rubric } : null;
}

/** 解答單一大題（一次 LLM 請求，夠短，能在無伺服器函式的時限內完成） */
export async function solveProblem(opts: {
  apiKey: string;
  subject: Subject;
  examBody: string;
  problem: ProblemRef;
  sessionId: string;
  signal?: AbortSignal;
}): Promise<{ solved: SolvedProblem; warnings: string[] }> {
  const { apiKey, subject, examBody, problem, sessionId, signal } = opts;
  const solved = await retryOnce(async () => {
    const text = await chatCompletion({
      apiKey,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildAnswerPrompt(subject, examBody, problem) },
      ],
      sessionId,
      signal,
      maxTokens: 16000,
    });
    const parsed = parseSolved(text);
    if (!parsed) throw new Error(`第 ${problem.no} 題的解答格式不符`);
    return parsed;
  }, signal);

  const warnings: string[] = [];
  const rowPoints = solved.tableRows.reduce((sum, row) => sum + (Number(row.split("|")[3]) || 0), 0);
  if (rowPoints !== problem.points) {
    warnings.push(`解答卷第 ${problem.no} 題的計分明細表配分加總為 ${rowPoints}，與試題的 ${problem.points} 不符，請人工確認`);
  }
  if (SCHOOL_NAME_PATTERN.test(`${solved.solution}\n${solved.rubric}`)) {
    warnings.push(`解答卷第 ${problem.no} 題的內容出現學校名稱，請人工確認`);
  }
  return { solved, warnings };
}

/** 依題目結構與各題解答，組成完整解答卷 Markdown（含由程式產生的計分表） */
export function buildAnswerMarkdown(subject: Subject, dateIso: string, examBody: string, solved: SolvedProblem[]): string {
  const problems = parseProblems(examBody);
  if (problems.length === 0 || problems.length !== solved.length) {
    throw new Error("題目數與解答數不一致，無法組成解答卷");
  }
  const totalPoints = problems.reduce((sum, p) => sum + p.points, 0);

  const key = [
    "## 第一部分：逐題解答",
    "",
    solved.map((r) => r.solution).join("\n\n"),
    "",
    "## 第二部分：計分明細表",
    "",
    "| 題號 | 子題 | 配分 | 題型 | 答案要點 |",
    "|------|------|------|------|----------|",
    ...solved.flatMap((r) => r.tableRows),
    `| **總分** | | **${totalPoints}** | | |`,
    "",
    "## 第三部分：評分標準（Rubric）",
    "",
    ...problems.flatMap((problem: ParsedProblem, index) => [
      `### ${problem.no}. (${problem.points}%) ${problem.title}`,
      "",
      solved[index].rubric,
      "",
    ]),
  ].join("\n");

  const scoreSheet = [
    "## 第四部分：計分表",
    "",
    "| 題號 | 配分 | 得分 |",
    "|------|------|------|",
    ...problems.map((p) => `| ${p.no} | ${p.points} | |`),
    `| **總分** | **${totalPoints}** | |`,
  ].join("\n");

  return `${buildExamHeader(subject, dateFromIso(dateIso), "answer")}\n\n${key}\n${scoreSheet}\n`;
}
