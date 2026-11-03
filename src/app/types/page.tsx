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

// 何をするボタンかが分かる言い方にする（友達が答える診断であることを、ここでも伝える）
const CREATE_LABEL = "友達に答えてもらう診断をつくる（無料）";

export default function TypesPage() {
  return (
    <main className="page stack">
      <Header />
      <h1 style={{ marginTop: 8 }}>16 タイプ一覧</h1>
      <p>
        友達の目から見た 16 タイプを、4 つのグループ（界隈）に分けて紹介します。
      </p>
      <Link href="/new?entry=types" className="btn secondary">
        {CREATE_LABEL}
      </Link>
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
        {CREATE_LABEL}
      </Link>
      <p className="muted small center">登録なし。3 人から作れます。</p>
      <Disclaimer />
    </main>
  );
}
