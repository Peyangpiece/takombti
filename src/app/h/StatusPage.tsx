"use client";
// 回答状況（仕様書 §4.6）。そろうまで、結果につながる情報は一切出さない。

import { useState } from "react";
import { Header, Loading, MissingHost } from "@/components/Shell";
import { DeleteSurvey } from "@/components/DeleteSurvey";
import { Octopus } from "@/components/Octopus";
import { useHost } from "@/components/useHost";
import { hostApi } from "@/lib/client";

function dateJa(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function StatusPage() {
  const { state, reload } = useHost({ poll: true });
  const [extending, setExtending] = useState(false);
  if (state.kind === "loading") return <Loading />;
  if (state.kind !== "ready") return <MissingHost />;
  const { view, hostKey } = state;
  const remaining = view.targetCount - view.responseCount;

  if (view.status === "completed") {
    return (
      <main className="page stack center">
        <Header />
        <div style={{ paddingTop: 32 }} className="stack">
          <Octopus code="ENFP" size={150} className="confetti" />
          <h1>そろった！</h1>
          <p>
            {view.targetCount} 人全員が答えてくれました。{view.nickname}{" "}
            の結果が出ています。
          </p>
        </div>
        <div className="bottom-bar stack">
          <a href={`/h/result#${hostKey}`} className="btn">
            結果を見る
          </a>
          {view.raiseMin !== null && (
            <a href={`/h/more#${hostKey}`} className="btn ghost">
              人数をふやして、もっと聞く
            </a>
          )}
        </div>
      </main>
    );
  }

  if (view.status === "expired") {
    return (
      <main className="page stack center">
        <Header />
        <h1 style={{ paddingTop: 32 }}>この診断は期限が切れました</h1>
        <p>
          受付の期限までに {view.targetCount}{" "}
          人がそろわなかったため、結果は出せません（{view.responseCount}{" "}
          人が回答）。
        </p>
        <a href="/new" className="btn">
          新しく作り直す
        </a>
        <DeleteSurvey hostKey={hostKey} />
      </main>
    );
  }

  return (
    <main className="page stack">
      <Header />
      <section className="card stack center" aria-live="polite">
        <p className="muted">{view.nickname} の診断</p>
        <p className="big-count">
          {view.responseCount}{" "}
          <span style={{ fontSize: 24 }}>/ {view.targetCount} 人</span>
        </p>
        <p style={{ fontWeight: 700 }}>回答ずみ</p>
        <div className="dots-progress" aria-hidden="true">
          {Array.from({ length: view.targetCount }, (_, i) => (
            <span key={i} className={i < view.responseCount ? "on" : ""} />
          ))}
        </div>
        <p style={{ fontSize: 20, fontWeight: 800, color: "var(--brand)" }}>
          あと {remaining} 人で結果発表！
        </p>
        <p className="muted small">
          人数がそろうまで、結果や途中の傾向はだれにも見えません。
        </p>
      </section>

      <a href={`/h/share#${hostKey}`} className="btn">
        もう一度リンクを送る
      </a>
      <a href={`/h/self#${hostKey}`} className="btn secondary">
        {view.hasSelf ? "自己回答を直す" : "自己回答をする"}
      </a>
      {view.raiseMin !== null && (
        <a href={`/h/more#${hostKey}`} className="btn secondary">
          人数をふやす
        </a>
      )}

      <section className="card stack">
        <p className="small">
          受付の期限：<b>{dateJa(view.expiresAt)}</b>
          {view.extended ? "（延長ずみ）" : ""}
        </p>
        {!view.extended && (
          <button
            type="button"
            className="btn secondary"
            disabled={extending}
            onClick={async () => {
              setExtending(true);
              await hostApi("/extend", hostKey, { method: "POST" }).catch(
                () => null,
              );
              await reload();
              setExtending(false);
            }}
          >
            期限を 30 日のばす（1 回だけ）
          </button>
        )}
        <DeleteSurvey hostKey={hostKey} />
      </section>
    </main>
  );
}
