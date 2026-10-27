"use client";
// 管理用リンクから診断を開く（仕様書 §4.2・§11.10）。
// ホーム画面に追加したアプリ（iPhone）は Safari と保存場所が分かれているので、ここに貼り付けて開いてもらう。
// 「全員そろった」の通知を押したとき（/?open=<surveyId>）は、端末に覚えてある鍵でその診断を開く
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  hostApi,
  saveSurvey,
  savedSurveys,
  useClientValue,
} from "@/lib/client";

// 貼り付けられた文から管理用の鍵を取り出す（/h…#<鍵> の形のリンク、または鍵だけ）
export function hostKeyFromText(text: string): string | null {
  const t = text.trim();
  const m = /\/h(?:\/[a-z]*)?#([A-Za-z0-9_-]{16,64})(?:\s|$)/.exec(t);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{16,64}$/.test(t) ? t : null;
}

// top：ホーム画面のアプリで、まだ診断を覚えていないときだけ上のほうに出す。bottom：それ以外のとき、ページの下に出す
export function OpenHostLink({ place }: { place: "top" | "bottom" }) {
  const standaloneEmpty = useClientValue(
    () =>
      (window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone ===
          true) &&
      savedSurveys().length === 0,
    false,
  );
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (place !== "bottom") return;
    const id = new URLSearchParams(window.location.search).get("open");
    if (!id) return;
    const s = savedSurveys().find((x) => x.surveyId === id);
    if (s) window.location.replace(`/h#${s.hostKey}`);
  }, [place]);

  if ((place === "top") !== standaloneEmpty) return null;

  async function open() {
    const key = hostKeyFromText(text);
    if (!key) return setError("管理用リンクの形ではないようです");
    setBusy(true);
    setError(null);
    const r = await hostApi<{ surveyId: string; nickname: string }>(
      "",
      key,
    ).catch(() => null);
    setBusy(false);
    if (!r?.ok)
      return setError(
        r?.status === 404
          ? "診断が見つかりませんでした。消されたか、期限で消えています"
          : "開けませんでした。もう一度試してください",
      );
    saveSurvey({
      hostKey: key,
      surveyId: r.data.surveyId,
      nickname: r.data.nickname,
      createdAt: new Date().toISOString(),
    });
    router.push(`/h#${key}`);
  }

  return (
    <details className="card" open={place === "top" || undefined}>
      <summary>管理用リンクから開く</summary>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void open();
        }}
      >
        <p className="small muted">
          別の端末やホーム画面のアプリで、つくった診断を開くときに使います。保存しておいた管理用リンクを貼り付けてください。
        </p>
        <input
          className="input"
          type="url"
          inputMode="url"
          autoComplete="off"
          aria-label="管理用リンク"
          placeholder="https://…/h#…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn secondary" disabled={busy}>
          開く
        </button>
        {error && (
          <p className="error small" role="alert">
            {error}
          </p>
        )}
      </form>
    </details>
  );
}
