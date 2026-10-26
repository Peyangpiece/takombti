import Link from "next/link";
import { Octopus } from "./Octopus";

export function Header({ right }: { right?: React.ReactNode }) {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        minHeight: 44,
      }}
    >
      <Link href="/" className="logo" aria-label="たこ診 トップへ">
        <Octopus code="ENFP" size={32} />
        たこ診
      </Link>
      {right}
    </header>
  );
}

export function Disclaimer() {
  return (
    <p className="disclaimer">
      この診断は、MBTI
      などの性格類型の考え方を参考にした娯楽用のコンテンツで、心理検査ではありません。
      結果は「回答した友達から見たあなた」の傾向で、あなたの能力や価値を決めるものではありません。回答は自己申告です。
      MBTI は The Myers-Briggs Company の登録商標です。本サービスは同社および
      16Personalities とは関係ありません。
    </p>
  );
}

export function MissingHost() {
  return (
    <main className="page stack center" style={{ paddingTop: 64 }}>
      <Octopus code="INFP" size={120} />
      <h1>診断が見つかりません</h1>
      <p>
        管理用のリンクがまちがっているか、診断が削除されたか、保存期限を過ぎています。
      </p>
      <Link href="/" className="btn">
        トップへ
      </Link>
    </main>
  );
}

export function Loading() {
  return (
    <main className="page center" aria-busy="true">
      <p className="muted" style={{ marginTop: "40dvh" }}>
        読み込み中…
      </p>
    </main>
  );
}
