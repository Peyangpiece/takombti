"use client";
// シェア（仕様書 §4.12）
import { useEffect, useRef, useState } from "react";
import { getType, type TypeCode } from "@/data/framework";
import {
  copyText,
  hostApi,
  openXCompose,
  saveResultImage,
  shareOrigin,
  useHostImage,
  useIsMobile,
  withFrom,
  xShareUrl,
} from "@/lib/client";
import { LineShare } from "@/components/LineShare";

interface Props {
  hostKey: string;
  code: TypeCode;
  n: number;
  shareId: string | null;
  // 自分で答えていれば、画像に「自分で思うタイプ」を並べられる（null なら出さない）
  selfType?: TypeCode | null;
  // 応援のお願いで「応援する」を押した診断・特典を開いた診断は、スペシャル版の画像も作れる（§4.11）
  special?: boolean;
  // 特典を開いた（支払った）診断は、スペシャル版に「サポーター」のシールを入れられる（金額は入れない）
  supporter?: boolean;
  onShareChange: () => void;
}

export function ResultShare({
  hostKey,
  code,
  n,
  shareId,
  selfType = null,
  special = false,
  supporter = false,
  onShareChange,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [seal, setSeal] = useState(true);
  const [withSelf, setWithSelf] = useState(true);
  const showSelf = selfType !== null && withSelf;
  const [msg, setMsg] = useState<string | null>(null);
  const origin = typeof window === "undefined" ? "" : shareOrigin();
  const publicUrl = shareId ? `${origin}/r/${shareId}` : null;
  const text = `友達 ${n} 人から見たわたしは「${getType(code).name}」（${code}）でした #たこ診`;
  const shareUrl = publicUrl ?? origin;
  const mobile = useIsMobile();

  // 画像の見本は、シェアの欄が画面に近づいてから作る（下まで読まない人の分まで作らない）
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
  const selfQuery = showSelf ? "&self=1" : "";
  const storySrc = useHostImage(
    hostKey,
    near ? `size=story${selfQuery}` : null,
  );
  const wideSrc = useHostImage(hostKey, near ? `size=wide${selfQuery}` : null);

  async function saveImage(size: "story" | "wide", asSpecial = false) {
    setBusy(asSpecial ? `special-${size}` : size);
    setMsg(null);
    if (
      !(await saveResultImage(
        hostKey,
        code,
        size,
        asSpecial,
        asSpecial && supporter && seal,
        showSelf,
      ))
    )
      setMsg("画像を作れませんでした。もう一度試してください");
    setBusy(null);
  }

  async function toggleLink(on: boolean) {
    setBusy("link");
    await hostApi("/share", hostKey, { method: on ? "POST" : "DELETE" }).catch(
      () => null,
    );
    onShareChange();
    setBusy(null);
  }

  return (
    <div className="stack">
      {/* 画像の見本を見せ、その下のボタンで保存・共有する */}
      <div className="share-previews" ref={boxRef}>
        {(
          [
            ["story", "縦", storySrc],
            ["wide", "横", wideSrc],
          ] as const
        ).map(([size, label, src]) => (
          <div key={size} className={`share-preview ${size}`}>
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={`シェア画像（${label}）の見本`} />
            ) : (
              <div className="share-preview-empty muted small">作成中…</div>
            )}
            <button
              type="button"
              className={size === "story" ? "btn" : "btn secondary"}
              onClick={() => saveImage(size)}
              disabled={busy !== null}
            >
              {busy === size ? "作成中…" : `${label}で保存`}
            </button>
          </div>
        ))}
      </div>
      {special && (
        <div className="btn-row">
          <button
            type="button"
            className="btn tight"
            style={{ background: "#C9A23F" }}
            onClick={() => saveImage("story", true)}
            disabled={busy !== null}
          >
            {busy === "special-story" ? "作成中…" : "スペシャル（縦）"}
          </button>
          <button
            type="button"
            className="btn secondary tight"
            onClick={() => saveImage("wide", true)}
            disabled={busy !== null}
          >
            {busy === "special-wide" ? "作成中…" : "スペシャル（横）"}
          </button>
        </div>
      )}
      {special && supporter && (
        <label className="small" style={{ display: "flex", gap: 8 }}>
          <input
            type="checkbox"
            checked={seal}
            onChange={(e) => setSeal(e.target.checked)}
          />
          スペシャル版に「サポーター」のシールを入れる（金額は入りません）
        </label>
      )}
      {selfType !== null && (
        <label className="small" style={{ display: "flex", gap: 8 }}>
          <input
            type="checkbox"
            checked={withSelf}
            onChange={(e) => setWithSelf(e.target.checked)}
          />
          自分で思うタイプ（{selfType}）も画像に入れる
        </label>
      )}
      <p className="muted small">
        画像に入るのは、呼び名・タイプ・4 軸の割合・人数
        {showSelf ? "・自分で思うタイプ" : ""}
        だけ。分析の文や、問いごとの答えは入りません。
      </p>
      <div className="btn-row">
        <a
          className="btn x"
          href={xShareUrl(text, withFrom(shareUrl, "x"))}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            // スマホは X アプリの投稿画面を直接開く（文とリンクが入った状態。あとは投稿を押すだけ）
            if (!mobile) return;
            e.preventDefault();
            openXCompose(text, withFrom(shareUrl, "x"));
          }}
        >
          X に投稿
        </a>
        <LineShare
          text={text}
          url={withFrom(shareUrl, "line")}
          className="btn line"
        />
      </div>
      <div
        className="card stack"
        style={{ boxShadow: "inset 0 0 0 2px var(--line)" }}
      >
        <b>リンクで公開</b>
        {publicUrl ? (
          <>
            <div className="linkbox">{publicUrl}</div>
            <div className="btn-row">
              <button
                type="button"
                className="btn secondary"
                onClick={() =>
                  copyText(withFrom(publicUrl, "copy")).then((ok) =>
                    setMsg(ok ? "コピーした！" : null),
                  )
                }
              >
                コピー
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => toggleLink(false)}
                disabled={busy !== null}
              >
                公開をやめる
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted small">
              タイプのカードだけを見られるページを作ります。いつでも取り消せます。
            </p>
            <button
              type="button"
              className="btn secondary"
              onClick={() => toggleLink(true)}
              disabled={busy !== null}
            >
              公開リンクを作る
            </button>
          </>
        )}
      </div>
      {msg && (
        <p className="small" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
