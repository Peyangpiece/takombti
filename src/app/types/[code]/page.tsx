// タイプの紹介ページ（検索からの入り口。仕様書 §4.14）。
// 中身は結果の画面で無料で見られる文（types.json）と同じ。くわしい分析（特典）は載せない
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Disclaimer, Header } from "@/components/Shell";
import { Octopus } from "@/components/Octopus";
import { TypeCard } from "@/components/TypeCard";
import {
  GROUPS,
  TYPE_CODES,
  getType,
  groupOf,
  matchesOf,
  type TypeCode,
} from "@/data/framework";
import { SITE_URL, typePath } from "@/lib/site";

type Props = { params: Promise<{ code: string }> };

// 16 タイプだけを、公開の作業のときに作っておく。ほかの URL は 404
export const dynamicParams = false;

export function generateStaticParams() {
  return TYPE_CODES.map((c) => ({ code: c.toLowerCase() }));
}

function codeOf(param: string): TypeCode | null {
  const up = param.toUpperCase();
  return (TYPE_CODES as readonly string[]).includes(up)
    ? (up as TypeCode)
    : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = codeOf((await params).code);
  if (!code) return {};
  const type = getType(code);
  return {
    title: `${code}「${type.name}」｜周りから見た特徴・強み・あるある`,
    description: `${code}（${type.name}）は、友達から見ると「${type.catch}」タイプ。${type.friendView.slice(0, 70)}…`,
    alternates: { canonical: `${SITE_URL}${typePath(code)}` },
  };
}

export default async function TypePage({ params }: Props) {
  const code = codeOf((await params).code);
  if (!code) notFound();
  const type = getType(code);
  const group = GROUPS[groupOf(code)];
  const { easy, spark } = matchesOf(code);
  const siblings = TYPE_CODES.filter(
    (c) => groupOf(c) === groupOf(code) && c !== code,
  );

  return (
    <main
      className="page stack"
      style={{ ["--gc" as string]: group.ink, ["--gg" as string]: group.glow }}
    >
      <Header />
      <nav className="small muted" aria-label="現在の場所">
        <Link href="/types">16 タイプ一覧</Link> ／ {group.name}
      </nav>
      <h1 className="visually-hidden">
        {code}「{type.name}」の特徴
      </h1>
      <TypeCard code={code} lead={`周りから見た ${code}`} />

      <section className="card stack">
        <h2 className="section-title">友達から見ると</h2>
        <p>{type.friendView}</p>
        <div className="aruaru" aria-label="友達のあるある">
          {type.aruaru.map((a) => (
            <span key={a}>「{a}」</span>
          ))}
        </div>
      </section>

      <section className="card stack">
        <h2 className="section-title">強み</h2>
        <ul className="list-plain">
          {type.strengths.map((s) => (
            <li key={s.title}>
              <b className="text-group">{s.title}</b>
              <p>{s.text}</p>
            </li>
          ))}
        </ul>
        <h2 className="section-title">ちょっと気をつけたいところ</h2>
        <ul className="list-plain">
          {type.cautions.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>

      <section className="card stack">
        <h2 className="section-title">おまけ：相性のいいタイプ</h2>
        <div className="match">
          {(
            [
              ["一緒にいるとラク", easy],
              ["刺激をくれる", spark],
            ] as const
          ).map(([label, c]) => (
            <Link key={label} href={typePath(c)}>
              <p className="small muted">{label}</p>
              <Octopus code={c} size={64} />
              <p style={{ fontWeight: 900 }}>{c}</p>
              <p className="small" style={{ fontWeight: 700 }}>
                {getType(c).name}
              </p>
            </Link>
          ))}
        </div>
        <p className="muted small">
          遊びの決まりで選んでいます。相性に正解はありません。
        </p>
      </section>

      <section className="card stack center">
        <p>
          <b>あなたは、周りからどのタイプに見えている？</b>
          <br />
          友達が答えると、周りから見たあなたのタイプがわかります。
        </p>
        <Link href="/new?entry=types" className="btn">
          診断をつくる（無料・登録なし）
        </Link>
      </section>

      <section className="stack">
        <h2 className="section-title">{group.name}のほかのタイプ</h2>
        <ul className="type-links">
          {siblings.map((c) => (
            <li key={c}>
              <Link href={typePath(c)}>
                <Octopus code={c} size={48} />
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
      <Disclaimer />
    </main>
  );
}
