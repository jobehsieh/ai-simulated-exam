import type { Metadata } from "next";
import { Geist_Mono, Instrument_Serif, Noto_Sans_TC, Noto_Serif_TC } from "next/font/google";
import ApiKeyDialog from "@/components/ApiKeyDialog";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

// 中文字型的 unicode 切片很多，關閉 preload，改由瀏覽器依頁面用到的字元按需下載
const sansTc = Noto_Sans_TC({ variable: "--font-sans-tc", display: "swap", preload: false });
const serifTc = Noto_Serif_TC({ variable: "--font-serif-tc", display: "swap", preload: false });
const displayLatin = Instrument_Serif({
  variable: "--font-display-latin",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI 考研模擬試題產生器",
  description: "依科目權重與各校出題風格，由 AI 生成資工所考研模擬試題與解答卷（PDF），確認後存入資料夾。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className={`${sansTc.variable} ${serifTc.variable} ${displayLatin.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <ApiKeyDialog />
      </body>
    </html>
  );
}
