import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 這兩個套件含原生執行檔 / 動態載入，交給 Node 在執行期直接載入，不要打包
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // 靜態分析追蹤不到這些「執行期才讀取」的檔案，明確列入 render 路由的部署內容：
  // Chromium 執行檔（Vercel 上用來列印 PDF）與 MathJax（PDF 公式渲染）
  outputFileTracingIncludes: {
    "/simulated-exam/render": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
      "./node_modules/mathjax/es5/tex-svg.js",
    ],
  },
};

export default nextConfig;
