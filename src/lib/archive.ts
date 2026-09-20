import { readdir } from "node:fs/promises";
import path from "node:path";
import { SCHOOLS, SUBJECTS, type SchoolId, type Subject, type SubjectId } from "./exam-config";

export const ARCHIVE_DIR = process.env.EXAM_ARCHIVE_DIR ?? "D:\\d\\0-agent\\資工所考古題";
export const OUTPUT_DIR = process.env.EXAM_OUTPUT_DIR ?? "D:\\d\\0-agent\\模擬考題";

export interface ArchiveEntry {
  school: SchoolId;
  /** 該科目在考古題資料夾中找到的學年度 */
  years: number[];
}

async function listDir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

/** 掃描考古題資料夾，回傳某科目各校有哪些學年度的考古題 */
export async function scanSubjectArchive(subject: Subject): Promise<ArchiveEntry[]> {
  const entries: ArchiveEntry[] = [];
  for (const school of SCHOOLS) {
    const years = new Set<number>();
    for (const dir of subject.archiveDirs) {
      // 路徑來自使用者設定的外部資料夾，不是專案檔案，告訴打包器不必追蹤整個專案
      const files = await listDir(path.join(/* turbopackIgnore: true */ ARCHIVE_DIR, dir, school.archiveName));
      for (const file of files) {
        const m = file.match(/_(\d{3})_/);
        if (m && file.toLowerCase().endsWith(".pdf")) years.add(Number(m[1]));
      }
    }
    if (years.size > 0) entries.push({ school: school.id, years: [...years].sort((a, b) => a - b) });
  }
  return entries;
}

export async function scanAllArchives(): Promise<Record<SubjectId, ArchiveEntry[]>> {
  const result = {} as Record<SubjectId, ArchiveEntry[]>;
  for (const subject of SUBJECTS) result[subject.id] = await scanSubjectArchive(subject);
  return result;
}
