import Link from "next/link";
import { Octopus } from "@/components/Octopus";

export default function NotFound() {
  return (
    <main className="page stack center" style={{ paddingTop: 64 }}>
      <Octopus code="INTP" size={120} />
      <h1>ページが見つかりません</h1>
      <p>リンクがまちがっているか、削除されています。</p>
      <Link href="/" className="btn">
        トップへ
      </Link>
    </main>
  );
}
