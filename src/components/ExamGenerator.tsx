"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { openApiKeyDialog, useApiKey } from "@/lib/api-key-client";
import { ApiError, runSubject, type PlanInfo } from "@/lib/exam-client";
import {
  chooseSaveFolder,
  forgetSavedFolder,
  getSavedFolderName,
  isFolderSaveSupported,
  savePdfs,
} from "@/lib/save-client";

interface ArchiveEntry {
  school: string;
  years: number[];
}
interface PlanTopic {
  name: string;
  weight: number;
}
interface Options {
  year: number;
  durationMinutes: number;
  schools: { id: string; name: string }[];
  subjects: { id: string; name: string; archive: ArchiveEntry[]; plan: { topics: PlanTopic[] } }[];
}

interface SubjectFiles {
  examPdf: Blob;
  answerPdf: Blob;
  /** 供預覽（iframe）與下載使用的 blob 網址 */
  examUrl: string;
  answerUrl: string;
  /** 檔名主體（不含 .pdf 與流水號） */
  base: string;
}

interface SubjectResult {
  state: "running" | "done" | "error" | "saved";
  message: string;
  warnings: string[];
  plan?: PlanInfo;
  usedSchools?: string[];
  files?: SubjectFiles;
  savedPaths?: string[];
  savedMode?: "folder" | "download";
}

const yearRange = (years: number[]) => (years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : `${years[0]}`);

/* ── 共用樣式 ── */
const PANEL = "rounded-2xl border border-ink/15 bg-sheet p-6 shadow-[0_1px_0_rgb(28_26_22/0.06)] sm:p-8";
const FOCUS = "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-vermilion";

function StepHeading({ n, title, hint }: { n: string; title: string; hint?: string }) {
  return (
    <div className="mb-6 flex items-baseline gap-4">
      <span className="font-display text-4xl italic leading-none text-vermilion">{n}</span>
      <div>
        <h2 className="font-serif text-xl font-bold sm:text-2xl">{title}</h2>
        {hint && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{hint}</p>}
      </div>
    </div>
  );
}

