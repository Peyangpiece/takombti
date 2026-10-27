// 16 タイプの一覧（検索からの入り口。仕様書 §4.14）
import type { Metadata } from "next";
import Link from "next/link";
import { Disclaimer, Header } from "@/components/Shell";
import { Octopus } from "@/components/Octopus";
import {
  GROUPS,
  TYPE_CODES,
  getType,
  groupOf,
  type GroupId,
} from "@/data/framework";
import { SITE_URL, typePath } from "@/lib/site";

export const metadata: Metadata = {
  title: "16 タイプ一覧｜周りから見た性格タイプ",
  description:
    "たこ診の 16 タイプを 4 つの界隈ごとに紹介。友達から見たときの特徴・強み・あるあるがわかります。",
  alternates: { canonical: `${SITE_URL}/types` },
};

export default function TypesPage() {
  return (
    <main className="page stack">
      <Header />
      <h1 style={{ marginTop: 8 }}>16 タイプ一覧</h1>
      <p>
        友達から見たときに、どんな人に見えているか。たこ診の 16 タイプを、4
        つの界隈ごとに紹介します。
      </p>
      {(Object.keys(GROUPS) as GroupId[]).map((id) => (
        <section key={id} className="card stack">
          <h2
            className="section-title"
            style={{ ["--gc" as string]: GROUPS[id].ink }}
          >
            {GROUPS[id].name}
          </h2>
          <p className="small muted">{GROUPS[id].line}</p>
          <ul className="type-links">
            {TYPE_CODES.filter((c) => groupOf(c) === id).map((c) => (
              <li key={c}>
                <Link href={typePath(c)}>
                  <Octopus code={c} size={56} />
                  <span>
                    <b>
                      {c} {getType(c).name}
                    </b>
                    <small>{getType(c).catch}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Link href="/new?entry=types" className="btn">
        診断をつくる（無料・登録なし）
      </Link>
      <Disclaimer />
    </main>
  );
}
