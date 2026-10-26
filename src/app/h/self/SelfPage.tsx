"use client";
// 自己回答（仕様書 §4.4）。結果が確定するまでは何度でも出し直せる。

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AnswerFlow, type Draft } from "@/components/AnswerFlow";
import { Header, Loading, MissingHost } from "@/components/Shell";
import { Octopus } from "@/components/Octopus";
import { useHost } from "@/components/useHost";
import { QUESTIONS } from "@/data/questions";
import { hostApi } from "@/lib/client";

export function SelfPage() {
  const router = useRouter();
  const { state } = useHost();
  const [answering, setAnswering] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hostKey = state.kind === "ready" ? state.hostKey : null;
  const goShare = useCallback(
    () => hostKey && router.push(`/h/share#${hostKey}`),
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
      if (r?.ok) goShare();
      else if (r?.data.status === "not_open")
        setError("結果が確定したので、自己回答はもう変えられません");
      else setError("保存できませんでした。もう一度試してください");
    },
    [hostKey, goShare],
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
    const initial =
      draft ??
      (view.selfAnswers as Draft | null) ??
      Array(QUESTIONS.length).fill(null);
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
        <h1>先に自分でも答えておく？</h1>
        <p>
          「自分が思う自分」と「周りから見た自分」のギャップがわかります。答えた内容は友達には見えません。
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
          {view.hasSelf ? "答え直す（約 3 分）" : "答える（約 3 分）"}
        </button>
        <button type="button" className="btn secondary" onClick={goShare}>
          {view.hasSelf ? "このままにする" : "答えずに進む"}
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
