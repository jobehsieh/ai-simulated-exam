import { SCHOOL_NAME_PATTERN, type Subject } from "./exam-config";
import type { ParsedProblem } from "./exam";
import { hasMergedTable, mapPool, retryOnce, stripCodeFence, SYSTEM_PROMPT } from "./llm-utils";
import { chatCompletion } from "./opencode";

const MARK_SOLUTION = "===SOLUTION===";
const MARK_TABLE = "===TABLE===";
const MARK_RUBRIC = "===RUBRIC===";

function buildAnswerPrompt(subject: Subject, examBody: string, problem: ParsedProblem): string {
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

interface SolvedProblem {
  solution: string;
  tableRows: string[];
  rubric: string;
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

export interface AnswerKeyProgress {
  contentChars: number;
  reasoningChars: number;
  done: number;
  total: number;
}

/**
 * 解答卷第一～三部分。每個大題各發一個請求（並行 4 個）：
 * 單次請求短、不易被上游中途切斷，逐題驗算也更專注。第四部分計分表由呼叫端依題目結構產生。
 */
export async function generateAnswerKey(opts: {
  subject: Subject;
  examBody: string;
  problems: ParsedProblem[];
  sessionId: string;
  signal?: AbortSignal;
  onProgress?: (p: AnswerKeyProgress) => void;
}): Promise<{ markdown: string; warnings: string[] }> {
  const { subject, examBody, problems, sessionId, signal, onProgress } = opts;
  const warnings: string[] = [];
  const state = problems.map(() => ({ contentChars: 0, reasoningChars: 0, finished: false }));
  const report = () =>
    onProgress?.({
      contentChars: state.reduce((sum, p) => sum + p.contentChars, 0),
      reasoningChars: state.reduce((sum, p) => sum + p.reasoningChars, 0),
      done: state.filter((p) => p.finished).length,
      total: problems.length,
    });
  report();

  const solved = await mapPool(problems, 4, async (problem, index) => {
    const result = await retryOnce(async () => {
      const text = await chatCompletion({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildAnswerPrompt(subject, examBody, problem) },
        ],
        sessionId,
        signal,
        maxTokens: 16000,
        onProgress: (p) => {
          state[index].contentChars = p.contentChars;
          state[index].reasoningChars = p.reasoningChars;
          report();
        },
      });
      const parsed = parseSolved(text);
      if (!parsed) throw new Error(`第 ${problem.no} 題的解答格式不符`);
      return parsed;
    }, signal);
    state[index].finished = true;
    report();
    return result;
  });

  problems.forEach((problem, index) => {
    const rowPoints = solved[index].tableRows.reduce((sum, row) => sum + (Number(row.split("|")[3]) || 0), 0);
    if (rowPoints !== problem.points) {
      warnings.push(`解答卷第 ${problem.no} 題的計分明細表配分加總為 ${rowPoints}，與試題的 ${problem.points} 不符，請人工確認`);
    }
  });

  const totalPoints = problems.reduce((sum, p) => sum + p.points, 0);
  const markdown = [
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
    ...problems.flatMap((problem, index) => [`### ${problem.no}. (${problem.points}%) ${problem.title}`, "", solved[index].rubric, ""]),
  ].join("\n");

  if (SCHOOL_NAME_PATTERN.test(markdown)) warnings.push("解答卷內容出現學校名稱，請人工確認");
  return { markdown, warnings };
}
