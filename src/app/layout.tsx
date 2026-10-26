import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const font = Noto_Sans_JP({
  weight: ["400", "700", "900"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jp",
  preload: false,
});

// リンクの見出し画像（OGP）の URL を作る基準。本番では NEXT_PUBLIC_SITE_URL を設定する
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

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
      <body>{children}</body>
    </html>
  );
}
