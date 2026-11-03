// 公開用の結果カード（仕様書 §4.1 S7）。シェア画像と同じ内容だけを見せる。
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Disclaimer, Header } from "@/components/Shell";
import { Meters } from "@/components/Meters";
import { TypeCard } from "@/components/TypeCard";
import { VisitCounter } from "@/components/VisitCounter";
import { GROUPS, getType, groupOf } from "@/data/framework";
import { isLoose, weakAxes } from "@/lib/scoring";
import { getShared } from "@/lib/surveys";
import { CompareEntry } from "./CompareEntry";

type Props = { params: Promise<{ shareId: string }> };

export const dynamic = "force-dynamic";

// 見出し（generateMetadata）とページで同じものを読むので、1 回の表示につき 1 回だけデータベースに問い合わせる
const loadShared = cache(getShared);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareId } = await params;
  let view: Awaited<ReturnType<typeof getShared>>;
  try {
    view = await loadShared(shareId);
  } catch {
    // 見出しだけのために失敗にしない（ページのほうで失敗の画面を出す）
    return { title: "結果", robots: { index: false, follow: false } };
  }
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
  const view = await loadShared(shareId);
  if (!view) notFound();
  const group = GROUPS[groupOf(view.type)];
  return (
    <main
      className="page stack"
      style={{ ["--gc" as string]: group.ink, ["--gg" as string]: group.glow }}
    >
      <Header />
      <VisitCounter page="public" />
      {/* 画面の見出しはタイプのカードが担うので、読み上げ用にだけページの見出しを置く */}
      <h1 className="visually-hidden">
        {view.nickname}の結果（友達 {view.n} 人から見たタイプ）
      </h1>
      <TypeCard
        code={view.type}
        ties={view.axes.map((a) => a.tie)}
        weak={weakAxes(view.axes)}
        loose={isLoose(view.axes)}
        lead={`${view.nickname}は友達 ${view.n} 人から見ると`}
      />
      {/* 4 つの軸は、結果の画面と同じメーターで見せる（％の意味もメーターの下に書く） */}
      <section className="card">
        <Meters axes={view.axes} />
      </section>
      {/* まず自分も作れることを、その下に、ほかの人のカードと並べる入口を小さく置く（§4.1 S7・§4.15） */}
      <section className="card stack center">
        <p>
          たこ診は、自分ではなく<b>友達が答える</b> 16
          タイプ診断です。あなたは周りからどう見えてる？
        </p>
        <Link href="/new?entry=public" className="btn">
          自分も友達に聞いてみる
        </Link>
      </section>
      <CompareEntry shareId={shareId} />
      <Disclaimer />
    </main>
  );
}
