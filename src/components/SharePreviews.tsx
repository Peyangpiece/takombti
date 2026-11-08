"use client";
// シェア画像（縦の 1 枚。仕様書 §4.12）。保存のボタンは置かず、画像を長押しして
// 「“写真”に追加」や「共有」を選んでもらう（端末に備わっているメニューを使う）。
// ふつうの画像（シェアの欄）と、スペシャルな画像（応援してくれた人だけ。§4.11）で使う
import { useEffect, useRef, useState } from "react";
import { useHostImage } from "@/lib/client";
import { track } from "@/lib/track";

interface Props {
  hostKey: string;
  special?: boolean;
  supporter?: boolean;
  withSelf?: boolean;
  label?: string;
}

export function SharePreviews({
  hostKey,
  special = false,
  supporter = false,
  withSelf = false,
  label = "シェア画像",
}: Props) {
  // 画像は、この欄が画面に近づいてから作る（下まで読まない人の分まで作らない）
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
  const src = useHostImage(hostKey, near ? `size=story${extra}` : null);
  const counted = useRef(false);

  return (
    <div className="stack">
      <div className="share-preview story" ref={boxRef}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={label}
            // 長押し・右クリックでメニューを開いたことだけを数える（保存・共有したかは分からない。§11.11）。
            // iPhone の Safari では、このきっかけが届かないので数えられない
            onContextMenu={() => {
              if (counted.current) return;
              counted.current = true;
              track("image", "story_menu");
            }}
          />
        ) : (
          <div className="share-preview-empty muted small">
            画像を作っています…（数秒かかります）
          </div>
        )}
      </div>
      <p className="muted small">
        画像を長押しすると、「“写真”に追加」や「共有」を選べます（パソコンは右クリックで保存）。
      </p>
    </div>
  );
}
