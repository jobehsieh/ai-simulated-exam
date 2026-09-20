import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";
import { chromium } from "playwright-core";

const BROWSER_CANDIDATES = [
  process.env.BROWSER_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

function findBrowser(): string {
  const found = BROWSER_CANDIDATES.find((p) => p && existsSync(p));
  if (!found) throw new Error("找不到 Edge 或 Chrome，請以環境變數 BROWSER_PATH 指定瀏覽器執行檔");
  return found;
}

const CSS = `
@page { size: A4; }
body { font-family: 'Microsoft JhengHei', 'Noto Sans CJK TC', 'Segoe UI', sans-serif; font-size: 11.5pt; line-height: 1.6; color: #111; margin: 0; }
h1 { font-size: 17pt; text-align: center; border-bottom: 2px solid #333; padding-bottom: 6px; margin: 0 0 12px; }
h2 { font-size: 13.5pt; margin: 20px 0 6px; break-after: avoid; }
h3 { font-size: 12pt; margin: 14px 0 4px; break-after: avoid; }
p { margin: 5px 0; }
ul, ol { margin: 4px 0; padding-left: 22px; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 10.5pt; }
th, td { border: 1px solid #888; padding: 4px 8px; text-align: left; vertical-align: top; }
th { background: #eee; }
tr { break-inside: avoid; }
code { font-family: Consolas, 'Courier New', monospace; background: #f3f3f3; padding: 0 3px; border-radius: 3px; }
pre { background: #f6f6f6; padding: 8px 10px; border-radius: 4px; break-inside: avoid; white-space: pre-wrap; }
pre code { background: none; padding: 0; }
hr { border: none; border-top: 1px solid #bbb; margin: 14px 0; }
mjx-container[display="true"] { margin: 8px 0 !important; }
`;

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Markdown → HTML，公式先以佔位符保護，避免被 Markdown 語法破壞 */
export function markdownToHtml(md: string): string {
  const stash: string[] = [];
  const hold = (html: string) => {
    stash.push(html);
    return `@@STASH${stash.length - 1}@@`;
  };

  let text = md.replace(/```[\s\S]*?```/g, (block) => {
    const code = block.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "");
    return hold(`<pre><code>${escapeHtml(code)}</code></pre>`);
  });
  text = text.replace(/\\\$/g, () => hold('<span class="tex2jax_ignore">$</span>'));
  text = text.replace(/\$\$[\s\S]+?\$\$/g, (m) => hold(escapeHtml(m)));
  text = text.replace(/\$[^$\n]+\$/g, (m) => hold(escapeHtml(m)));

  let html = marked.parse(text, { async: false, gfm: true });
  html = html.replace(/@@STASH(\d+)@@/g, (_, i) => stash[Number(i)]);
  return html;
}

const MATHJAX_CONFIG = `window.MathJax = {
  tex: { inlineMath: [['$', '$']], displayMath: [['$$', '$$']] },
  svg: { fontCache: 'global' },
  options: { enableMenu: false }
};`;

let mathjaxSource: Promise<string> | undefined;
function loadMathJax(): Promise<string> {
  mathjaxSource ??= readFile(path.join(process.cwd(), "node_modules", "mathjax", "es5", "tex-svg.js"), "utf8");
  return mathjaxSource;
}

/** Markdown → A4 PDF（MathJax 於本機渲染公式，不需連網），頁尾為「第 X 頁，共 Y 頁」 */
export async function markdownToPdf(md: string): Promise<Buffer> {
  const html = `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${markdownToHtml(md)}</body></html>`;
  const mathjax = await loadMathJax();

  const browser = await chromium.launch({ executablePath: findBrowser() });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.addScriptTag({ content: MATHJAX_CONFIG });
    await page.addScriptTag({ content: mathjax });
    await page.evaluate(async () => {
      await (window as unknown as { MathJax: { startup: { promise: Promise<unknown> } } }).MathJax.startup.promise;
    });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="width:100%;font-size:9px;text-align:center;font-family:\'Microsoft JhengHei\',sans-serif;color:#555;">第 <span class="pageNumber"></span> 頁，共 <span class="totalPages"></span> 頁</div>',
      margin: { top: "18mm", bottom: "18mm", left: "18mm", right: "18mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
