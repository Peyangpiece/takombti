import type { Metadata } from "next";
import { cache } from "react";
import { getPublic } from "@/lib/surveys";
import { VisitCounter } from "@/components/VisitCounter";
import { RespondFlow } from "./RespondFlow";
import { ANSWER_TIME_LABEL } from "@/data/questions";

type Props = { params: Promise<{ surveyId: string }> };

export const dynamic = "force-dynamic";

// 1 回の表示につき 1 回だけデータベースに問い合わせる（同じ表示の中で何度呼んでも、結果を使い回す）
const loadPublic = cache((surveyId: string) => getPublic(surveyId));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { surveyId } = await params;
  let view: Awaited<ReturnType<typeof getPublic>>;
  try {
    view = await loadPublic(surveyId);
  } catch {
    // データベースにつながらなくても、ページ（答える画面）は出す。見出しは決まりの文にする
    return { title: "友達について答えて", robots: { index: false } };
  }
  if (!view) return { title: "診断が見つかりません", robots: { index: false } };
  const title = `${view.nickname}について答えて`;
  return {
    title,
    description: `友達から見た ${view.nickname} の 16 タイプがわかる。${ANSWER_TIME_LABEL}・16〜32 問・匿名。`,
    robots: { index: false },
    openGraph: {
      title: `${title}｜たこ診`,
      description: `${ANSWER_TIME_LABEL}・16〜32 問・匿名で答えられます`,
    },
  };
}

export default async function Page({ params }: Props) {
  const { surveyId } = await params;
  return (
    <>
      <VisitCounter page="invite" />
      <RespondFlow surveyId={surveyId} />
    </>
  );
}
