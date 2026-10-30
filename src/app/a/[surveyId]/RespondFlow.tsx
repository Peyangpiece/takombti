"use client";
// 回答者の画面（仕様書 §4.7〜4.10・§4.13）。

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnswerFlow, emptyDraft, type Draft } from "@/components/AnswerFlow";
import { Octopus } from "@/components/Octopus";
import { RELATIONS, getType, type TypeCode } from "@/data/framework";
import { ANSWER_TIME_LABEL, QUESTIONS, sceneOf } from "@/data/questions";
import { safeGet, safeRemove, safeSet, savedSurveys } from "@/lib/client";
import { raterNeutralAxes, raterType } from "@/lib/scoring";
import { arrivalOrigin, track } from "@/lib/track";
import { answerTimeBucket, type Origin } from "@/data/funnel";

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
        "not_found" | "closed" | "expired" | "host" | "answered" | "network";
    }
  | { kind: "intro" }
  | { kind: "relation" }
  | { kind: "questions" }
  | { kind: "confirm" }
  | { kind: "sending" }
  // 送れなかった（通信が切れた・サーバーが一時的に失敗した）。答えは残したまま、送り直せる
  | { kind: "send_failed" }
  | {
      kind: "done";
      remaining: number;
      mine: TypeCode | null;
      neutral: number;
    }
  | { kind: "rate_limited" };

