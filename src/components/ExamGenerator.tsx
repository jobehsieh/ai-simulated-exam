"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiKeyHeaders, openApiKeyDialog, useApiKey } from "@/lib/api-key-client";

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
  outputDir: string;
  schools: { id: string; name: string }[];
  subjects: { id: string; name: string; archive: ArchiveEntry[]; plan: { topics: PlanTopic[] } }[];
}

interface SubjectResult {
  state: "running" | "done" | "error" | "saved";
  message: string;
  draftId?: string;
  warnings: string[];
  plan?: { topics: PlanTopic[]; mix: { calc: number; proof: number; concept: number } };
  usedSchools?: string[];
  saved?: { folder: string; examPath: string; answerPath: string };
}

const STAGE_LABEL: Record<string, string> = {
  exam: "出題中",
  "exam-retry": "配分不符，重新出題中",
  solution: "撰寫解答卷中",
};

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

  useEffect(() => {
    fetch("/simulated-exam")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setOptions)
      .catch((e) => setLoadError(`讀取選項失敗：${e.message}`));
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
    setRunning(true);
    setGlobalError("");
    setResults({});
    setPreview({});
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/simulated-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...apiKeyHeaders(apiKey) },
        body: JSON.stringify({ subjects, schools }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) openApiKeyDialog();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const handle = (line: string) => {
        if (!line.trim()) return;
        const ev = JSON.parse(line);
        if (ev.type === "status") patch(ev.subject, { state: "running", message: ev.message });
        else if (ev.type === "progress") {
          const count = ev.total ? `${ev.done}/${ev.total} 題完成，` : "";
          patch(ev.subject, {
            state: "running",
            message: `${STAGE_LABEL[ev.stage] ?? "處理中"}（${count}已收到 ${ev.contentChars} 字${ev.contentChars === 0 ? "，模型思考中" : ""}）`,
          });
        } else if (ev.type === "done") {
          patch(ev.subject, {
            state: "done",
            message: "已生成，請預覽並確認",
            draftId: ev.id,
            warnings: ev.warnings,
            plan: ev.plan,
            usedSchools: ev.schools,
          });
          setPreview((p) => ({ ...p, [ev.subject]: "exam" }));
        } else if (ev.type === "error") {
          patch(ev.subject, { state: "error", message: ev.message });
          if (ev.code === "auth") openApiKeyDialog(); // 金鑰被 OpenCode 拒絕，請使用者更換
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handle);
      }
      handle(buffer);
    } catch (e) {
      if (!controller.signal.aborted) setGlobalError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  async function save(subject: string) {
    const draftId = results[subject]?.draftId;
    if (!draftId) return;
    patch(subject, { message: "儲存中…" });
    const res = await fetch("/simulated-exam/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: draftId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) patch(subject, { message: `儲存失敗：${data.error ?? res.status}` });
    else patch(subject, { state: "saved", message: "已儲存", saved: data });
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
            <dd className="mt-1 break-all leading-relaxed">
              試題卷與解答卷各一份 PDF，確認後存入 {options.outputDir}\{"{科目}"}\
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

              {r.draftId && (
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
                    key={`${r.draftId}-${kind}`}
                    src={`/simulated-exam/preview?id=${r.draftId}&kind=${kind}`}
                    title={`${name}${kind === "exam" ? "試題卷" : "解答卷"}預覽`}
                    className="mt-4 h-[78vh] w-full rounded-xl border border-ink/20 bg-paper-deep shadow-[0_18px_40px_-24px_rgb(28_26_22/0.5)]"
                  />
                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    <button
                      onClick={() => save(id)}
                      disabled={r.state === "saved"}
                      className="rounded-full bg-ink px-7 py-3 text-base font-bold text-paper transition-colors enabled:hover:bg-vermilion disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-vermilion"
                    >
                      確認無誤，儲存到資料夾
                    </button>
                    {r.state !== "saved" && <span className="text-sm text-ink-soft">內容有問題請重新按「生成試題」。</span>}
                  </div>
                  {r.saved && (
                    <p className="mt-4 break-all rounded-xl bg-emerald-700/10 p-4 text-sm leading-relaxed text-emerald-900">
                      已儲存：{r.saved.examPath}
                      <br />
                      已儲存：{r.saved.answerPath}
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
