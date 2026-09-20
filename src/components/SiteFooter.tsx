import Link from "next/link";
import Logo from "./Logo";

const PRODUCT = [
  { href: "/#features", label: "功能特色" },
  { href: "/#how", label: "使用流程" },
  { href: "/#faq", label: "常見問題" },
  { href: "/studio", label: "開始出題" },
];

const RESOURCES = [
  { href: "https://github.com/jobehsieh/cs-graduate-exam-skills", label: "出題規格 · cs-graduate-exam-skills" },
  { href: "https://opencode.ai", label: "模型服務 · OpenCode Go" },
];

export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-ink/15 bg-ink text-paper">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1.2fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-paper/60">
            依各科主題權重與各校出題風格，生成一份可以直接列印練習的模擬試題與解答卷。
          </p>
        </div>

        <nav aria-label="頁尾產品連結">
          <h2 className="font-display text-lg italic text-paper/50">Product</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {PRODUCT.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-paper/80 transition-colors hover:text-marker">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="頁尾資源連結">
          <h2 className="font-display text-lg italic text-paper/50">Resources</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {RESOURCES.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-paper/80 transition-colors hover:text-marker"
                >
                  {l.label} <span aria-hidden>↗</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-paper/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-6 text-xs leading-relaxed text-paper/45 sm:px-8 md:flex-row md:justify-between">
          <p>© 2026 AI 考研模擬試題。試題由 AI 生成，內容請自行審閱，與任何學校或考試機構無關。</p>
          <p>各校考古題之著作權屬原學校所有，本服務僅參考其出題結構與風格。</p>
        </div>
      </div>
    </footer>
  );
}
