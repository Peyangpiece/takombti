// 公開用の結果カード（仕様書 §4.1 S7）。シェア画像と同じ内容だけを見せる。
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Disclaimer, Header } from "@/components/Shell";
import { TypeCard } from "@/components/TypeCard";
import { VisitCounter } from "@/components/VisitCounter";
import { AXES, GROUPS, POLE_LABEL, getType, groupOf } from "@/data/framework";
import { isLoose } from "@/lib/scoring";
import { getShared } from "@/lib/surveys";

type Props = { params: Promise<{ shareId: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareId } = await params;
  const view = await getShared(shareId);
  if (!view) return { title: "見つかりません", robots: { index: false } };
  const title = `${view.nickname}は「${getType(view.type).name}」`;
  const image = `/api/og/${shareId}?size=wide`;
  return {
    title,
    description: `友達 ${view.n} 人から見た ${view.nickname} は ${view.type}。あなたも友達に答えてもらおう。`,
    robots: { index: false, follow: false },
    openGraph: {
      title: `${title}｜たこ診`,
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default async function Page({ params }: Props) {
  const { shareId } = await params;
  const view = await getShared(shareId);
  if (!view) notFound();
  const group = GROUPS[groupOf(view.type)];
  return (
    <main
      className="page stack"
      style={{ ["--gc" as string]: group.ink, ["--gg" as string]: group.glow }}
    >
      <Header />
      <VisitCounter page="public" />
      <TypeCard
        code={view.type}
        ties={view.axes.map((a) => a.tie)}
        loose={isLoose(view.axes)}
        lead={`${view.nickname}は友達 ${view.n} 人から見ると`}
      />
      <section className="card">
        {view.axes.map((a) => {
          const def = AXES.find((x) => x.axis === a.axis)!;
          return (
            <p
              key={a.axis}
              style={{ display: "flex", justifyContent: "space-between" }}
            >
              <span className="muted">
                {POLE_LABEL[def.left].name} / {POLE_LABEL[def.right].name}
              </span>
              <b className="text-group">
                {POLE_LABEL[a.pole].name} {a.percent}%
              </b>
            </p>
          );
        })}
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
