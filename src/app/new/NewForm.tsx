"use client";
// 診断を作る（仕様書 §4.3）。入力は呼び名と人数の 2 つだけ。

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Shell";
import { saveSurvey } from "@/lib/client";
import { charLength, NICKNAME_MAX } from "@/lib/text";

const MIN = 3;
const MAX = 30;

const ERRORS: Record<string, string> = {
  empty: "呼び名を入れてください",
  too_long: `呼び名は ${NICKNAME_MAX} 文字までです`,
  ng_word: "その呼び名は使えません。別の呼び名にしてください",
  bad_target: `人数は ${MIN}〜${MAX} 人で選んでください`,
};

export function NewForm() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [count, setCount] = useState(5);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [why, setWhy] = useState(false);
  const hold = useRef<ReturnType<typeof setInterval> | null>(null);

  const trimmed = nickname.trim();
  const len = charLength(trimmed);
  const valid = len > 0 && len <= NICKNAME_MAX;

  const step = (d: number) =>
    setCount((c) => Math.min(MAX, Math.max(MIN, c + d)));
  // 長押しで連続して変わる（押してから 0.4 秒たってから）
  const startHold = (d: number) => {
    step(d);
    stopHold();
    let ticks = 0;
    hold.current = setInterval(() => {
      ticks += 1;
      if (ticks > 4) step(d);
    }, 90);
  };
  const stopHold = () => {
    if (hold.current) clearInterval(hold.current);
    hold.current = null;
  };

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname: trimmed, targetCount: count }),
      });
      const data = (await res.json()) as {
        surveyId?: string;
        hostKey?: string;
        error?: string;
      };
      if (!res.ok || !data.hostKey || !data.surveyId) {
        setError(
          ERRORS[data.error ?? ""] ??
            "うまく作れませんでした。もう一度試してください",
        );
        setConfirm(false);
        return;
      }
      saveSurvey({
        hostKey: data.hostKey,
        surveyId: data.surveyId,
        nickname: trimmed,
        createdAt: new Date().toISOString(),
      });
      router.push(`/h/self#${data.hostKey}`);
    } catch {
      setError(
        "通信できませんでした。電波のよいところでもう一度試してください",
      );
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page stack">
      <Header />
      <h1 style={{ marginTop: 8 }}>診断をつくる</h1>

      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) setConfirm(true);
        }}
      >
        <div className="card">
          <label className="label" htmlFor="nickname">
            呼び名
          </label>
          <input
            id="nickname"
            className="input"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="たろう・はなちゃん など"
            autoComplete="off"
            enterKeyHint="done"
            aria-describedby="nickname-preview"
          />
          <p
            id="nickname-preview"
            className="muted small"
            style={{ marginTop: 8 }}
          >
            質問はこう出ます：「
            <b style={{ color: "var(--brand)" }}>{trimmed || "たろう"}</b>
            は、初対面の人がいても自分から話しかけにいく」
          </p>
          <p className="muted small">
            本名でなくてかまいません。{len}/{NICKNAME_MAX} 文字
          </p>
          {len > NICKNAME_MAX && (
            <p className="error">呼び名は {NICKNAME_MAX} 文字までです</p>
          )}
        </div>

        <div className="card stack center">
          <div className="label" id="count-label" style={{ marginBottom: 0 }}>
            何人に答えてもらう？
          </div>
          <div className="stepper" role="group" aria-labelledby="count-label">
            <button
              type="button"
              aria-label="1 人へらす"
              disabled={count <= MIN}
              onPointerDown={() => startHold(-1)}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
              onKeyDown={(e) =>
                (e.key === "Enter" || e.key === " ") &&
                (e.preventDefault(), step(-1))
              }
            >
              −
            </button>
            <span className="num" aria-live="polite">
              {count}
              <span style={{ fontSize: 20 }}>人</span>
            </span>
            <button
              type="button"
              aria-label="1 人ふやす"
              disabled={count >= MAX}
              onPointerDown={() => startHold(1)}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
              onKeyDown={(e) =>
                (e.key === "Enter" || e.key === " ") &&
                (e.preventDefault(), step(1))
              }
            >
              ＋
            </button>
          </div>
          <p className="small">
            人数がそろうまで結果は見られません。確実に答えてくれる人数にしよう
          </p>
          <button
            type="button"
            className="btn ghost small"
            onClick={() => setWhy(!why)}
            aria-expanded={why}
          >
            ? なぜ 3 人から？
          </button>
          {why && (
            <p className="muted small">
              2 人以下だと、だれが何と答えたか推測できてしまうためです。
            </p>
          )}
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="muted small center">
          つくると、<a href="/terms">利用規約</a>と
          <a href="/privacy">プライバシーポリシー</a>
          に同意したことになります。本人の同意なく、他人についての診断は作らないでください。
        </p>
        <div className="bottom-bar">
          <button type="submit" className="btn" disabled={!valid || busy}>
            つくる
          </button>
        </div>
      </form>

      {confirm && (
        <div
          className="dialog-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div className="dialog stack">
            <h2 id="confirm-title">この内容でつくる？</h2>
            <p>
              <b>{trimmed}</b> について <b>{count} 人</b>に答えてもらいます。
            </p>
            <p className="notice">
              つくったあとは人数を変えられません。{count}{" "}
              人そろったときに、はじめて結果が出ます。
            </p>
            <button
              type="button"
              className="btn"
              onClick={create}
              disabled={busy}
            >
              {busy ? "つくっています…" : "つくる"}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setConfirm(false)}
              disabled={busy}
            >
              もどる
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
