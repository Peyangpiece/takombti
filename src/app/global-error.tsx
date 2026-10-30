"use client";

// いちばん外側（layout.tsx）で失敗したときの画面（仕様書 §10）。layout の代わりに出るので、
// <html> と <body>、見た目（globals.css）を自分で持つ
import Link from "next/link";
import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="ja">
      <body>
        <title>うまく表示できませんでした｜たこ診</title>
        <main className="page stack center" style={{ paddingTop: 64 }}>
          <h1>うまく表示できませんでした</h1>
          <p>通信のよいところで、もう一度お試しください。</p>
          <button type="button" className="btn" onClick={() => retry()}>
            もう一度
          </button>
          <Link href="/">トップへ</Link>
        </main>
      </body>
    </html>
  );
}
