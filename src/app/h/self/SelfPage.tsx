"use client";
// 自己回答（仕様書 §4.4）。診断がある間（受付中・結果が出たあと）は、いつでも答え直せる。

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AnswerFlow,
  emptyDraft,
  hasFollowAnswers,
  type Draft,
} from "@/components/AnswerFlow";
import { Header, LoadError, Loading, MissingHost } from "@/components/Shell";
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
  const completed = state.kind === "ready" && state.view.status === "completed";
  // 結果が出ていれば結果の画面（「周りと自分の比較」がすぐ出る）へ、まだなら回答状況へ戻る
  // （招待リンクは先に送ってあるので）
  const goBack = useCallback(
    () =>
      hostKey &&
      router.push(completed ? `/h/result#${hostKey}` : `/h#${hostKey}`),
    [hostKey, router, completed],
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
      if (r?.ok) goBack();
      else if (r?.data.status === "not_open")
        setError("受付の期限が切れたため、自分の答えを保存できませんでした");
      else setError("保存できませんでした。もう一度試してください");
    },
    [hostKey, goBack],
  );

  if (state.kind === "loading") return <Loading />;
  if (state.kind === "error") return <LoadError />;
  if (state.kind !== "ready") return <MissingHost />;
  const { view } = state;

  if (!view.selfOpen) {
    return (
      <main className="page stack center" style={{ paddingTop: 48 }}>
        <h1>この診断では、自分で答えることはできません</h1>
        <p>
          受付の期限が切れた診断や、前の版の質問で作った診断には答えられません。
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
          more={hasFollowAnswers(initial)}
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
        <h1>{completed ? "自分でも答えてみる？" : "自分でも答えておく？"}</h1>
        <p>
          「自分が思う自分」と「周りから見た自分」のギャップが分かります。
          <span style={{ whiteSpace: "nowrap" }}>16 問</span>、
          {ANSWER_TIME_LABEL}。答えた内容は友達には見えません。
        </p>
        {completed && (
          <p className="muted small">
            答え終えると、結果の画面の「周りと自分の比較」にすぐ出ます。結果を見たあとに答えた場合は、そのことを比較の下に書き添えます。
          </p>
        )}
        {view.hasSelf && (
          <p className="notice">
            自分の答えはもう保存されています。直すこともできます。
          </p>
        )}
      </div>
      <div className="bottom-bar stack">
        <button
          type="button"
          className="btn"
          onClick={() => setAnswering(true)}
        >
          {view.hasSelf ? "答え直す" : "答える"}
        </button>
        <button type="button" className="btn secondary" onClick={goBack}>
          {view.hasSelf ? "このままにする" : "答えずにもどる"}
        </button>
        {!view.hasSelf && (
          <p className="muted small center">結果が出たあとでも答えられます</p>
        )}
      </div>
    </main>
  );
}
