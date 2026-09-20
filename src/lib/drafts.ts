import { randomUUID } from "node:crypto";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EXAM_YEAR, getSubject } from "./exam-config";
import { OUTPUT_DIR } from "./archive";

const DRAFT_ROOT = path.join(os.tmpdir(), "ai-simulated-exam-drafts");
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface DraftMeta {
  subjectId: string;
  /** 檔名用日期 yyyymmdd */
  dateCompact: string;
}

const draftDir = (id: string) => path.join(DRAFT_ROOT, id);

export function isValidDraftId(id: string | null | undefined): id is string {
  return typeof id === "string" && ID_RE.test(id);
}

/** 暫存尚未確認的試卷，使用者確認後才寫入正式資料夾 */
export async function createDraft(meta: DraftMeta, examPdf: Buffer, answerPdf: Buffer): Promise<string> {
  const id = randomUUID();
  const dir = draftDir(id);
  await mkdir(dir, { recursive: true });
  await Promise.all([
    writeFile(path.join(dir, "exam.pdf"), examPdf),
    writeFile(path.join(dir, "answer.pdf"), answerPdf),
    writeFile(path.join(dir, "meta.json"), JSON.stringify(meta)),
  ]);
  return id;
}

export async function readDraftPdf(id: string, kind: "exam" | "answer"): Promise<Buffer> {
  return readFile(path.join(draftDir(id), `${kind}.pdf`));
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export interface SavedFiles {
  folder: string;
  examPath: string;
  answerPath: string;
}

/** 把草稿存入「模擬考題\{科目}\」，檔名已存在時加流水號，不覆蓋舊檔 */
export async function saveDraft(id: string): Promise<SavedFiles> {
  const meta = JSON.parse(await readFile(path.join(draftDir(id), "meta.json"), "utf8")) as DraftMeta;
  const subject = getSubject(meta.subjectId);
  if (!subject) throw new Error("草稿的科目資料無效");

  const folder = path.join(OUTPUT_DIR, subject.name);
  await mkdir(folder, { recursive: true });

  const base = `${subject.name}_${EXAM_YEAR}學年度模擬試題_${meta.dateCompact}`;
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? "" : `_${n}`;
    const examPath = path.join(folder, `${base}${suffix}.pdf`);
    const answerPath = path.join(folder, `${base}${suffix}_解答卷.pdf`);
    if ((await exists(examPath)) || (await exists(answerPath))) continue;
    await copyFile(path.join(draftDir(id), "exam.pdf"), examPath);
    await copyFile(path.join(draftDir(id), "answer.pdf"), answerPath);
    return { folder, examPath, answerPath };
  }
}
