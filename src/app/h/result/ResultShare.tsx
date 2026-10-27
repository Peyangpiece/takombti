"use client";
// シェア（仕様書 §4.12）
import { useState } from "react";
import { getType, type TypeCode } from "@/data/framework";
import {
  copyText,
  hostApi,
  openXCompose,
  shareOrigin,
  useIsMobile,
  withFrom,
  xShareUrl,
} from "@/lib/client";
import { LineShare } from "@/components/LineShare";
import { SharePreviews } from "@/components/SharePreviews";

interface Props {
  hostKey: string;
  code: TypeCode;
  n: number;
  shareId: string | null;
  // 自分で答えていれば、画像に「自分で思うタイプ」を並べられる（null なら出さない）
  selfType?: TypeCode | null;
  onShareChange: () => void;
}

export function ResultShare({
  hostKey,
  code,
  n,
  shareId,
  selfType = null,
  onShareChange,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [withSelf, setWithSelf] = useState(true);
  const showSelf = selfType !== null && withSelf;
  const [msg, setMsg] = useState<string | null>(null);
  const origin = typeof window === "undefined" ? "" : shareOrigin();
  const publicUrl = shareId ? `${origin}/r/${shareId}` : null;
  const text = `友達 ${n} 人から見たわたしは「${getType(code).name}」（${code}）でした #たこ診`;
  const shareUrl = publicUrl ?? origin;
  const mobile = useIsMobile();

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
      {/* 画像の見本を見せ、その下のボタンで保存・共有する。スペシャルな画像は、応援した人の欄にだけ出す */}
      <SharePreviews hostKey={hostKey} code={code} withSelf={showSelf} />
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
