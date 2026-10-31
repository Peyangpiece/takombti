import Link from "next/link";
import { Octopus } from "@/components/Octopus";

// 並べられないとき（§4.15）。どちらのカードが見られないのかは言わない（公開をやめたのか、なかったのかを区別しない）
export default function NotFound() {
  return (
    <main className="page stack center" style={{ paddingTop: 64 }}>
      <Octopus code="INTP" size={120} />
      <h1>並べられませんでした</h1>
      <p>
        どちらかのカードの公開がやめられたか、リンクがまちがっているようです。並べられるのは、どちらも公開中の結果カードだけです。
      </p>
      <Link href="/new?entry=public" className="btn">
        自分も友達に聞いてみる
      </Link>
      <Link href="/" className="btn ghost">
        トップへ
      </Link>
    </main>
  );
}
