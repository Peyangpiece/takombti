"use client";
// 人数をふやす（仕様書 §5.4）。同じ招待リンクのまま、前の回答を引き継いで受付を続ける。

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header, LoadError, Loading, MissingHost } from "@/components/Shell";
import { useHost } from "@/components/useHost";
import { hostApi, useDialogFocus } from "@/lib/client";

const MAX = 30;

export function MorePage() {
  const router = useRouter();
  const { state, reload } = useHost();
  const [picked, setPicked] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const dialogRef = useDialogFocus<HTMLDivElement>(confirm, () =>
    setConfirm(false),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (state.kind === "loading") return <Loading />;
  if (state.kind === "error") return <LoadError onRetry={reload} />;
  if (state.kind !== "ready") return <MissingHost />;
  const { view, hostKey } = state;
  const min = view.raiseMin;
  const done = view.status === "completed";

  if (min === null) {
    return (
      <main className="page stack">
        <Header />
        <h1 style={{ marginTop: 8 }}>人数はふやせません</h1>
        <p>
          {view.status === "expired"
            ? "この診断は受付の期限が切れています。"
            : done && view.premium
              ? "特典を開いた診断は、結果と特典を 180 日のこすため、人数をふやせません。"
              : done
                ? `結果が出たあとは 3 人以上ふやす決まりですが、上限の ${MAX} 人をこえてしまいます。`
                : `人数は ${MAX} 人までです。`}
        </p>
        <a href={`/h#${hostKey}`} className="btn">
          診断の画面へ
        </a>
      </main>
    );
  }

  const count = Math.max(min, picked ?? min);
  const step = (d: number) =>
    setPicked(Math.min(MAX, Math.max(min, count + d)));
  const more = count - view.responseCount;

  async function raise() {
    setBusy(true);
    setError(null);
    const r = await hostApi<{ status: string }>("/target", hostKey, {
      method: "POST",
      // 見ていた状態も送る（受付中のつもりでふやす間に結果が出ていたら、見ないまま結果を消さないため）
      body: JSON.stringify({ targetCount: count, from: view.status }),
    }).catch(() => null);
    setBusy(false);
    if (r?.ok) {
      router.push(`/h/share#${hostKey}`);
      return;
    }
    setConfirm(false);
    setError(
      r?.data.status === "paying"
        ? "特典つきの応援の支払いを確かめています。少し待ってから、もう一度試してください"
        : r
          ? "人数をふやせませんでした。状況が変わったかもしれないので、もう一度選んでください"
          : "通信できませんでした。電波のよいところでもう一度試してください",
    );
    await reload();
  }

  return (
    <main className="page stack">
      <Header />
      <h1 style={{ marginTop: 8 }}>人数をふやす</h1>
      <p>
        いまは <b>{view.targetCount} 人</b>
        {done
          ? "の結果が出ています。"
          : `中 ${view.responseCount} 人が回答ずみ。`}
        同じ招待リンクのまま、もっと多くの人に答えてもらえます。
      </p>

      <div className="card stack center">
        <div className="label" id="count-label" style={{ marginBottom: 0 }}>
          何人にする？
        </div>
        <div className="stepper" role="group" aria-labelledby="count-label">
          <button
            type="button"
            aria-label="1 人へらす"
            disabled={count <= min}
            onClick={() => step(-1)}
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
            onClick={() => step(1)}
          >
            ＋
          </button>
        </div>
        <p className="small">
          これまでの {view.responseCount} 人の回答はそのまま使い、あと{" "}
          <b>{more} 人</b>が答えたら結果が出ます。
        </p>
        {done && (
          <p className="muted small">
            結果が出たあとは 3
            人以上ふやします（少しだけふやすと、前の結果との差から、あとから答えた人の答えが分かってしまうため）。
          </p>
        )}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="bottom-bar stack">
        <button type="button" className="btn" onClick={() => setConfirm(true)}>
          {count} 人にふやす
        </button>
        <a href={`/h#${hostKey}`} className="btn ghost">
          もどる
        </a>
      </div>

      {confirm && (
        <div
          className="dialog-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="raise-title"
          ref={dialogRef}
        >
          <div className="dialog stack">
            <h2 id="raise-title">{count} 人にふやす？</h2>
            <p>
              同じ招待リンクで、あと <b>{more} 人</b>に答えてもらいます。
            </p>
            {done && (
              <p className="notice">
                いまの結果は見られなくなり、{count}{" "}
                人そろったときに出し直します。公開リンクを作っていたら、取り消します。
              </p>
            )}
            <p className="muted small">ふやしたあとで、人数はへらせません。</p>
            <button
              type="button"
              className="btn"
              onClick={raise}
              disabled={busy}
            >
              {busy ? "ふやしています…" : "ふやす"}
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
