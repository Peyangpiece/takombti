"use client";
// グループ診断を作る（仕様書 §4.16）。入力は自分の呼び名と、グループの人数の 2 つだけ。

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Shell";
import { saveGroup } from "@/lib/client";
import { captureOrigin, currentOrigin, isTester } from "@/lib/track";
import { charLength, NICKNAME_MAX } from "@/lib/text";
import { ANSWER_TIME_LABEL } from "@/data/questions";

const MIN = 4;
const MAX = 8;
const DEFAULT_SIZE = 5;

const ERRORS: Record<string, string> = {
  empty: "呼び名を入れてください",
  too_long: `呼び名は ${NICKNAME_MAX} 文字までです`,
  ng_word: "その呼び名は使えません。別の呼び名にしてください",
  bad_size: `人数は ${MIN}〜${MAX} 人で選んでください`,
  rate_limited:
    "短い時間にたくさん作られています。しばらくしてから試してください",
};

export function GroupNewForm() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    captureOrigin();
  }, []);

  const trimmed = nickname.trim();
  const len = charLength(trimmed);
  const valid = len > 0 && len <= NICKNAME_MAX;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname: trimmed,
          size,
          // 計測のための流入元（§11.11）。決まった値だけを送る
          ...currentOrigin(),
          test: isTester(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        groupId?: string;
        hostKey?: string;
        adminKey?: string;
        error?: string;
      };
      if (!res.ok || !data.groupId || !data.hostKey || !data.adminKey) {
        setError(
          ERRORS[data.error ?? ""] ??
            "うまく作れませんでした。もう一度試してください",
        );
        setBusy(false);
        return;
      }
      saveGroup({
        groupId: data.groupId,
        hostKey: data.hostKey,
        adminKey: data.adminKey,
        nickname: trimmed,
        createdAt: new Date().toISOString(),
      });
      // 移るまでのあいだに二度作らないよう、押せないまま（busy）にしておく
      router.push(`/g/${data.groupId}`);
    } catch {
      setError(
        "通信できませんでした。電波のよいところでもう一度試してください",
      );
      setBusy(false);
    }
  }

  return (
    <main className="page stack">
      <Header />
      <h1 style={{ marginTop: 8 }}>グループでいっせいに</h1>
      <p>
        友達どうしで、おたがいのことを答えあう。みんなに「周りから見たあなた」が届きます。
      </p>
      <ol className="steps" aria-label="使い方" style={{ padding: 0 }}>
        {[
          ["グループのリンクを送る", "友達が呼び名を入れて参加します"],
          [
            "そろったら、ほかの人について答える",
            `1 人につき${ANSWER_TIME_LABEL}・匿名`,
          ],
          [
            "自分の結果は、自分だけが見られる",
            "ほかの人みんなが答えたら結果発表",
          ],
        ].map(([title, body], i) => (
          <li className="card" key={title} style={{ listStyle: "none" }}>
            <span className="num-badge">{i + 1}</span>
            <div>
              <b>{title}</b>
              <p className="muted small">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !busy) void create();
        }}
      >
        <div className="card">
          <label className="label" htmlFor="nickname">
            あなたの呼び名
          </label>
          <input
            id="nickname"
            className="input"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="たろう・はなちゃん など"
            autoComplete="off"
            enterKeyHint="done"
            aria-describedby="nickname-note"
          />
          <p
            id="nickname-note"
            className="muted small"
            style={{ marginTop: 8 }}
          >
            グループのみんなに見える名前です。本名でなくてかまいません。{len}/
            {NICKNAME_MAX} 文字
          </p>
          {len > NICKNAME_MAX && (
            <p className="error">呼び名は {NICKNAME_MAX} 文字までです</p>
          )}
        </div>

        <div className="card stack center">
          <div className="label" id="size-label" style={{ marginBottom: 0 }}>
            自分を入れて何人？
          </div>
          <div className="stepper" role="group" aria-labelledby="size-label">
            <button
              type="button"
              aria-label="1 人へらす"
              disabled={size <= MIN}
              onClick={() => setSize((n) => Math.max(MIN, n - 1))}
            >
              −
            </button>
            <span className="num" aria-live="polite">
              {size}
              <span style={{ fontSize: 20 }}>人</span>
            </span>
            <button
              type="button"
              aria-label="1 人ふやす"
              disabled={size >= MAX}
              onClick={() => setSize((n) => Math.min(MAX, n + 1))}
            >
              ＋
            </button>
          </div>
          <p className="small">
            この人数がそろうと始まります。{MIN}{" "}
            人以上集まれば、あなたが締め切って始めることもできます
          </p>
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="bottom-bar stack with-note">
          <p className="muted small center">
            つくると、<a href="/terms">利用規約</a>と
            <a href="/privacy">プライバシーポリシー</a>
            に同意したことになります。
          </p>
          <button type="submit" className="btn" disabled={!valid || busy}>
            {busy ? "つくっています…" : "グループをつくる"}
          </button>
        </div>
      </form>
    </main>
  );
}
