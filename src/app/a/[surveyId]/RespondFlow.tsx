"use client";
// 回答者の画面（仕様書 §4.7〜4.10・§4.13）。

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnswerFlow, emptyDraft, type Draft } from "@/components/AnswerFlow";
import { Octopus } from "@/components/Octopus";
import { RELATIONS } from "@/data/framework";
import { QUESTIONS, sceneOf } from "@/data/questions";
import { safeGet, safeRemove, safeSet } from "@/lib/client";

interface PublicInfo {
  nickname: string;
  status: "open" | "completed" | "expired";
  targetCount: number;
  remaining: number;
  isHost: boolean;
  answered: boolean;
}

type Step =
  | { kind: "loading" }
  | {
      kind: "error";
      reason:
        | "not_found"
        | "closed"
        | "expired"
        | "host"
        | "answered"
        | "network";
    }
  | { kind: "intro" }
  | { kind: "relation" }
  | { kind: "questions" }
  | { kind: "confirm" }
  | { kind: "sending" }
  | { kind: "done"; remaining: number }
  | { kind: "rate_limited" };

interface Saved {
  answers: Draft;
  index: number;
  // 最初に選ぶ関係。"none" は「答えない」（undefined はまだ選んでいない）
  relation?: string;
}

export function RespondFlow({ surveyId }: { surveyId: string }) {
  const storeKey = `takoshin:answer:${surveyId}`;
  const [info, setInfo] = useState<PublicInfo | null>(null);
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [saved, setSaved] = useState<Saved>({
    answers: emptyDraft(),
    index: 0,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/surveys/${surveyId}/public`, {
          cache: "no-store",
        });
        if (!alive) return;
        if (res.status === 404)
          return setStep({ kind: "error", reason: "not_found" });
        const data = (await res.json()) as PublicInfo;
        setInfo(data);
        const s = safeGet<Saved | null>(storeKey, null);
        if (
          s &&
          Array.isArray(s.answers) &&
          s.answers.length === QUESTIONS.length
        )
          setSaved(s);
        if (data.isHost) return setStep({ kind: "error", reason: "host" });
        if (data.answered)
          return setStep({ kind: "error", reason: "answered" });
        if (data.status === "expired")
          return setStep({ kind: "error", reason: "expired" });
        if (data.status !== "open")
          return setStep({ kind: "error", reason: "closed" });
        setStep({ kind: "intro" });
      } catch {
        if (alive) setStep({ kind: "error", reason: "network" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [surveyId, storeKey]);

  const onChange = useCallback(
    (answers: Draft, index: number) => {
      setSaved((prev) => {
        const next = { ...prev, answers, index };
        safeSet(storeKey, next);
        return next;
      });
    },
    [storeKey],
  );

  const relation =
    saved.relation && saved.relation !== "none" ? saved.relation : null;

  async function send(answers: number[]) {
    setStep({ kind: "sending" });
    try {
      const res = await fetch(`/api/surveys/${surveyId}/responses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers, relation }),
      });
      const data = (await res.json()) as { status: string; remaining?: number };
      switch (data.status) {
        case "accepted":
        case "completed":
          safeRemove(storeKey);
          return setStep({ kind: "done", remaining: data.remaining ?? 0 });
        case "duplicate":
          safeRemove(storeKey);
          return setStep({ kind: "error", reason: "answered" });
        case "closed":
          return setStep({ kind: "error", reason: "closed" });
        case "expired":
          return setStep({ kind: "error", reason: "expired" });
        case "host":
          return setStep({ kind: "error", reason: "host" });
        case "rate_limited":
          return setStep({ kind: "rate_limited" });
        default:
          return setStep({ kind: "error", reason: "network" });
      }
    } catch {
      setStep({ kind: "error", reason: "network" });
    }
  }

  const [final, setFinal] = useState<number[] | null>(null);
  const onDone = useCallback((answers: number[]) => {
    setFinal(answers);
    setStep({ kind: "confirm" });
  }, []);

  const name = info?.nickname ?? "";

  if (step.kind === "loading") {
    return (
      <main className="page center" aria-busy="true">
        <p className="muted" style={{ marginTop: "40dvh" }}>
          読み込み中…
        </p>
      </main>
    );
  }

  if (step.kind === "error") {
    return <ErrorView reason={step.reason} name={name} />;
  }

  if (step.kind === "intro") {
    const resumed = saved.answers.some((a) => a !== null);
    return (
      <main className="page stack center" style={{ paddingTop: 48 }}>
        <Octopus code="ENFP" size={140} />
        <h1>
          <span style={{ color: "var(--brand)" }}>{name}</span> について
          <br />
          答えてください
        </h1>
        <p>
          約 3 分・16〜32 問・匿名。{name}
          には、だれが何と答えたかは見えません。
        </p>
        <p className="muted small">答えによって、次の質問が変わります。</p>
        <p className="muted small">
          見たことのない行動は「わからない」を選べます。
        </p>
        <p className="muted small">
          答えると、<a href="/terms">利用規約</a>と
          <a href="/privacy">プライバシーポリシー</a>
          に同意したことになります。
        </p>
        <div className="bottom-bar">
          <button
            type="button"
            className="btn"
            onClick={() =>
              setStep({
                kind: saved.relation === undefined ? "relation" : "questions",
              })
            }
          >
            {resumed ? "続きから答える" : "はじめる"}
          </button>
        </div>
      </main>
    );
  }

  if (step.kind === "questions") {
    return (
      <main className="page">
        <AnswerFlow
          name={name}
          scene={sceneOf(relation)}
          initial={saved.answers}
          initialIndex={saved.index}
          allowUnknown
          onChange={onChange}
          onBack={() => setStep({ kind: "relation" })}
          onDone={onDone}
        />
      </main>
    );
  }

  if (step.kind === "relation") {
    // 最初に関係を聞き、その関係で見られる場面の言い方で質問する（§3.6）
    const choose = (id: string) => {
      setSaved((prev) => {
        const next = { ...prev, relation: id };
        safeSet(storeKey, next);
        return next;
      });
      setStep({ kind: "questions" });
    };
    return (
      <main className="page stack">
        <div className="q-top">
          <button
            type="button"
            className="icon-btn"
            aria-label="もどる"
            onClick={() => setStep({ kind: "intro" })}
          >
            ←
          </button>
          <div className="q-count">はじめに</div>
          <span />
        </div>
        <h1 className="q-text" style={{ minHeight: 0, marginTop: 24 }}>
          <span>
            <span className="name">{name}</span>とはどんな関係？
          </span>
        </h1>
        <p className="muted small">
          その関係で見られる場面に合わせて、質問の言い方を変えます。
        </p>
        <div className="choice-list" role="group" aria-label="関係">
          {RELATIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              className="choice"
              aria-pressed={saved.relation === r.id}
              onClick={() => choose(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn ghost"
          onClick={() => choose("none")}
        >
          答えない
        </button>
        <p className="muted small">
          同じ関係を選んだ人が 3
          人以上いるときだけ、関係ごとのまとめにも使います。
        </p>
      </main>
    );
  }

  if (step.kind === "confirm" || step.kind === "sending") {
    const sending = step.kind === "sending";
    return (
      <main className="page stack center" style={{ paddingTop: 48 }}>
        <Octopus code="ISFJ" size={120} />
        <h1>これで全部です</h1>
        <p>送ると、答えは変えられません。</p>
        <div className="bottom-bar stack">
          <button
            type="button"
            className="btn"
            disabled={sending || !final}
            onClick={() => final && send(final)}
          >
            {sending ? "送っています…" : "送る"}
          </button>
          {!sending && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => setStep({ kind: "questions" })}
            >
              質問にもどる
            </button>
          )}
        </div>
      </main>
    );
  }

  if (step.kind === "rate_limited") {
    return (
      <main className="page stack center" style={{ paddingTop: 64 }}>
        <h1>少し時間をおいてね</h1>
        <p>
          同じ回線からの回答が多すぎるため、いまは受け付けられません。1
          時間ほどたってから、もう一度送ってください。
        </p>
        <button
          type="button"
          className="btn"
          onClick={() => setStep({ kind: "confirm" })}
        >
          もう一度送る
        </button>
      </main>
    );
  }

  return (
    <main className="page stack center" style={{ paddingTop: 48 }}>
      <Octopus code="ESFP" size={140} className="confetti" />
      <h1>ありがとう！</h1>
      <p>
        {name} の結果は、{info?.targetCount} 人そろったら {name}{" "}
        だけが見られます。
      </p>
      <p className="big-count">
        {step.remaining === 0 ? "そろった！" : `あと ${step.remaining} 人`}
      </p>
      <div className="card stack">
        <p>あなたも友達に答えてもらう？</p>
        <Link href="/new" className="btn">
          自分の診断をつくる
        </Link>
      </div>
    </main>
  );
}

