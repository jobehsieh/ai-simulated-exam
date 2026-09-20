/** 品牌標誌：硃砂紅印章「擬」＋字標。印章微微傾斜，像蓋在考卷上的章 */
export default function Logo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span className="inline-flex items-center gap-3">
      <span
        aria-hidden
        className="grid size-9 -rotate-6 place-items-center rounded-[7px] border-2 border-vermilion bg-vermilion/10 font-serif text-lg font-black leading-none text-vermilion"
      >
        擬
      </span>
      <span className={`flex flex-col leading-none ${tone === "dark" ? "text-ink" : "text-paper"}`}>
        <span className="font-serif text-[17px] font-bold tracking-wide">考研模擬試題</span>
        <span className="mt-1 font-display text-[13px] italic opacity-60">AI Mock Exam Studio</span>
      </span>
    </span>
  );
}