function CheckMark() {
  return (
    <span
      aria-hidden
      className="grid size-5 shrink-0 place-items-center rounded-[5px] border-2 border-ink/35 bg-white transition-colors group-has-checked:border-vermilion group-has-checked:bg-vermilion"
    >
      <svg viewBox="0 0 12 12" className="size-3 text-white opacity-0 transition-opacity group-has-checked:opacity-100">
        <path d="M2 6.5 4.8 9 10 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function ExamGenerator() {
  const [options, setOptions] = useState<Options | null>(null);
  const [loadError, setLoadError] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [schools, setSchools] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, SubjectResult>>({});
  const [globalError, setGlobalError] = useState("");
  const [preview, setPreview] = useState<Record<string, "exam" | "answer">>({});
  const abortRef = useRef<AbortController | null>(null);
  const apiKey = useApiKey();
  const [folderName, setFolderName] = useState<string | null>(null);
  // 元件在選項載入後才會顯示，所以用初始化函式判斷瀏覽器能力不會造成水合不一致
  const [folderSupported] = useState(isFolderSaveSupported);
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    fetch("/simulated-exam")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setOptions)
      .catch((e) => setLoadError(`讀取選項失敗：${e.message}`));
    void getSavedFolderName().then(setFolderName);
    const urls = urlsRef;
    return () => urls.current.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const patch = useCallback((subject: string, update: Partial<SubjectResult>) => {
    setResults((prev) => {
      const base: SubjectResult = prev[subject] ?? { state: "running", message: "", warnings: [] };
      return { ...prev, [subject]: { ...base, ...update } };
    });
  }, []);

  async function generate() {
    if (!options || subjects.length === 0) return;
    // BYOK：沒有金鑰就先請使用者設定
    if (!apiKey) {
      openApiKeyDialog();
      return;
    }
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    setRunning(true);
    setGlobalError("");
    setResults({});
    setPreview({});
    const controller = new AbortController();
    abortRef.current = controller;

    // 多科依序進行；每一科的流程由 runSubject 以多個短請求接力完成（適合無伺服器平台的時限）
    for (const subjectId of subjects) {
      if (controller.signal.aborted) break;
      const subjectName = options.subjects.find((s) => s.id === subjectId)?.name ?? subjectId;
      patch(subjectId, { state: "running", message: "準備中…" });
      try {
        const run = await runSubject({
          apiKey,
          subjectId,
          schoolIds: schools,
          signal: controller.signal,
          onStatus: (message) => patch(subjectId, { state: "running", message }),
        });
        const examUrl = URL.createObjectURL(run.examPdf);
        const answerUrl = URL.createObjectURL(run.answerPdf);
        urlsRef.current.push(examUrl, answerUrl);
        patch(subjectId, {
          state: "done",
          message: "已生成，請預覽並確認",
          warnings: run.warnings,
          plan: run.plan,
          usedSchools: run.usedSchools,
          files: {
            examPdf: run.examPdf,
            answerPdf: run.answerPdf,
            examUrl,
            answerUrl,
            base: `${subjectName}_${options.year}學年度模擬試題_${run.dateCompact}`,
          },
        });
        setPreview((p) => ({ ...p, [subjectId]: "exam" }));
      } catch (e) {
        if (controller.signal.aborted) {
          patch(subjectId, { state: "error", message: "已取消" });
          break;
        }
        patch(subjectId, { state: "error", message: e instanceof Error ? e.message : String(e) });
        if (e instanceof ApiError && e.isKeyProblem) {
          openApiKeyDialog(); // 金鑰需要（重新）設定；後面的科目也一定會失敗，直接結束
          break;
        }
      }
    }
    setRunning(false);
    abortRef.current = null;
  }

  async function save(subjectId: string, subjectName: string) {
    const files = results[subjectId]?.files;
    if (!files) return;
    patch(subjectId, { message: "儲存中…" });
    try {
      const saved = await savePdfs(subjectName, files.base, [
        { tail: ".pdf", blob: files.examPdf },
        { tail: "_解答卷.pdf", blob: files.answerPdf },
      ]);
      patch(subjectId, { state: "saved", message: "已儲存", savedPaths: saved.paths, savedMode: saved.mode });
      if (saved.mode === "folder") setFolderName(saved.folderName);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        patch(subjectId, { message: "已取消選擇資料夾，尚未儲存" });
        return;
      }
      patch(subjectId, { message: `儲存失敗：${e instanceof Error ? e.message : String(e)}` });
    }
  }

  async function changeFolder() {
    try {
      setFolderName(await chooseSaveFolder());
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setGlobalError(e instanceof Error ? e.message : String(e));
    }
  }

  async function clearFolder() {
    await forgetSavedFolder();
    setFolderName(null);
  }

  if (loadError) return <p className="rounded-xl border border-vermilion/40 bg-vermilion/5 p-5 text-vermilion">{loadError}</p>;
  if (!options) return <p className="py-16 text-center font-display text-2xl italic text-ink-soft">Loading…</p>;

  const availableSchools = new Set(
    options.subjects.filter((s) => subjects.includes(s.id)).flatMap((s) => s.archive.map((a) => a.school)),
  );
  const schoolName = (id: string) => options.schools.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-6">
      {/* 尚未設定 API 金鑰（BYOK） */}
      {apiKey === null && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-vermilion/40 bg-vermilion/[0.06] p-5 sm:px-8">
          <div>
            <h2 className="font-serif text-lg font-bold">先設定你的 API 金鑰</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              本服務採 BYOK：出題使用你自己的 OpenCode Go 金鑰，只存在這個瀏覽器，不會上傳保存。
            </p>
          </div>
          <button
            onClick={openApiKeyDialog}
            className="rounded-full bg-vermilion px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-ink"
          >
            設定金鑰
          </button>
        </section>
      )}

      {/* 01 科目 */}
      <section className={PANEL}>
        <StepHeading n="01" title="選擇科目" hint="可複選，多科會依序生成，每科各自產出一組試題卷與解答卷。" />
        <div className="grid gap-3 sm:grid-cols-2">
          {options.subjects.map((s) => (
            <label
              key={s.id}
              className={`group flex cursor-pointer items-start gap-3.5 rounded-xl border border-ink/15 bg-white/60 p-4 transition-all hover:border-ink/40 has-checked:border-vermilion has-checked:bg-vermilion/[0.06] has-checked:shadow-[0_0_0_1px_var(--vermilion)] has-disabled:cursor-not-allowed has-disabled:opacity-60 ${FOCUS}`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={subjects.includes(s.id)}
                disabled={running}
                onChange={() => toggle(subjects, setSubjects, s.id)}
              />
              <span className="mt-0.5">
                <CheckMark />
              </span>
              <span className="min-w-0">
                <span className="block font-serif text-lg font-bold leading-snug">{s.name}</span>
                <span className="mt-1 block text-xs leading-relaxed text-ink-soft">
                  考古題
                  {s.archive.length === 0
                    ? "無資料"
                    : s.archive.map((a) => `${schoolName(a.school)} ${yearRange(a.years)}`).join("・")}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* 02 學校風格 */}
      <section className={PANEL}>
        <StepHeading
          n="02"
          title="參照學校的出題形式"
          hint="可複選；依所選學校調整題型比例與主題權重，多校時平均混合。卷面不會出現學校名稱。"
        />
        <div className="flex flex-wrap gap-3">
          {options.schools.map((s) => {
            const enabled = subjects.length === 0 || availableSchools.has(s.id);
            return (
              <label
                key={s.id}
                className={`group flex items-center gap-3 rounded-full border px-5 py-2.5 text-[15px] font-medium transition-all ${FOCUS} ${
                  enabled
                    ? "cursor-pointer border-ink/20 bg-white/60 hover:border-ink/50 has-checked:border-ink has-checked:bg-ink has-checked:text-paper"
                    : "cursor-not-allowed border-dashed border-ink/15 text-ink/35"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={schools.includes(s.id)}
                  disabled={running || !enabled}
                  onChange={() => toggle(schools, setSchools, s.id)}
                />
                <span
                  aria-hidden
                  className={`size-2.5 rounded-full border-2 transition-colors ${
                    enabled ? "border-current group-has-checked:border-marker group-has-checked:bg-marker" : "border-current"
                  }`}
                />
                {s.name}
                {!enabled && <span className="text-xs font-normal">（所選科目無考古題）</span>}
              </label>
            );
          })}
        </div>
        {schools.length === 0 && (
          <p className="mt-4 text-sm text-ink-soft">未勾選任何學校時，使用基準規格（計算 40％ / 證明設計 40％ / 概念 20％）。</p>
        )}
      </section>

      {/* 03 卷面與生成 */}
      <section className={PANEL}>
        <StepHeading n="03" title="卷面設定與生成" />
        <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-mono text-xs text-vermilion">TITLE</dt>
            <dd className="mt-1 leading-relaxed">{options.year} 學年度碩士班入學考試模擬試題，不含學校名稱，加註出題日期</dd>
          </div>
          <div>
            <dt className="font-mono text-xs text-vermilion">TIME / SCORE</dt>
            <dd className="mt-1 leading-relaxed">作答 {options.durationMinutes} 分鐘・總分 100 分</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-mono text-xs text-vermilion">OUTPUT</dt>
            <dd className="mt-1 leading-relaxed">
              試題卷與解答卷各一份 PDF。確認後存入你選擇的資料夾，並自動依科目建立子資料夾（建議選「模擬考題」）。
            </dd>
            <dd className="mt-3 flex flex-wrap items-center gap-3">
              {folderSupported ? (
                <>
                  <span className="rounded-full border border-ink/15 bg-white/70 px-4 py-1.5">
                    {folderName ? `儲存資料夾：${folderName}` : "尚未選擇資料夾（第一次儲存時會請你選擇）"}
                  </span>
                  <button
                    onClick={changeFolder}
                    disabled={running}
                    className="rounded-full border border-ink/30 px-4 py-1.5 font-medium transition-colors enabled:hover:border-ink enabled:hover:bg-ink enabled:hover:text-paper disabled:opacity-40"
                  >
                    {folderName ? "更換資料夾" : "選擇資料夾"}
                  </button>
                  {folderName && (
                    <button
                      onClick={clearFolder}
                      className="text-vermilion underline decoration-vermilion/40 underline-offset-4 hover:decoration-vermilion"
                    >
                      忘記資料夾
                    </button>
                  )}
                </>
              ) : (
                <span className="text-ink-soft">你的瀏覽器不支援指定資料夾（請用 Edge / Chrome），儲存時會改為下載檔案。</span>
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-ink/15 pt-6">
          <button
            onClick={generate}
            disabled={running || subjects.length === 0}
            className="group inline-flex items-center gap-3 rounded-full bg-vermilion px-8 py-3.5 text-base font-bold text-white shadow-[0_6px_0_-2px_rgb(120_28_14)] transition-all enabled:hover:translate-y-0.5 enabled:hover:shadow-[0_4px_0_-2px_rgb(120_28_14)] enabled:active:translate-y-1.5 enabled:active:shadow-none disabled:cursor-not-allowed disabled:bg-ink/25 disabled:shadow-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
          >
            {running ? "生成中…" : "生成試題"}
            {!running && (
              <span aria-hidden className="transition-transform group-enabled:group-hover:translate-x-1">
                →
              </span>
            )}
          </button>
          {running && (
            <button
              onClick={() => abortRef.current?.abort()}
              className="rounded-full border border-ink/30 px-5 py-3 text-sm font-medium transition-colors hover:border-ink hover:bg-ink hover:text-paper"
            >
              取消
            </button>
          )}
          <span className="text-sm text-ink-soft">
            {subjects.length === 0
              ? "請先選擇至少一個科目"
              : apiKey === null
                ? "尚未設定 API 金鑰，按下後會先請你設定"
                : "每科約需 3–4 分鐘，依序生成"}
          </span>
        </div>
        {globalError && <p className="mt-4 rounded-lg bg-vermilion/10 p-3 text-sm text-vermilion">{globalError}</p>}
      </section>

      {/* 結果 */}
      {subjects
        .filter((id) => results[id])
        .map((id) => {
          const r = results[id];
          const name = options.subjects.find((s) => s.id === id)?.name ?? id;
          const kind = preview[id] ?? "exam";
          const badge =
            r.state === "error"
              ? "bg-vermilion/10 text-vermilion"
              : r.state === "saved"
                ? "bg-emerald-700/10 text-emerald-800"
                : r.state === "done"
                  ? "bg-indigo/10 text-indigo"
                  : "bg-marker/50 text-ink";
          return (
            <section key={id} className={PANEL}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="font-serif text-2xl font-black">{name}</h2>
                <span className={`inline-flex max-w-full items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${badge}`}>
                  {r.state === "running" && <span className="size-2 shrink-0 animate-pulse rounded-full bg-vermilion" />}
                  <span className="break-words">{r.message}</span>
                </span>
              </div>

              {r.state === "running" && (
                <div className="mt-5 h-1 overflow-hidden rounded-full bg-ink/10">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-vermilion" />
                </div>
              )}

              {r.plan && (
                <p className="mt-4 text-xs leading-[1.9] text-ink-soft">
                  <b className="text-ink">參照</b>　{r.usedSchools && r.usedSchools.length > 0 ? r.usedSchools.join("、") : "基準規格"}
                  <br />
                  <b className="text-ink">題型</b>　計算 {r.plan.mix.calc}％ / 證明設計 {r.plan.mix.proof}％ / 概念 {r.plan.mix.concept}％
                  <br />
                  <b className="text-ink">權重</b>　{r.plan.topics.map((t) => `${t.name} ${t.weight}`).join("・")}
                </p>
              )}

              {r.warnings.length > 0 && (
                <ul className="mt-4 list-inside list-disc rounded-xl border border-marker bg-marker/25 p-4 text-sm leading-relaxed">
                  {r.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}

              {r.files && (
                <>
                  <div className="mt-6 inline-flex rounded-full border border-ink/20 bg-white/60 p-1">
                    {(["exam", "answer"] as const).map((k) => (
                      <button
                        key={k}
                        onClick={() => setPreview((p) => ({ ...p, [id]: k }))}
                        className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
                          kind === k ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
                        }`}
                      >
                        {k === "exam" ? "試題卷" : "解答卷"}
                      </button>
                    ))}
                  </div>
                  <iframe
                    key={`${r.files.base}-${kind}`}
                    src={kind === "exam" ? r.files.examUrl : r.files.answerUrl}
                    title={`${name}${kind === "exam" ? "試題卷" : "解答卷"}預覽`}
                    className="mt-4 h-[78vh] w-full rounded-xl border border-ink/20 bg-paper-deep shadow-[0_18px_40px_-24px_rgb(28_26_22/0.5)]"
                  />
                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    <button
                      onClick={() => save(id, name)}
                      disabled={r.state === "saved"}
                      className="rounded-full bg-ink px-7 py-3 text-base font-bold text-paper transition-colors enabled:hover:bg-vermilion disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-vermilion"
                    >
                      確認無誤，儲存到資料夾
                    </button>
                    {r.state !== "saved" && <span className="text-sm text-ink-soft">內容有問題請重新按「生成試題」。</span>}
                  </div>
                  <p className="mt-3 text-sm text-ink-soft">
                    也可以直接下載：
                    <a
                      href={r.files.examUrl}
                      download={`${r.files.base}.pdf`}
                      className="ml-1 underline underline-offset-4 hover:text-vermilion"
                    >
                      試題卷
                    </a>
                    <span className="mx-1.5">・</span>
                    <a
                      href={r.files.answerUrl}
                      download={`${r.files.base}_解答卷.pdf`}
                      className="underline underline-offset-4 hover:text-vermilion"
                    >
                      解答卷
                    </a>
                  </p>
                  {r.savedPaths && (
                    <p className="mt-4 break-all rounded-xl bg-emerald-700/10 p-4 text-sm leading-relaxed text-emerald-900">
                      {r.savedMode === "download" ? "已下載到瀏覽器的下載資料夾：" : "已儲存："}
                      {r.savedPaths.map((path) => (
                        <span key={path} className="block">
                          {path}
                        </span>
                      ))}
                    </p>
                  )}
                </>
              )}
            </section>
          );
        })}
    </div>
  );
}
