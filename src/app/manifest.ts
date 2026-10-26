import type { MetadataRoute } from "next";

// ホーム画面に追加したときの名前とアイコン（Android など）。
// iPhone は src/app/apple-icon.png を使う。アイコンは design/build_icons.cjs で書き出す
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "たこ診｜友達が答える16タイプ診断",
    short_name: "たこ診",
    start_url: "/",
    display: "browser",
    background_color: "#fafafc",
    theme_color: "#fafafc",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
