import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { SiteFooter } from "@/components/Shell";
import "./globals.css";
import { OriginCapture } from "@/components/OriginCapture";

// 太さを 1 つのファイルで変えられる形（可変フォント）で読む。太さごとに @font-face を並べずに済み、
// ページの表示を止める CSS が小さくなる（約 300KB → 約 110KB）。端末に日本語の字があれば読み込まない（globals.css）
const font = Noto_Sans_JP({
  weight: "variable",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jp",
  preload: false,
});

// リンクの見出し画像（OGP）の URL を作る基準。本番では NEXT_PUBLIC_SITE_URL を設定する
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "たこ診｜友達が答える16タイプ診断",
    template: "%s｜たこ診",
  },
  description:
    '自分で答える診断とはちがう、"周りから見たあなた"がわかる。友達が 3 分で答えるだけの 16 タイプ診断。',
  openGraph: {
    title: "たこ診｜友達が答える16タイプ診断",
    description: "友達が答える、あなたの 16 タイプ。全員そろったら結果発表。",
    siteName: "たこ診",
    locale: "ja_JP",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafc" },
    { media: "(prefers-color-scheme: dark)", color: "#121218" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={font.variable}>
      <body>
        <OriginCapture />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
