"use client";
// シェア画像の見本（縦と横を並べ、それぞれの下に保存のボタン。仕様書 §4.12）。
// ふつうの画像（シェアの欄）と、スペシャルな画像（応援してくれた人だけ。§4.11）で使う
import { useEffect, useRef, useState } from "react";
import {
  canShareImage,
  saveMessage,
  saveResultImage,
  useClientValue,
  useHostImage,
  type SaveOutcome,
} from "@/lib/client";

interface Props {
  hostKey: string;
  code: string;
  special?: boolean;
  supporter?: boolean;
  withSelf?: boolean;
  label?: string;
}

export function SharePreviews({
  hostKey,
  code,
  special = false,
  supporter = false,
  withSelf = false,
  label = "シェア画像",
}: Props) {
  const [busy, setBusy] = useState<"story" | "wide" | null>(null);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  // スマホの多くは、保存のボタンで端末の共有の画面が開く（そこで「画像を保存」を選ぶ）。
  // 実際の動きに合わせてボタンの名前を変え、共有の画面を使わないダウンロードも別に置く
  const share = useClientValue(canShareImage, false);

  // 見本は、この欄が画面に近づいてから作る（下まで読まない人の分まで作らない）
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === "undefined")
      return setNear(true);
    const io = new IntersectionObserver(
      (es) => es.some((e) => e.isIntersecting) && setNear(true),
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const extra = `${special ? "&special=1" : ""}${special && supporter ? "&supporter=1" : ""}${withSelf ? "&self=1" : ""}`;
  const storySrc = useHostImage(hostKey, near ? `size=story${extra}` : null);
  const wideSrc = useHostImage(hostKey, near ? `size=wide${extra}` : null);

  async function save(size: "story" | "wide", mode: "auto" | "download") {
    setBusy(size);
    setOutcome(null);
    setOutcome(
      await saveResultImage(
        hostKey,
        code,
        size,
        special,
        special && supporter,
        withSelf,
        mode,
      ),
    );
    setBusy(null);
  }

  return (
    <div className="stack">
      <div className="share-previews" ref={boxRef}>
        {(
          [
            ["story", "縦", storySrc],
            ["wide", "横", wideSrc],
          ] as const
        ).map(([size, name, src]) => (
          <div key={size} className={`share-preview ${size}`}>
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={`${label}（${name}）の見本`} />
            ) : (
              <div className="share-preview-empty muted small">作成中…</div>
            )}
            <button
              type="button"
              className={size === "story" ? "btn" : "btn secondary"}
              style={
                special && size === "story"
                  ? { background: "#C9A23F" }
                  : undefined
              }
              onClick={() => save(size, "auto")}
              disabled={busy !== null}
            >
              {busy === size
                ? "作成中…"
                : share
                  ? `${name}を保存・共有`
                  : `${name}をダウンロード`}
            </button>
            {share && (
              <button
                type="button"
                className="btn ghost small"
                onClick={() => save(size, "download")}
                disabled={busy !== null}
              >
                ダウンロード
              </button>
            )}
          </div>
        ))}
      </div>
      {share && !outcome && (
        <p className="muted small">
          「保存・共有」を押すと共有の画面が開きます。「画像を保存」を選ぶと写真に入ります。
        </p>
      )}
      {outcome &&
        (outcome === "failed" ? (
          <p className="error small" role="alert">
            {saveMessage(outcome)}
          </p>
        ) : (
          <p className="muted small" role="status">
            {saveMessage(outcome)}
          </p>
        ))}
    </div>
  );
}