function ErrorView({
  reason,
  name,
}: {
  reason: "not_found" | "closed" | "expired" | "host" | "answered" | "network";
  name: string;
}) {
  const text = {
    not_found: {
      title: "この診断は見つかりませんでした",
      body: "リンクがまちがっているか、もう削除されています。",
    },
    closed: {
      title: `${name} の診断はもう締め切りました`,
      body: "ありがとう！ 人数がそろったので、受付は終わっています。",
    },
    expired: {
      title: "この診断は期限が切れました",
      body: "受付の期限を過ぎたため、回答できません。",
    },
    host: {
      title: "これはあなたの診断です",
      body: "自分では答えられません。自分の見方は「自己回答」で答えられます。",
    },
    answered: {
      title: "もう答えてくれています",
      body: "ありがとう！ 同じ診断には 1 回だけ答えられます。",
    },
    network: {
      title: "うまく読み込めませんでした",
      body: "通信の状態を確かめて、もう一度開いてください。",
    },
  }[reason];
  return (
    <main className="page stack center" style={{ paddingTop: 64 }}>
      <Octopus code="ISFP" size={120} />
      <h1>{text.title}</h1>
      <p>{text.body}</p>
      {reason === "host" ? (
        <Link href="/" className="btn">
          つくった診断を見る
        </Link>
      ) : reason === "network" ? (
        <button
          type="button"
          className="btn"
          onClick={() => window.location.reload()}
        >
          もう一度読み込む
        </button>
      ) : (
        <Link href="/new" className="btn">
          あなたも診断をつくる
        </Link>
      )}
    </main>
  );
}