interface Saved {
  answers: Draft;
  index: number;
  // 最初に選ぶ関係。"none" は「答えない」（undefined はまだ選んでいない）
  relation?: string;
  // 回答を始めた時刻（回答の開始を同じ端末で 1 回だけ数え、かかった時間を出すため。§11.11）
  startedAt?: number;
  // この招待リンクをどの送り方で開いたか（初めて開いたときの値。§11.11）
  from?: Origin;
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
        if (!res.ok) return setStep({ kind: "error", reason: "network" });
        const data = (await res.json()) as PublicInfo;
        setInfo(data);
        const s = safeGet<Saved | null>(storeKey, null);
        if (
          s &&
          Array.isArray(s.answers) &&
          s.answers.length === QUESTIONS.length
        )
          setSaved(s);
        // もう答えられない診断なら、答えかけを端末に残さない（共有の端末で、ほかの人に読まれないように）
        if (data.isHost || data.answered || data.status !== "open")
          safeRemove(storeKey);
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
        body: JSON.stringify({
          answers,
          relation,
          // どの送り方で届いた招待リンクか（計測の内訳。§11.11）
          from: saved.from ?? arrivalOrigin(),
        }),
      });
      // Cloudflare の一時的な失敗（5xx）は、JSON ではなく HTML で返ることがある
      const data = (await res.json().catch(() => null)) as {
        status?: string;
        remaining?: number;
      } | null;
      switch (data?.status) {
        case "accepted":
        case "completed":
          if (saved.startedAt)
            track(
              "answer_time",
              answerTimeBucket((Date.now() - saved.startedAt) / 1000),
            );
          safeRemove(storeKey);
          return setStep({
            kind: "done",
            remaining: data.remaining ?? 0,
            mine: raterType(answers),
            neutral: raterNeutralAxes(answers),
          });
        case "duplicate":
          safeRemove(storeKey);
          return setStep({ kind: "error", reason: "answered" });
        // もう送れない答えは、端末に残さない
        case "closed":
          safeRemove(storeKey);
          return setStep({ kind: "error", reason: "closed" });
        case "expired":
          safeRemove(storeKey);
          return setStep({ kind: "error", reason: "expired" });
        case "host":
          safeRemove(storeKey);
          return setStep({ kind: "error", reason: "host" });
        case "rate_limited":
          return setStep({ kind: "rate_limited" });
        default:
          return setStep({ kind: "send_failed" });
      }
    } catch {
      setStep({ kind: "send_failed" });
    }
  }

  const [final, setFinal] = useState<number[] | null>(null);
  const onDone = useCallback((answers: number[]) => {
    setFinal(answers);
    setStep({ kind: "confirm" });
  }, []);

  const name = info?.nickname ?? "";

  // 画面（段階）が変わったら、読み上げとキーボードの位置を新しい画面の見出しへ移す。
  // 質問の画面は AnswerFlow が問ごとに移す。開いたときの最初の画面は、ふつうのページと同じく移さない
  const prevKind = useRef(step.kind);
  useEffect(() => {
    const prev = prevKind.current;
    prevKind.current = step.kind;
    if (prev === step.kind || prev === "loading" || step.kind === "questions")
      return;
    const h = document.querySelector<HTMLElement>("main h1");
    if (!h) return;
    h.tabIndex = -1;
    h.focus();
  }, [step.kind]);

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
    return (
      <ErrorView
        reason={step.reason}
        name={name}
        surveyId={surveyId}
        open={info?.status === "open"}
      />
    );
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
          {ANSWER_TIME_LABEL}・16〜32 問・匿名。この診断を作った人（{name}
          ）には、1
          人ずつの答えは表示されず、みんなの答えをまとめた結果だけが届きます。
        </p>
        <p className="muted small">答えによって、次の質問が変わります。</p>
        <p className="muted small">
          見たことのない行動は「わからない」を選べます。
        </p>
        <div className="bottom-bar stack with-note">
          <p className="muted small">
            答えると、<a href="/terms">利用規約</a>と
            <a href="/privacy">プライバシーポリシー</a>
            に同意したことになります。いじめや嫌がらせに使われている診断は、
            <a href="/contact">報告</a>してください。
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (!saved.startedAt) {
                const from = saved.from ?? arrivalOrigin();
                const next = { ...saved, startedAt: Date.now(), from };
                setSaved(next);
                safeSet(storeKey, next);
                track("answer_start", from);
              }
              setStep({
                kind: saved.relation === undefined ? "relation" : "questions",
              });
            }}
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

  if (step.kind === "send_failed") {
    return (
      <main className="page stack center" style={{ paddingTop: 64 }}>
        <Octopus code="ISFP" size={120} />
        <h1>送れませんでした</h1>
        <p>通信のよいところで、もう一度送ってください。</p>
        <p className="muted small">答えはこの画面に残っています。</p>
        <div className="bottom-bar stack">
          <button
            type="button"
            className="btn"
            disabled={!final}
            onClick={() => final && send(final)}
          >
            もう一度送る
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setStep({ kind: "questions" })}
          >
            質問にもどる
          </button>
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
      <p>回答を受け取りました。</p>
      <p>
        {name} の結果は、{info?.targetCount} 人そろったら {name}{" "}
        だけが見られます。
      </p>
      <p className="big-count">
        {step.remaining === 0 ? "そろった！" : `あと ${step.remaining} 人`}
      </p>
      {/* 答えてくれたお礼に、その人の答えだけから見たタイプを見せる（端末の中だけで出し、送らない） */}
      {step.mine && (
        <div className="card stack">
          <p className="small muted">あなたの答えから見ると…</p>
          <Octopus code={step.mine} size={96} />
          <p>
            <b>{name}</b> は <b>{getType(step.mine).name}</b>（{step.mine}）寄り
          </p>
          {step.neutral > 0 && (
            <p className="small">
              どちらとも言えない軸が {step.neutral}{" "}
              つあります。そこは決まらないので、仮に片方の文字で出しています。
            </p>
          )}
          <p className="muted small">
            これはあなたの答えだけから見たタイプです。
          </p>
        </div>
      )}
      {/* 回答を受け付けたあとにだけ出す。相手の呼び名や回答は、新しい診断に引き継がない（§4.10） */}
      <div className="card stack">
        <p>次は、あなたが周りからどう見えているか聞いてみる？</p>
        <Link href="/new?entry=thanks" className="btn">
          自分の診断をつくる
        </Link>
      </div>
    </main>
  );
}

function ErrorView({
  reason,
  name,
  surveyId,
  open,
}: {
  reason: "not_found" | "closed" | "expired" | "host" | "answered" | "network";
  name: string;
  surveyId: string;
  open: boolean;
}) {
  // 作った本人なら、この端末に覚えてある管理用の鍵で、自己回答と回答状況へ直接案内する
  const hostKey =
    reason === "host"
      ? (savedSurveys().find((s) => s.surveyId === surveyId)?.hostKey ?? null)
      : null;
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
      body: open
        ? "自分では答えられません。自分の見方は「自己回答」で答えられます。"
        : "自分では答えられません。",
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
      {reason === "host" && hostKey ? (
        <>
          {open && (
            <a href={`/h/self#${hostKey}`} className="btn">
              自己回答をする
            </a>
          )}
          <a href={`/h#${hostKey}`} className={open ? "btn secondary" : "btn"}>
            {open ? "回答状況を見る" : "つくった診断を見る"}
          </a>
        </>
      ) : reason === "host" ? (
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
