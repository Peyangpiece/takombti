"use client";
// 診断を作る（仕様書 §4.3）。入力は呼び名と人数の 2 つだけ。

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Shell";
import { saveSurvey, useDialogFocus } from "@/lib/client";
import { captureOrigin, currentOrigin, isTester, track } from "@/lib/track";
import { isEntry } from "@/data/funnel";
import { charLength, NICKNAME_MAX } from "@/lib/text";

const MIN = 3;
const MAX = 30;
// はじめの人数（§4.3）。回答が集まらずに結果まで届かない診断を減らすため、いちばん少ない 3 人にする
const DEFAULT_COUNT = 3;

const ERRORS: Record<string, string> = {
  empty: "呼び名を入れてください",
  too_long: `呼び名は ${NICKNAME_MAX} 文字までです`,
  ng_word: "その呼び名は使えません。別の呼び名にしてください",
  bad_target: `人数は ${MIN}〜${MAX} 人で選んでください`,
  rate_limited:
    "短い時間にたくさん作られています。しばらくしてから試してください",
};

// どこから作成画面に来たか（?entry=）
function entryOf(search: string): string {
  const v = new URLSearchParams(search).get("entry");
  return isEntry(v) ? v : "none";
}

export function NewForm() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [confirm, setConfirm] = useState(false);
  const dialogRef = useDialogFocus<HTMLDivElement>(confirm, () =>
    setConfirm(false),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hold = useRef<ReturnType<typeof setInterval> | null>(null);

  // 作成画面を開いたことを数える（内訳：流入元。§11.11）
  useEffect(() => {
    captureOrigin();
    track("create_view", currentOrigin().origin);
  }, []);

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
        body: JSON.stringify({
          nickname: trimmed,
          targetCount: count,
          // 計測のための入口・流入元（§11.11）。呼び名や人数とは別に、決まった値だけを送る
          ...currentOrigin(),
          entry: entryOf(window.location.search),
          test: isTester(),
        }),
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
      // 送る気持ちがいちばん強い作った直後は、先に招待リンクの共有を出す（自己回答は待つ間に。§4.4）
      router.push(`/h/share#${data.hostKey}`);
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
            まずは、確実に答えてくれる 3
            人がおすすめ。人数がそろうまで結果は見られません
          </p>
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {/* 同意の文は、押すボタンといっしょに画面の下に固定する（文が隠れたまま押せないように） */}
        <div className="bottom-bar stack with-note">
          <p className="muted small center">
            つくると、<a href="/terms">利用規約</a>と
            <a href="/privacy">プライバシーポリシー</a>
            に同意したことになります。本人の同意なく、他人についての診断は作らないでください。
          </p>
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
          ref={dialogRef}
        >
          <div className="dialog stack">
            <h2 id="confirm-title">この内容でつくる？</h2>
            <p>
              <b>{trimmed}</b> について <b>{count} 人</b>に答えてもらいます。
            </p>
            <p className="notice">
              人数は、あとからふやせます（へらせません）。
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
