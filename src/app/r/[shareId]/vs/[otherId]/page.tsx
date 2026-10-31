// 2 人の結果を並べる（仕様書 §4.15）。どちらも公開中のカード（S7）のときだけ、公開カードと同じ中身だけを並べる
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Disclaimer, Header } from "@/components/Shell";
import { Octopus } from "@/components/Octopus";
import { AXES, GROUPS, POLE_LABEL, getType, groupOf } from "@/data/framework";
import {
  CLOSENESS_LABEL,
  MATCH_LABEL,
  axisCloseness,
  comparePath,
  leftShare,
  matchBetween,
  pointLabel,
} from "@/lib/compare";
import { getSharedPair, type SharedView } from "@/lib/surveys";
import { CompareShare } from "./CompareShare";

type Props = { params: Promise<{ shareId: string; otherId: string }> };

export const dynamic = "force-dynamic";

// 見出しとページで同じものを読むので、1 回の表示につき 1 回だけ問い合わせる
const loadPair = cache(getSharedPair);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareId, otherId } = await params;
  let pair: Awaited<ReturnType<typeof getSharedPair>>;
  try {
    pair = await loadPair(shareId, otherId);
  } catch {
    return { title: "結果を並べる", robots: { index: false, follow: false } };
  }
  if (!pair)
    return { title: "見つかりません", robots: { index: false, follow: false } };
  const [a, b] = pair;
  const title = `${a.nickname}と${b.nickname}の結果を並べる`;
  // 画像は、1 人目の公開カードの画像をそのまま使う（並べた画像は作らない）
  const image = `/api/og/${shareId}?size=wide`;
  return {
    title,
    description: `友達から見た ${a.nickname}（${a.type}）と ${b.nickname}（${b.type}）。4 つの軸で並べてみよう。`,
    robots: { index: false, follow: false },
    openGraph: {
      title: `${title}｜たこ診`,
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

function Person({ view, shareId }: { view: SharedView; shareId: string }) {
  const group = GROUPS[groupOf(view.type)];
  return (
    <Link
      href={`/r/${shareId}`}
      className="cmp-person"
      style={{ ["--gc" as string]: group.ink, ["--gg" as string]: group.glow }}
    >
      <span className="small muted">友達 {view.n} 人から見た</span>
      <b className="cmp-name">{view.nickname}</b>
      <Octopus code={view.type} size={80} />
      <span className="sample-code">{view.type}</span>
      <span className="sample-name">{getType(view.type).name}</span>
      <span className="small muted">{group.name}</span>
    </Link>
  );
}

export default async function Page({ params }: Props) {
  const { shareId, otherId } = await params;
  const pair = await loadPair(shareId, otherId);
  if (!pair) notFound();
  const [a, b] = pair;
  const ga = GROUPS[groupOf(a.type)];
  const gb = GROUPS[groupOf(b.type)];
  const rows = a.axes.map((x, i) => ({
    a: x,
    b: b.axes[i],
    ...axisCloseness(x, b.axes[i]),
  }));
  const close = rows.filter((r) => r.kind === "close").length;
  const match = matchBetween(a.type, b.type);

  return (
    <main
      className="page stack"
      style={{ ["--gc" as string]: ga.ink, ["--gg" as string]: ga.glow }}
    >
      <Header />
      <h1 style={{ fontSize: 22 }}>
        {a.nickname} と {b.nickname}、並べてみると
      </h1>
      <div className="cmp-people">
        <Person view={a} shareId={shareId} />
        <Person view={b} shareId={otherId} />
      </div>

      <section className="card stack">
        <h2 className="section-title">4 つの軸</h2>
        <p>
          4 つの軸のうち、近いのは <b>{close} つ</b>
          {match === "same" && `。${MATCH_LABEL.same}です`}
        </p>
        <div>
          {rows.map((r) => {
            const def = AXES.find((x) => x.axis === r.a.axis)!;
            return (
              <div className="meter" key={r.a.axis}>
                <div className="ends">
                  <span>{POLE_LABEL[def.left].name}</span>
                  <span>{POLE_LABEL[def.right].name}</span>
                </div>
                {(
                  [
                    [a, r.a, ga],
                    [b, r.b, gb],
                  ] as const
                ).map(([v, p, g], k) => (
                  <div
                    key={k}
                    style={{
                      ["--gc" as string]: g.ink,
                      ["--gg" as string]: g.glow,
                    }}
                  >
                    <p className="cmp-who">
                      {v.nickname}：{pointLabel(p)}
                    </p>
                    <div
                      className="bar"
                      role="img"
                      aria-label={`${v.nickname}は ${pointLabel(p)}`}
                    >
                      <div
                        className="knob"
                        style={{ left: `${leftShare(p)}%` }}
                      />
                    </div>
                  </div>
                ))}
                <p className={`cmp-close ${r.kind}`}>
                  {CLOSENESS_LABEL[r.kind]}
                </p>
              </div>
            );
          })}
          <p className="meter-note">
            ％は人数の割合ではなく、友達の答えの寄り具合です（50%
            がちょうど半々）。同じ側で 20
            ポイント未満の差なら「近い」、反対の側で 20
            ポイント以上はなれていれば「反対」としています。
          </p>
        </div>
      </section>

      {(match === "easy" || match === "spark") && (
        <section className="card stack">
          <h2 className="section-title">おまけ：相性</h2>
          <p>
            {getType(a.type).name}（{a.type}）と{getType(b.type).name}（{b.type}
            ）は、<b>{MATCH_LABEL[match]}</b>です。
          </p>
          <p className="muted small">
            遊びの決まりで選んでいます。相性に正解はありません。
          </p>
        </section>
      )}

      <p className="muted small">
        どちらも、それぞれの友達から見たタイプです。答えた友達は別の人たちなので、2
        人の性格をくらべて決めたものではありません。
      </p>

      <section className="card stack">
        <h2 className="section-title">このページをシェア</h2>
        <CompareShare
          path={comparePath(shareId, otherId)}
          names={[a.nickname, b.nickname]}
        />
      </section>

      <section className="card stack center">
        <p>
          たこ診は、自分ではなく<b>友達が答える</b> 16
          タイプ診断です。あなたは周りからどう見えてる？
        </p>
        <Link href="/new?entry=public" className="btn">
          自分も友達に聞いてみる
        </Link>
      </section>
      <Disclaimer />
    </main>
  );
}
