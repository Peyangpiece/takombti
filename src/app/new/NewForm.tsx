"use client";
// 診断を作る（仕様書 §4.3）。入力は呼び名と人数の 2 つだけ。

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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

  // 長押しで連続して変えたか（変えたなら、指を離したあとの click では 1 つ足さない）
  const repeated = useRef(false);

  const step = (d: number) =>
    setCount((c) => Math.min(MAX, Math.max(MIN, c + d)));
  // ＋・− は click で 1 つずつ変える（画面の読み上げやキーボードからは click だけが届くため）。
  // 指やマウスで長押しすると、押してから 0.45 秒たってから連続して変わる
  const startHold = (d: number) => {
    stopHold();
    repeated.current = false;
    let ticks = 0;
    hold.current = setInterval(() => {
      ticks += 1;
      if (ticks > 4) {
        repeated.current = true;
        step(d);
      }
    }, 90);
  };
  const stopHold = () => {
    if (hold.current) clearInterval(hold.current);
    hold.current = null;
    // 離したあとに続く click を読み終えてから、印を消す（外で離して click が来ないときのため）
    if (repeated.current)
      setTimeout(() => {
        repeated.current = false;
      }, 0);
  };
  const clickStep = (d: number) => {
    if (repeated.current) return;
    step(d);
  };
  // 端まで来たら、連続して変えるのをやめる（ボタンが押せなくなり、指を離したことが届かないため）
  useEffect(() => {
    if (count > MIN && count < MAX) return;
    if (hold.current) clearInterval(hold.current);
    hold.current = null;
    const t = setTimeout(() => {
      repeated.current = false;
    }, 0);
    return () => clearTimeout(t);
  }, [count]);

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
        setBusy(false);
        return;
      }
      saveSurvey({
        hostKey: data.hostKey,
        surveyId: data.surveyId,
        nickname: trimmed,
        createdAt: new Date().toISOString(),
      });
      // 送る気持ちがいちばん強い作った直後は、先に招待リンクの共有を出す（自己回答は待つ間に。§4.4）。
      // 移るまでのあいだに二度作らないよう、押せないまま（busy）にしておく
      router.push(`/h/share#${data.hostKey}`);
    } catch {
      setError(
        "通信できませんでした。電波のよいところでもう一度試してください",
      );
      setConfirm(false);
      setBusy(false);
    }
  }

  return (
    <main className="page stack">
      <Header />
      <h1 style={{ marginTop: 8 }}>診断をつくる</h1>
      <p className="small">
        友達グループ（4〜8 人）で、みんな一度に知りたいなら →{" "}
        <Link href="/g/new">グループでいっせいに</Link>
      </p>

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
              onClick={() => clickStep(-1)}
              onPointerDown={() => startHold(-1)}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
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
              onClick={() => clickStep(1)}
              onPointerDown={() => startHold(1)}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
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
