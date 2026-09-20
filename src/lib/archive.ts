import manifest from "@/data/archive-manifest.json";
import { SCHOOLS, SUBJECTS, type SchoolId, type Subject, type SubjectId } from "./exam-config";

// 考古題年度清單：{ 科目資料夾: { 學校: [學年度] } }。
// 由 `npm run archive:manifest` 掃描本機考古題資料夾產生並隨專案附帶，
// 這樣部署在雲端（讀不到本機磁碟）時也能知道各科各校有哪些考古題。
const MANIFEST = manifest as Record<string, Record<string, number[]>>;

export interface ArchiveEntry {
  school: SchoolId;
  /** 該科目在考古題資料夾中收錄的學年度 */
  years: number[];
}

/** 某科目各校收錄的學年度（合科考卷也算該科的參考資料） */
export function scanSubjectArchive(subject: Subject): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [];
  for (const school of SCHOOLS) {
    const years = new Set<number>();
    for (const dir of subject.archiveDirs) {
      for (const y of MANIFEST[dir]?.[school.archiveName] ?? []) years.add(y);
    }
    if (years.size > 0) entries.push({ school: school.id, years: [...years].sort((a, b) => a - b) });
  }
  return entries;
}

export function scanAllArchives(): Record<SubjectId, ArchiveEntry[]> {
  const result = {} as Record<SubjectId, ArchiveEntry[]>;
  for (const subject of SUBJECTS) result[subject.id] = scanSubjectArchive(subject);
  return result;
}
