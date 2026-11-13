"use client";
// 回答状況（仕様書 §4.6）。そろうまで、結果につながる情報は一切出さない。

import { useState } from "react";
import { Header, LoadError, Loading, MissingHost } from "@/components/Shell";
import { DeleteSurvey } from "@/components/DeleteSurvey";
import { NotifyCard } from "@/components/NotifyCard";
import { RemindShare } from "@/components/InviteShare";
import { SelfPrompt } from "@/components/SelfPrompt";
import { Octopus } from "@/components/Octopus";
import { useHost } from "@/components/useHost";
import { hostApi, useClientValue } from "@/lib/client";

function dateJa(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// 期限ののばし方を目立たせるのは、残りがこの日数以下になってから（§4.6）。
// 作った直後から大きなボタンがあると、急がなくてよいのに目に入るため
export const EXTEND_SOON_DAYS = 7;

// 受付の期限の日まで、あと何日か（画面に出す日付と合うよう、時刻ではなく端末の暦の日付で数える。
// 期限が今日なら 0、過ぎていれば負）
export function daysLeft(expiresAt: string, now: number): number {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round(
    (day(new Date(expiresAt)) - day(new Date(now))) / 86_400_000,
  );
}

export function StatusPage() {
  const { state, reload } = useHost({ poll: true });
  const [extending, setExtending] = useState(false);
  // いまの時刻（分の単位。画面を描くたびに値が変わらないように）。サーバーでは 0
  const nowMin = useClientValue(() => Math.floor(Date.now() / 60_000), 0);
  if (state.kind === "loading") return <Loading />;
  if (state.kind === "error") return <LoadError onRetry={reload} />;
  if (state.kind !== "ready") return <MissingHost />;
  const { view, hostKey } = state;
  const remaining = view.targetCount - view.responseCount;
  // 期限が近い（残り 7 日以下）ときだけ、のばすボタンを目立たせる。時刻がまだ分からないあいだは控えめなまま
  const left = nowMin > 0 ? daysLeft(view.expiresAt, nowMin * 60_000) : null;
  const soon = left !== null && left <= EXTEND_SOON_DAYS;
  const extend = async () => {
    setExtending(true);
    await hostApi("/extend", hostKey, { method: "POST" }).catch(() => null);
    await reload();
    setExtending(false);
  };

  if (view.status === "completed") {
    return (
      <main className="page stack center">
        <Header />
        <div style={{ paddingTop: 32 }} className="stack">
          <Octopus code="ENFP" size={150} className="confetti" />
          <h1>そろった！</h1>
          <p>
            {view.targetCount} 人全員が答えてくれました。
            {view.nickname}の結果が出ています。
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
        <h1 className="muted" style={{ fontSize: 16, fontWeight: 400 }}>
          {view.nickname}の診断
        </h1>
        <p className="big-count">
          {view.responseCount}{" "}
          <span style={{ fontSize: 24 }}>/ {view.targetCount} 人 回答ずみ</span>
        </p>
        {/* 人数ぶんのタコ。答えた人のぶんだけ色がつく（だれが答えたかは表さない。左から順に色をつけるだけ） */}
        <div className="tako-count" aria-hidden="true">
          {Array.from({ length: view.targetCount }, (_, i) => (
            <Octopus
              key={i}
              size={view.targetCount > 12 ? 32 : 44}
              className={i < view.responseCount ? "on" : undefined}
            />
          ))}
        </div>
        <p style={{ fontSize: 20, fontWeight: 800, color: "var(--brand)" }}>
          あと {remaining} 人で結果発表！
        </p>
        <p className="muted small">
          そろうまで、結果も途中の傾向も見えません。
        </p>
      </section>

      {/* グループ診断（§4.16）で作った診断なら、ほかのメンバーに答えるため、グループのページへ戻れるようにする */}
      {view.groupId && (
        <a href={`/g/${view.groupId}#${hostKey}`} className="btn">
          グループのページへ（みんなについて答える）
        </a>
      )}
      {/* まだの人へのお願い（§4.6）。だれが答えたかは分からないので、あと何人かだけを入れる。
          送るためのカードはこれ 1 つにし、招待の文の見直し・QR コードなどは、カードの中の控えめなリンクから */}
      {remaining > 0 ? (
        <RemindShare
          surveyId={view.surveyId}
          nickname={view.nickname}
          remaining={remaining}
          shareHref={`/h/share#${hostKey}`}
        />
      ) : (
        <a href={`/h/share#${hostKey}`} className="btn secondary">
          招待の文を見直す・ほかの方法で送る
        </a>
      )}
      {/* 自己回答は待っている間に答えてもらいたいので、リンクを送るカードのすぐ下に置く（§4.4・§4.6）。
          結果が出たあとも答えられる（期限切れの診断ではできない） */}
      {view.selfOpen &&
        (view.hasSelf ? (
          <a href={`/h/self#${hostKey}`} className="btn secondary">
            自分の答えを直す
          </a>
        ) : (
          <SelfPrompt hostKey={hostKey} />
        ))}
      <NotifyCard hostKey={hostKey} />
      {view.raiseMin !== null && (
        <a href={`/h/more#${hostKey}`} className="btn secondary">
          人数をふやす
        </a>
      )}

      <section className="card stack">
        <p className="small">
          受付の期限：<b>{dateJa(view.expiresAt)}</b>
          {soon && left !== null && left >= 0
            ? left === 0
              ? "（今日まで）"
              : `（あと ${left} 日）`
            : ""}
          {view.extended ? "（延長ずみ）" : ""}
        </p>
        {!view.extended &&
          (soon ? (
            <button
              type="button"
              className="btn secondary"
              disabled={extending}
              onClick={extend}
            >
              期限を 30 日のばす（1 回だけ）
            </button>
          ) : (
            <button
              type="button"
              className="link-btn small"
              style={{ textDecoration: "underline" }}
              disabled={extending}
              onClick={extend}
            >
              期限を 30 日のばす（1 回だけ）
            </button>
          ))}
        <DeleteSurvey hostKey={hostKey} />
      </section>
    </main>
  );
}
