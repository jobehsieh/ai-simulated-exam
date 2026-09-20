import Link from "next/link";
import { EXAM_DURATION_MINUTES, EXAM_YEAR, SCHOOLS, SUBJECTS } from "@/lib/exam-config";

function SectionHead({ eyebrow, title, desc }: { eyebrow: string; title: React.ReactNode; desc?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="font-display text-xl italic text-vermilion">{eyebrow}</p>
      <h2 className="mt-2 font-serif text-3xl font-black leading-snug tracking-tight sm:text-[2.6rem]">{title}</h2>
      {desc && <p className="mt-4 text-base leading-[1.85] text-ink-soft">{desc}</p>}
    </div>
  );
}

const CARD = "rounded-2xl border border-ink/15 p-7 shadow-[0_1px_0_rgb(28_26_22/0.06)]";

/* ─────────────────────────────── 功能特色 ─────────────────────────────── */

const dsa = SUBJECTS.find((s) => s.id === "dsa")!;
const MIX_LEGEND = [
  { key: "calc", label: "計算", bar: "bg-ink text-paper" },
  { key: "proof", label: "證明／設計", bar: "bg-indigo text-paper" },
  { key: "concept", label: "概念", bar: "bg-marker text-ink" },
] as const;

export function Features() {
  return (
    <section id="features" className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
      <SectionHead
        eyebrow="Features"
        title={
          <>
            出題有依據，
            <br />
            卷面像<span className="marker">真的考卷</span>。
          </>
        }
        desc="不是隨機丟幾道題。每一份試卷都先算好各主題的配分，再交給 AI 撰寫，最後由程式核對配分與卷面。"
      />

      <div className="mt-14 grid gap-5 md:grid-cols-6">
        {/* 權重出題 */}
        <article className={`${CARD} bg-sheet md:col-span-3`}>
          <p className="font-mono text-xs font-medium text-vermilion">01 · WEIGHTED</p>
          <h3 className="mt-3 font-serif text-2xl font-bold">依主題權重分配配分</h3>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            以「{dsa.name}」為例，高頻主題拿到更多配分，總和固定 100 分。
          </p>
          <ul className="mt-6 space-y-2.5">
            {dsa.topics.map((t, i) => (
              <li key={t.name} className="grid grid-cols-[6.6rem_1fr_2rem] items-center gap-3 text-[13px]">
                <span className="truncate text-ink/85">{t.name}</span>
                <span className="h-2.5 rounded-full bg-ink/8">
                  <span
                    className={`block h-full rounded-full ${i === 0 ? "bg-vermilion" : "bg-ink/75"}`}
                    style={{ width: `${(t.weight / 20) * 100}%` }}
                  />
                </span>
                <span className="text-right font-mono text-xs text-ink-soft">{t.weight}</span>
              </li>
            ))}
          </ul>
        </article>

        {/* 各校風格 */}
        <article className={`${CARD} bg-sheet md:col-span-3`}>
          <p className="font-mono text-xs font-medium text-vermilion">02 · STYLES</p>
          <h3 className="mt-3 font-serif text-2xl font-bold">參照各校的出題形式</h3>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            不同學校偏好不同題型。可複選，多校時自動平均混合。
          </p>
          <ul className="mt-6 space-y-4">
            {SCHOOLS.map((s) => (
              <li key={s.id}>
                <p className="mb-1.5 text-[13px] font-medium">{s.name}</p>
                <div className="flex h-7 overflow-hidden rounded-md text-[11px] font-medium leading-7">
                  {MIX_LEGEND.map((m) => (
                    <span key={m.key} className={`${m.bar} text-center`} style={{ width: `${s.mix[m.key]}%` }}>
                      {s.mix[m.key] >= 15 ? s.mix[m.key] : ""}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-soft">
            {MIX_LEGEND.map((m) => (
              <span key={m.key} className="inline-flex items-center gap-1.5">
                <span className={`size-2.5 rounded-sm ${m.bar.split(" ")[0]}`} />
                {m.label}（%）
              </span>
            ))}
          </div>
        </article>

        {/* 解答卷 */}
        <article className={`${CARD} bg-sheet md:col-span-2`}>
          <p className="font-mono text-xs font-medium text-vermilion">03 · ANSWER KEY</p>
          <h3 className="mt-3 font-serif text-xl font-bold">附完整解答卷</h3>
          <ol className="mt-5 space-y-3 text-sm">
            {["逐題解答", "計分明細表", "評分標準 Rubric", "計分表"].map((t, i) => (
              <li key={t} className="flex items-center gap-3">
                <span className="grid size-6 place-items-center rounded-full border border-ink/25 font-display text-sm italic">
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
        </article>

        {/* 匿名卷面 */}
        <article className={`${CARD} bg-sheet md:col-span-2`}>
          <p className="font-mono text-xs font-medium text-vermilion">04 · CLEAN HEADER</p>
          <h3 className="mt-3 font-serif text-xl font-bold">乾淨的統一卷面</h3>
          <p className="mt-4 text-sm leading-[1.85] text-ink-soft">
            標題不含學校名稱，固定為「{EXAM_YEAR} 學年度」，加註出題日期，作答時間 {EXAM_DURATION_MINUTES} 分鐘。
            公式以 LaTeX 排版，A4 輸出並附頁碼。
          </p>
        </article>

        {/* 預覽確認 */}
        <article className={`${CARD} bg-ink text-paper md:col-span-2`}>
          <p className="font-mono text-xs font-medium text-marker">05 · YOU DECIDE</p>
          <h3 className="mt-3 font-serif text-xl font-bold">確認了才存檔</h3>
          <p className="mt-4 text-sm leading-[1.85] text-paper/70">
            生成後先在頁面預覽試題卷與解答卷。內容有問題就重新生成，滿意再按下確認，才會存進對應科目資料夾。
          </p>
        </article>
      </div>
    </section>
  );
}

/* ─────────────────────────────── 使用流程 ─────────────────────────────── */

const STEPS = [
  { n: "01", title: "選擇科目", desc: "資料結構與演算法、線性代數、離散數學、作業系統、計算機組織與結構，可一次選多科。" },
  { n: "02", title: "勾選參照風格", desc: "選一所或多所學校，系統依其題型偏好調整比例。只列出該科有考古題的學校。" },
  { n: "03", title: "AI 出題與解題", desc: "先排定各題配分，再撰寫試題；解答卷逐題並行生成。每科約 3–4 分鐘，過程即時顯示。" },
  { n: "04", title: "預覽並存檔", desc: "確認卷面無誤後儲存。試題卷與解答卷各一份 PDF，放進該科資料夾。" },
];

export function Steps() {
  return (
    <section id="how" className="border-y border-ink/15 bg-paper-deep/60">
      <div className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
        <SectionHead eyebrow="How it works" title={<>四個步驟，<span className="pen-underline">一份考卷</span>。</>} />
        <ol className="mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="relative border-t-2 border-ink pt-5">
              <span className="font-display text-6xl italic leading-none text-vermilion">{s.n}</span>
              <h3 className="mt-4 font-serif text-xl font-bold">{s.title}</h3>
              <p className="mt-3 text-sm leading-[1.85] text-ink-soft">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─────────────────────────────── 常見問題 ─────────────────────────────── */

const FAQS = [
  {
    q: "配分與題型的權重從哪裡來？",
    a: "各科主題比例來自 mock-exam-generator 出題規格（依考古題整理的主題頻率制定），再依你勾選的學校調整題型比例與少數主題的加成，並正規化為 100 分。目前不會逐份解析掃描版的考古題 PDF；考古題資料夾用來決定哪些學校可選。",
  },
  {
    q: "卷面會出現學校名稱嗎？",
    a: "不會。卷頭由程式產生，只有「學年度、科目、出題日期、作答時間」；生成後還會檢查內容是否出現校名，出現就請模型改寫。",
  },
  {
    q: "AI 出的題目與解答一定正確嗎？",
    a: "不保證。所以流程設計成「先預覽、再確認」，並在有配分或格式疑慮時顯示警告。重要題目請自行驗算，不合意就重新生成。",
  },
  {
    q: "生成一份要多久？",
    a: "每科約 3–4 分鐘，多科會依序進行。等待期間頁面會顯示目前階段與完成題數，也可以隨時取消。",
  },
  {
    q: "檔案存在哪裡？",
    a: "確認後存入「模擬考題\\{科目}\\」資料夾，檔名含日期；同名檔案已存在時自動加流水號，不會覆蓋舊檔。",
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto w-full max-w-4xl px-5 py-24 sm:px-8">
      <SectionHead eyebrow="FAQ" title="使用前，你可能想知道" />
      <div className="mt-12 divide-y divide-ink/15 border-y border-ink/15">
        {FAQS.map((f) => (
          <details key={f.q} className="group py-1">
            <summary className="flex cursor-pointer items-center justify-between gap-6 py-5 font-serif text-lg font-bold focus-visible:outline-2 focus-visible:outline-vermilion">
              {f.q}
              <span
                aria-hidden
                className="faq-icon grid size-8 shrink-0 place-items-center rounded-full border border-ink/25 text-xl font-light leading-none transition-transform"
              >
                +
              </span>
            </summary>
            <p className="max-w-3xl pb-6 text-[15px] leading-[1.9] text-ink-soft">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────── 行動呼籲 ─────────────────────────────── */

export function Cta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <div className="relative overflow-hidden rounded-[28px] bg-vermilion px-8 py-16 text-white sm:px-16 sm:py-20">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-10 select-none font-display text-[16rem] italic leading-none text-white/10"
        >
          100
        </span>
        <div className="relative max-w-2xl">
          <h2 className="font-serif text-3xl font-black leading-snug sm:text-5xl">
            今天就出一份，
            <br />
            考前的最後一哩路。
          </h2>
          <p className="mt-5 text-base leading-[1.85] text-white/85">
            挑一科、選一種風格，幾分鐘後拿到可以直接列印的試題卷與解答卷。
          </p>
          <Link
            href="/studio"
            className="group mt-9 inline-flex items-center gap-3 rounded-full bg-paper px-8 py-4 text-base font-bold text-ink transition-colors hover:bg-marker focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            進入出題工作台
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
