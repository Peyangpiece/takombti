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
      この診断は、広く知られている「4
      文字の性格タイプ」の考え方を参考にした独自の娯楽用コンテンツで、心理検査ではありません。
      結果は「回答した友達から見たあなた」の傾向で、あなたの能力や価値を決めるものではありません。回答は自己申告です。
      MBTI および Myers-Briggs Type Indicator は Myers &amp; Briggs Foundation
      の登録商標です。本サービスは MBTI®・日本MBTI協会・16Personalities
      とは関係がなく、MBTI® の検査ではありません。
    </p>
  );
}

// https で始まるアドレスだけを使う（設定のまちがいで別の種類のリンクにならないように）
const CONTACT_URL = /^https:\/\//.test(
  process.env.NEXT_PUBLIC_CONTACT_URL ?? "",
)
  ? process.env.NEXT_PUBLIC_CONTACT_URL
  : undefined;

export function ContactLink() {
  return CONTACT_URL ? (
    <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer">
      問い合わせフォーム
    </a>
  ) : (
    <span>問い合わせ窓口（準備中）</span>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link href="/terms">利用規約</Link>
      <Link href="/privacy">プライバシーポリシー</Link>
      <ContactLink />
      <span>© たこ診 運営事務局</span>
    </footer>
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
