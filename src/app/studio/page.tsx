import type { Metadata } from "next";
import ExamGenerator from "@/components/ExamGenerator";

export const metadata: Metadata = {
  title: "出題工作台 · AI 考研模擬試題",
  description: "選擇科目與參照學校的出題風格，生成資工所考研模擬試題與解答卷（PDF）。",
};

export default function StudioPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-8 pt-14 sm:px-8">
      <p className="font-display text-xl italic text-vermilion">Studio</p>
      <h1 className="mt-2 font-serif text-4xl font-black tracking-tight sm:text-5xl">
        出題<span className="marker">工作台</span>
      </h1>
      <p className="mb-12 mt-5 max-w-2xl leading-[1.85] text-ink-soft">
        選擇科目與想參照的出題風格，AI 生成試題卷與解答卷。預覽確認無誤後，再存入模擬考題資料夾。
      </p>
      <ExamGenerator />
    </div>
  );
}
