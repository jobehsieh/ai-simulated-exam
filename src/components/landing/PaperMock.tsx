import { EXAM_DURATION_MINUTES, EXAM_YEAR } from "@/lib/exam-config";

/**
 * Hero 右側的視覺：兩張疊放的 A4 試卷（前：試題卷、後：解答卷），
 * 用純 HTML/CSS/SVG 繪製，內容與實際輸出的 PDF 版式一致（標題不含校名、配分以百分比標示）。
 */
export default function PaperMock() {
  return (
    <div className="relative mx-auto w-full max-w-[440px] pb-6 pt-2" aria-hidden>
      {/* 後方：解答卷 */}
      <div className="absolute inset-x-6 top-6 h-full origin-bottom-right rotate-[5deg] rounded-[6px] border border-line bg-paper-deep p-6 shadow-[0_18px_40px_-20px_rgb(28_26_22/0.45)]">
        <p className="text-center font-serif text-[11px] font-bold text-ink-soft">解答卷</p>
        <div className="mt-4 space-y-1.5 text-[10px] text-ink-soft">
          <div className="grid grid-cols-[1fr_1fr_1fr] border-b border-ink/30 pb-1 font-bold">
            <span>題號</span>
            <span>配分</span>
            <span>得分</span>
          </div>
          {[
            ["1", "20"],
            ["2", "15"],
            ["3", "15"],
          ].map(([n, p]) => (
            <div key={n} className="grid grid-cols-[1fr_1fr_1fr] border-b border-ink/10 pb-1">
              <span>{n}</span>
              <span>{p}</span>
              <span />
            </div>
          ))}
        </div>
      </div>

      {/* 前方：試題卷 */}
      <div className="relative -rotate-2 rounded-[6px] border border-line bg-sheet p-6 pb-8 shadow-[0_28px_60px_-24px_rgb(28_26_22/0.55)] transition-transform duration-500 hover:rotate-0 sm:p-8">
        <h2 className="text-center font-serif text-[15px] font-black leading-snug sm:text-base">
          {EXAM_YEAR} 學年度碩士班入學考試模擬試題
        </h2>
        <div className="mt-3 border-y border-ink/25 py-2 text-center text-[10.5px] leading-5 text-ink-soft sm:text-[11px]">
          科目名稱：資料結構與演算法
          <span className="mx-1.5 text-ink/30">|</span>作答時間：{EXAM_DURATION_MINUTES} 分鐘
          <br />
          出題日期：自動加註
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-serif text-[13px] font-bold sm:text-sm">1. (20%) Dynamic Programming</p>
            {/* 紅筆批改：圈起配分 */}
            <span className="relative grid size-11 shrink-0 -rotate-6 place-items-center text-vermilion">
              <svg className="absolute inset-0 size-full" viewBox="0 0 70 70" fill="none">
                <path
                  className="animate-draw"
                  pathLength={1}
                  d="M36 6 C 12 6, 4 26, 8 42 C 12 60, 40 66, 56 52 C 70 38, 62 12, 40 8 C 30 6, 22 10, 20 14"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <span className="font-display text-xl italic leading-none">20</span>
            </span>
          </div>
          <p className="mt-2 text-[11.5px] leading-[1.75] text-ink/85 sm:text-xs">
            <b>(a) (8%)</b> Let <i className="font-display text-[1.05em]">X</i> and <i className="font-display text-[1.05em]">Y</i> be
            two strings of length <i className="font-display text-[1.05em]">n</i>. Give the recurrence for their longest common
            subsequence.
          </p>
          <p className="mt-2 text-[11.5px] leading-[1.75] text-ink/85 sm:text-xs">
            <b>(b) (12%)</b> Solve{" "}
            <i className="font-display text-[1.1em]">
              T(n) = 2T(n/2) + n log n
            </i>{" "}
            and state the bound in Θ-notation.
          </p>
        </div>

        <div className="mt-5">
          <p className="font-serif text-[13px] font-bold sm:text-sm">2. (15%) Graph Algorithms</p>
          <div className="mt-2.5 space-y-2">
            <div className="h-1.5 w-full rounded-full bg-ink/10" />
            <div className="h-1.5 w-[86%] rounded-full bg-ink/10" />
            <div className="h-1.5 w-[64%] rounded-full bg-ink/10" />
          </div>
        </div>

        {/* 印章：100 分鐘 */}
        <div className="animate-stamp pointer-events-none absolute -bottom-7 -left-3 grid size-[92px] place-items-center rounded-full border-[3px] border-double border-vermilion text-center text-vermilion sm:-left-6 sm:size-[104px]">
          <div className="leading-none">
            <p className="font-display text-[34px] italic sm:text-[40px]">{EXAM_DURATION_MINUTES}</p>
            <p className="mt-1 text-[10px] font-bold tracking-[0.2em]">MINUTES</p>
          </div>
        </div>

        <span className="absolute -right-2 -top-3 rotate-3 rounded-md bg-ink px-2.5 py-1 font-mono text-[11px] font-medium text-paper shadow-md">
          PDF
        </span>
      </div>
    </div>
  );
}
