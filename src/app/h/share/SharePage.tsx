"use client";
import { Header, Loading, MissingHost } from "@/components/Shell";
import { InviteShare, KeepHostLink } from "@/components/InviteShare";
import { useHost } from "@/components/useHost";
import { ANSWER_TIME_LABEL } from "@/data/questions";

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
        <InviteShare
          surveyId={view.surveyId}
          targetCount={view.targetCount}
          answered={view.responseCount}
        />
      </div>
      <KeepHostLink hostKey={hostKey} />
      {/* 自己回答は、リンクを送ったあと待っている間に（結果が出るまではいつでも答えられる。§4.4） */}
      {view.status === "open" && !view.hasSelf && (
        <div className="card stack">
          <b>待っている間に、自分でも答えておく？</b>
          <p className="small">
            「自分が思う自分」と「周りから見た自分」のギャップがわかります。答えた内容は友達には見えません。
          </p>
          <a href={`/h/self#${hostKey}`} className="btn secondary">
            自己回答をする（{ANSWER_TIME_LABEL}）
          </a>
        </div>
      )}
      {/* 画面の下に固定しない。管理用リンクの保存のボタンが隠れないように */}
      <div>
        <a href={`/h#${hostKey}`} className="btn">
          回答状況を見る
        </a>
      </div>
    </main>
  );
}
