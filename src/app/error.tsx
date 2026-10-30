"use client";

// ページを作る途中で失敗したとき（データベースにつながらないなど）の画面（仕様書 §10）。
// 「もう一度」は、ページを読み直して作り直す（retry）。中身（エラーの文）は見せない
import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
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
    <main className="page stack center" style={{ paddingTop: 64 }}>
      <h1>うまく表示できませんでした</h1>
      <p>通信のよいところで、もう一度お試しください。</p>
      <button type="button" className="btn" onClick={() => retry()}>
        もう一度
      </button>
      <Link href="/">トップへ</Link>
    </main>
  );
}
