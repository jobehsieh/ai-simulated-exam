import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Marked } from "marked";
import type { Browser } from "puppeteer-core";

// ── 瀏覽器：本機有 Edge / Chrome 就用它；沒有（如 Vercel）就用 @sparticuz/chromium ──────────────

const LOCAL_BROWSER_CANDIDATES = [
  process.env.BROWSER_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];

function findLocalBrowser(): string | undefined {
  return LOCAL_BROWSER_CANDIDATES.find((p) => p && existsSync(p));
}

async function launchBrowser(local: string | undefined): Promise<Browser> {
  const { default: puppeteer } = await import("puppeteer-core");
  if (local) return puppeteer.launch({ executablePath: local, headless: true });

  // 雲端：無伺服器環境沒有系統瀏覽器，改用打包好的 Chromium
  const { default: chromium } = await import("@sparticuz/chromium");
  return puppeteer.launch({
    args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
    executablePath: await chromium.executablePath(),
    headless: "shell",
  });
}

// ── Markdown → 安全的 HTML ───────────────────────────────────────────────────

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * 轉檔的 Markdown 來自呼叫 API 的用戶端（雲端版伺服器是無狀態的），必須視為不可信：
 * 跳脫原始 HTML（只放行 <br>、<sub>、<sup>）、不輸出圖片與連結，避免注入腳本或讓瀏覽器去抓外部資源。
 */
const safeMarked = new Marked({
  gfm: true,
  renderer: {
    html({ text }) {
      return /^<\/?(br|sub|sup)\s*\/?>$/i.test(text.trim()) ? text.trim() : escapeHtml(text);
    },
    image({ text }) {
      return escapeHtml(text);
    },
    link({ tokens }) {
      return this.parser.parseInline(tokens);
    },
  },
});

/** Markdown → HTML，公式先以佔位符保護，避免被 Markdown 語法破壞 */
export function markdownToHtml(md: string): string {
  const stash: string[] = [];
  const hold = (html: string) => {
    stash.push(html);
    return `@@STASH${stash.length - 1}@@`;
  };

  let text = md.replace(/@@STASH\d+@@/g, ""); // 使用者內容不得冒充佔位符
  text = text.replace(/```[\s\S]*?```/g, (block) => {
    const code = block.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "");
    return hold(`<pre><code>${escapeHtml(code)}</code></pre>`);
  });
  text = text.replace(/\\\$/g, () => hold('<span class="tex2jax_ignore">$</span>'));
  text = text.replace(/\$\$[\s\S]+?\$\$/g, (m) => hold(escapeHtml(m)));
  text = text.replace(/\$[^$\n]+\$/g, (m) => hold(escapeHtml(m)));

  const html = safeMarked.parse(text, { async: false });
  return html.replace(/@@STASH(\d+)@@/g, (_, i) => stash[Number(i)]);
}

// ── HTML → PDF ───────────────────────────────────────────────────────────────

const CSS = `
@page { size: A4; }
body { font-family: 'Microsoft JhengHei', 'Noto Sans TC', 'Segoe UI', sans-serif; font-size: 11.5pt; line-height: 1.6; color: #111; margin: 0; }
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

// 雲端環境沒有中文字型，從 Google Fonts 載入（只會下載頁面實際用到的字元切片）
const WEB_FONT_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700&display=block">';
const ALLOWED_REMOTE = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

// 頁尾在獨立的環境渲染，吃不到網頁載入的中文字型：本機有系統字型可用「第 X 頁，共 Y 頁」，
// 雲端沒有中文字型，改用純英數字的「X / Y」，避免中文字變成看不見的空白
const FOOTER_STYLE = "width:100%;font-size:9px;text-align:center;color:#555;";
const FOOTER_LOCAL = `<div style="${FOOTER_STYLE}font-family:'Microsoft JhengHei',sans-serif;">第 <span class="pageNumber"></span> 頁，共 <span class="totalPages"></span> 頁</div>`;
const FOOTER_CLOUD = `<div style="${FOOTER_STYLE}font-family:sans-serif;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`;

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

/** Markdown → A4 PDF（MathJax 於伺服器端渲染公式），頁尾為「第 X 頁，共 Y 頁」 */
export async function markdownToPdf(md: string): Promise<Buffer> {
  const local = findLocalBrowser();
  const cloud = !local;
  const html = `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8">${cloud ? WEB_FONT_LINK : ""}<style>${CSS}</style></head><body>${markdownToHtml(md)}</body></html>`;
  const mathjax = await loadMathJax();

  const browser = await launchBrowser(local);
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(90_000);

    // 只允許頁面內嵌資料與（雲端時）Google Fonts，其餘網路請求一律擋下
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith("data:") || url.startsWith("about:") || (cloud && ALLOWED_REMOTE.test(url))) void req.continue();
      else void req.abort();
    });

    await page.setContent(html, { waitUntil: "load" });
    await page.addScriptTag({ content: MATHJAX_CONFIG });
    await page.addScriptTag({ content: mathjax });
    await page.evaluate(async () => {
      await (window as unknown as { MathJax: { startup: { promise: Promise<unknown> } } }).MathJax.startup.promise;
      await document.fonts.ready;
    });
    // 雲端的中文字型是排版後才開始下載的：等網路靜止，再確認字型都載入完成
    if (cloud) {
      await page.waitForNetworkIdle({ idleTime: 600, timeout: 60_000 });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
    }

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: cloud ? FOOTER_CLOUD : FOOTER_LOCAL,
      margin: { top: "18mm", bottom: "18mm", left: "18mm", right: "18mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
