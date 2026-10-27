"use client";
import { Header, Loading, MissingHost } from "@/components/Shell";
import { InviteShare, KeepHostLink } from "@/components/InviteShare";
import { useHost } from "@/components/useHost";

export function SharePage() {
  const { state } = useHost();
  if (state.kind === "loading") return <Loading />;
  if (state.kind !== "ready") return <MissingHost />;
  const { view, hostKey } = state;
  return (
    <main className="page stack">
      <Header />
      <h1 style={{ marginTop: 8 }}>友達にリンクを送ろう</h1>
      <p>
        <b>{view.targetCount} 人</b>が答えたら、結果が出ます。
        {view.responseCount >= view.targetCount
          ? "もう全員そろっています。"
          : view.responseCount > 0 &&
            `いま ${view.responseCount} 人が答えています（あと ${view.targetCount - view.responseCount} 人）。`}
      </p>
      <div className="card">
        <InviteShare surveyId={view.surveyId} />
      </div>
      <KeepHostLink hostKey={hostKey} />
      {/* 画面の下に固定しない。管理用リンクの保存のボタンが隠れないように */}
      <div>
        <a href={`/h#${hostKey}`} className="btn">
          回答状況を見る
        </a>
      </div>
    </main>
  );
}
