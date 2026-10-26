"use client";
// シェア（仕様書 §4.12）
import { useState } from "react";
import { getType, type TypeCode } from "@/data/framework";
import {
  copyText,
  hostApi,
  saveResultImage,
  withFrom,
  xShareUrl,
} from "@/lib/client";
import { LineShare } from "@/components/LineShare";

interface Props {
  hostKey: string;
  code: TypeCode;
  n: number;
  shareId: string | null;
  // 応援のお願いで「応援する」を押した診断・特典を開いた診断は、スペシャル版の画像も作れる（§4.11）
  special?: boolean;
  onShareChange: () => void;
}

export function ResultShare({
  hostKey,
  code,
  n,
  shareId,
  special = false,
  onShareChange,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const publicUrl = shareId ? `${origin}/r/${shareId}` : null;
  const text = `友達 ${n} 人から見たわたしは「${getType(code).name}」（${code}）でした #たこ診`;
  const shareUrl = publicUrl ?? origin;

  async function saveImage(size: "story" | "wide", asSpecial = false) {
    setBusy(asSpecial ? `special-${size}` : size);
    setMsg(null);
    if (!(await saveResultImage(hostKey, code, size, asSpecial)))
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
      <div className="btn-row">
        <button
          type="button"
          className="btn"
          onClick={() => saveImage("story")}
          disabled={busy !== null}
        >
          {busy === "story" ? "作成中…" : "画像（縦）"}
        </button>
        <button
          type="button"
          className="btn secondary"
          onClick={() => saveImage("wide")}
          disabled={busy !== null}
        >
          {busy === "wide" ? "作成中…" : "画像（横）"}
        </button>
      </div>
      {special && (
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            style={{ background: "#C9A23F" }}
            onClick={() => saveImage("story", true)}
            disabled={busy !== null}
          >
            {busy === "special-story" ? "作成中…" : "スペシャル（縦）"}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => saveImage("wide", true)}
            disabled={busy !== null}
          >
            {busy === "special-wide" ? "作成中…" : "スペシャル（横）"}
          </button>
        </div>
      )}
      <p className="muted small">
        画像に入るのは、呼び名・タイプ・4
        軸の割合・人数だけ。分析の文や自己回答は入りません。
      </p>
      <div className="btn-row">
        <a
          className="btn secondary"
          href={xShareUrl(text, withFrom(shareUrl, "x"))}
          target="_blank"
          rel="noopener noreferrer"
        >
          X に投稿
        </a>
        <LineShare
          text={text}
          url={withFrom(shareUrl, "line")}
          className="btn secondary"
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
