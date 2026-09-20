// 掃描本機的「資工所考古題」資料夾，產生 src/data/archive-manifest.json（{ 科目資料夾: { 學校: [學年度...] } }）。
// 雲端（Vercel）讀不到本機磁碟，所以年度清單改隨專案附帶；考古題有增減時重新執行：
//   npm run archive:manifest            （預設 D:\d\0-agent\資工所考古題）
//   npm run archive:manifest -- <路徑>   （或設定環境變數 EXAM_ARCHIVE_DIR）
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.argv[2] ?? process.env.EXAM_ARCHIVE_DIR ?? "D:/d/0-agent/資工所考古題";
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "archive-manifest.json");
const SKIP = new Set(["推甄簡章"]);

const manifest = {};
for (const subject of (await readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory() && !SKIP.has(d.name))) {
  for (const school of (await readdir(path.join(root, subject.name), { withFileTypes: true })).filter((d) => d.isDirectory())) {
    const years = new Set();
    for (const file of await readdir(path.join(root, subject.name, school.name))) {
      const m = file.match(/_(\d{3})_/);
      if (m && file.toLowerCase().endsWith(".pdf")) years.add(Number(m[1]));
    }
    if (years.size > 0) {
      manifest[subject.name] ??= {};
      manifest[subject.name][school.name] = [...years].sort((a, b) => a - b);
    }
  }
}

await writeFile(out, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`已寫入 ${out}`);
for (const [subject, schools] of Object.entries(manifest)) {
  console.log(`  ${subject}: ${Object.entries(schools).map(([s, y]) => `${s} ${y[0]}–${y.at(-1)}`).join("、")}`);
}
