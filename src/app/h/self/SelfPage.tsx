"use client";
// 自己回答（仕様書 §4.4）。結果が確定するまでは何度でも出し直せる。

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AnswerFlow, emptyDraft, type Draft } from "@/components/AnswerFlow";
import { Header, Loading, MissingHost } from "@/components/Shell";
import { Octopus } from "@/components/Octopus";
import { useHost } from "@/components/useHost";
import { ANSWER_TIME_LABEL, QUESTIONS } from "@/data/questions";
import { hostApi } from "@/lib/client";
import { NOT_ASKED } from "@/lib/scoring";

export function SelfPage() {
  const router = useRouter();
  const { state } = useHost();
  const [answering, setAnswering] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hostKey = state.kind === "ready" ? state.hostKey : null;
  // 招待リンクは先に送ってあるので、答えたあとは回答状況へ戻る
  const goStatus = useCallback(
    () => hostKey && router.push(`/h#${hostKey}`),
    [hostKey, router],
  );

  const onDone = useCallback(
    async (answers: number[]) => {
      if (!hostKey) return;
      setSaving(true);
      const r = await hostApi<{ status: string }>("/self", hostKey, {
        method: "PUT",
        body: JSON.stringify({ answers }),
      }).catch(() => null);
      setSaving(false);
      if (r?.ok) goStatus();
      else if (r?.data.status === "not_open")
        setError("結果が確定したので、自己回答はもう変えられません");
      else setError("保存できませんでした。もう一度試してください");
    },
    [hostKey, goStatus],
  );

  if (state.kind === "loading") return <Loading />;
  if (state.kind !== "ready") return <MissingHost />;
  const { view } = state;

  if (view.status !== "open") {
    return (
      <main className="page stack center" style={{ paddingTop: 48 }}>
        <h1>自己回答はもう変えられません</h1>
        <p>
          結果が確定した後に答えると、結果に引きずられてギャップが正しく出ないためです。
        </p>
        <a href={`/h#${state.hostKey}`} className="btn">
          診断の画面へ
        </a>
      </main>
    );
  }

  if (answering) {
    // 前に保存した答えから始める。出していない問（NOT_ASKED）は「まだ」に戻す
    const savedSelf =
      view.selfAnswers && view.selfAnswers.length === QUESTIONS.length
        ? view.selfAnswers.map((a) => (a === NOT_ASKED ? null : a))
        : null;
    const initial = draft ?? savedSelf ?? emptyDraft();
    return (
      <main className="page">
        {saving && <p className="notice">保存しています…</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <AnswerFlow
          name={null}
          scene="general"
          initial={initial}
          allowUnknown={false}
          onChange={(a) => setDraft(a)}
          onBack={() => setAnswering(false)}
          onDone={onDone}
        />
      </main>
    );
  }

  return (
    <main className="page stack">
      <Header />
      <div className="center stack" style={{ paddingTop: 16 }}>
        <Octopus code="INFJ" size={120} />
        <h1>自分でも答えておく？</h1>
        <p>
          「自分が思う自分」と「周りから見た自分」のギャップがわかります。答えた内容は友達には見えません。
        </p>
        <p className="muted small">
          16〜32 問。答えによって、次の質問が変わります。
        </p>
        {view.hasSelf && (
          <p className="notice">
            自己回答はもう保存されています。答え直すこともできます。
          </p>
        )}
      </div>
      <div className="bottom-bar stack">
        <button
          type="button"
          className="btn"
          onClick={() => setAnswering(true)}
        >
          {view.hasSelf
            ? `答え直す（${ANSWER_TIME_LABEL}）`
            : `答える（${ANSWER_TIME_LABEL}）`}
        </button>
        <button type="button" className="btn secondary" onClick={goStatus}>
          {view.hasSelf ? "このままにする" : "答えずに戻る"}
        </button>
        {!view.hasSelf && (
          <p className="muted small center">
            結果が出るまでは、あとからでも答えられます
          </p>
        )}
      </div>
    </main>
  );
}
