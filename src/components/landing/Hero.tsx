import Link from "next/link";
import { EXAM_DURATION_MINUTES, EXAM_YEAR, SCHOOLS, SUBJECTS } from "@/lib/exam-config";
import PaperMock from "./PaperMock";

const STATS = [
  { value: SUBJECTS.length, unit: "門", label: "資工所科目" },
  { value: SCHOOLS.length, unit: "種", label: "各校出題風格" },
  { value: EXAM_DURATION_MINUTES, unit: "分鐘", label: "標準作答時間" },
  { value: 2, unit: "份", label: "PDF：試題＋解答" },
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:pb-24 lg:pt-20">
        <div>
          <p
            className="animate-rise inline-flex items-center gap-2 rounded-full border border-ink/15 bg-sheet px-4 py-1.5 text-[13px] font-medium text-ink-soft"
            style={{ animationDelay: "0ms" }}
          >
            <span className="size-1.5 rounded-full bg-vermilion" />
            {EXAM_YEAR} 學年度 · 資工所考研備考工具
          </p>

          <h1
            className="animate-rise mt-7 font-serif text-[2rem] font-black leading-[1.22] tracking-tight sm:text-5xl lg:text-[3.4rem]"
            style={{ animationDelay: "80ms" }}
          >
            把考古題的規律，
            <br />
            變成你的<span className="marker">下一張考卷</span>
            <span className="text-vermilion">。</span>
          </h1>

          <p
            className="animate-rise mt-7 max-w-xl text-lg leading-[1.85] text-ink-soft"
            style={{ animationDelay: "160ms" }}
          >
            選好科目、勾選想參照的學校風格，AI 依各科主題權重出題，並附上含計分明細與評分標準的解答卷。
            預覽確認無誤，才存進你的考題資料夾。
          </p>

          <div className="animate-rise mt-9 flex flex-wrap items-center gap-4" style={{ animationDelay: "240ms" }}>
            <Link
              href="/studio"
              className="group inline-flex items-center gap-3 rounded-full bg-vermilion px-8 py-4 text-base font-bold text-white shadow-[0_8px_0_-2px_rgb(120_28_14)] transition-all hover:translate-y-0.5 hover:shadow-[0_5px_0_-2px_rgb(120_28_14)] active:translate-y-2 active:shadow-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
            >
              立即開始出題
              <span aria-hidden className="transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
            <Link
              href="/#how"
              className="rounded-full px-5 py-4 text-base font-medium text-ink underline decoration-ink/30 decoration-2 underline-offset-8 transition-colors hover:decoration-vermilion"
            >
              看看怎麼運作
            </Link>
          </div>
        </div>

        <div className="animate-rise" style={{ animationDelay: "200ms" }}>
          <PaperMock />
        </div>
      </div>

      <div className="border-y border-ink/15 bg-sheet/70">
        <dl className="mx-auto grid w-full max-w-6xl grid-cols-2 divide-x divide-ink/10 px-0 sm:px-8 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="px-5 py-6 sm:px-6">
              <dt className="order-2 mt-1 text-sm text-ink-soft">{s.label}</dt>
              <dd className="font-serif text-4xl font-black text-ink">
                {s.value}
                <span className="ml-1 text-base font-bold text-vermilion">{s.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
