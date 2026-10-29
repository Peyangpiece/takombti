"use client";
import { Header, Loading, MissingHost } from "@/components/Shell";
import { InviteShare, KeepHostLink } from "@/components/InviteShare";
import { useHost } from "@/components/useHost";
import { SelfPrompt } from "@/components/SelfPrompt";

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
        {view.selfOpen && !view.hasSelf && (
          <>
            待っている間に、
            <a href={`/h/self#${hostKey}`}>自己回答</a>もできます。
          </>
        )}
      </p>
      <div className="card">
        <InviteShare
          surveyId={view.surveyId}
          targetCount={view.targetCount}
          answered={view.responseCount}
        />
      </div>
      {/* 自己回答は、リンクを送ったあと待っている間に（結果が出るまではいつでも答えられる。§4.4）。
          見落とされないよう、招待の欄のすぐ下に置く */}
      {view.selfOpen && !view.hasSelf && <SelfPrompt hostKey={hostKey} />}
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
