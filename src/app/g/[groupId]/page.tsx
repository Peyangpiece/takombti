import type { Metadata } from "next";
import { cache } from "react";
import { getGroup } from "@/lib/groups";
import { isId } from "@/lib/http";
import { GroupPage } from "./GroupPage";

type Props = { params: Promise<{ groupId: string }> };

export const dynamic = "force-dynamic";

// 1 回の表示につき 1 回だけデータベースに問い合わせる。見出しには、だれにでも見せる値（作った人の呼び名）だけを使う
const loadGroup = cache((groupId: string) =>
  isId(groupId) ? getGroup(groupId, null) : Promise.resolve(null),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { groupId } = await params;
  const fallback: Metadata = {
    title: "グループ診断",
    robots: { index: false },
  };
  let view: Awaited<ReturnType<typeof getGroup>>;
  try {
    view = await loadGroup(groupId);
  } catch {
    // データベースにつながらなくても、ページは出す。見出しは決まりの文にする
    return fallback;
  }
  if (!view) return { ...fallback, title: "グループが見つかりません" };
  const title = `${view.creator}のグループ診断に参加しよう`;
  const description =
    "おたがいのことを答えあう他己診断。みんなに「周りから見たあなた」が届きます。登録なし・匿名。";
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title: `${title}｜たこ診`, description },
  };
}

export default async function Page({ params }: Props) {
  const { groupId } = await params;
  return <GroupPage groupId={groupId} />;
}
