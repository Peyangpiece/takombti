"use client";
// シェア画像の見本（縦と横を並べ、それぞれの下に保存のボタン。仕様書 §4.12）。
// ふつうの画像（シェアの欄）と、スペシャルな画像（応援してくれた人だけ。§4.11）で使う
import { useEffect, useRef, useState } from "react";
import { saveResultImage, useHostImage } from "@/lib/client";

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
  const [error, setError] = useState<string | null>(null);

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

  async function save(size: "story" | "wide") {
    setBusy(size);
    setError(null);
    if (
      !(await saveResultImage(
        hostKey,
        code,
        size,
        special,
        special && supporter,
        withSelf,
      ))
    )
      setError("画像を作れませんでした。もう一度試してください");
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
              onClick={() => save(size)}
              disabled={busy !== null}
            >
              {busy === size ? "作成中…" : `${name}で保存`}
            </button>
          </div>
        ))}
      </div>
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
