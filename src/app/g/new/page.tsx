import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Shell";

export const metadata: Metadata = {
  title: "グループ診断は終了しました",
  robots: { index: false },
};

// グループ診断を新しく作るのは終わった（仕様書 §4.16）。前のリンクから来た人を、ふつうの診断へ案内する
export default function Page() {
  return (
    <main className="page stack">
      <Header />
      <h1 style={{ marginTop: 8 }}>グループ診断は終了しました</h1>
      <p>
        新しいグループ診断は作れなくなりました。ふつうの診断で、友達に「周りから見たあなた」を聞けます。
      </p>
      <p className="muted small">
        すでに参加しているグループは、これまでどおりグループのページから答えたり、結果を見たりできます。
      </p>
      <Link href="/new" className="btn">
        診断をつくる（無料・登録なし）
      </Link>
    </main>
  );
}
