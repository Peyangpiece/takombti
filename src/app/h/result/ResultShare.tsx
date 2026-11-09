"use client";
// シェア（仕様書 §4.12）
import { useState } from "react";
import { getType, type TypeCode } from "@/data/framework";
import {
  copyText,
  hostApi,
  lineShareUrl,
  openXCompose,
  shareOrigin,
  useIsMobile,
  withFrom,
  xShareUrl,
} from "@/lib/client";
import { LineShare } from "@/components/LineShare";
import { SharePreviews } from "@/components/SharePreviews";
import { track } from "@/lib/track";

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
  const mobile = useIsMobile();
  // 公開リンクがないまま X・LINE を押したときに、どちらのリンクを付けるかを聞いている送り先（§4.12）
  const [pending, setPending] = useState<"x" | "line" | null>(null);

  // 公開リンクがないときに X・LINE で送る。win は、パソコンで X を開くために押した時点で開いておいた窓
  function send(kind: "x" | "line", url: string, win: Window | null = null) {
    setPending(null);
    track("result_share", kind);
    const u = withFrom(url, kind);
    if (kind === "x") {
      if (mobile) return openXCompose(text, u);
      const href = xShareUrl(text, u);
      if (win) win.location.href = href;
      else window.open(href, "_blank", "noopener");
      return;
    }
    if (mobile) {
      window.location.href = lineShareUrl(text, u, true);
      return;
    }
    copyText(`${text} ${u}`).then((ok) =>
      setMsg(
        ok
          ? "コピーしました。PC 版 LINE のトークに貼り付けて送ってください。"
          : "コピーできませんでした。",
      ),
    );
  }

  async function sendWithLink(kind: "x" | "line") {
    // パソコンの X は、押した時点で窓を開いておく（待ったあとに開くと、ブラウザに止められるため）
    const win = kind === "x" && !mobile ? window.open("", "_blank") : null;
    setBusy("link");
    const r = await hostApi<{ shareId?: string }>("/share", hostKey, {
      method: "POST",
    }).catch(() => null);
    setBusy(null);
    const id = r?.ok ? r.data.shareId : undefined;
    if (!id) {
      win?.close();
      setMsg(
        "公開リンクを作れませんでした。時間をおいて、もう一度お試しください。",
      );
      return;
    }
    onShareChange();
    send(kind, `${origin}/r/${id}`, win);
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
      {/* 画像の見本を見せ、その下のボタンで保存・共有する。スペシャルな画像は、応援した人の欄にだけ出す */}
      <SharePreviews hostKey={hostKey} withSelf={showSelf} />
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
      {publicUrl ? (
        <div className="btn-row narrow-stack">
          <a
            className="btn x"
            href={xShareUrl(text, withFrom(publicUrl, "x"))}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              track("result_share", "x");
              // スマホは X アプリの投稿画面を直接開く（文とリンクが入った状態。あとは投稿を押すだけ）
              if (!mobile) return;
              e.preventDefault();
              openXCompose(text, withFrom(publicUrl, "x"));
            }}
          >
            X に投稿
          </a>
          <LineShare
            text={text}
            url={withFrom(publicUrl, "line")}
            className="btn line"
            onUse={() => track("result_share", "line")}
          />
        </div>
      ) : (
        <>
          {/* 公開リンクがないまま送ると、結果ではなくトップのリンクが付く。押したときに、どちらを付けるか聞く（§4.12） */}
          <div className="btn-row narrow-stack">
            <button
              type="button"
              className="btn x"
              onClick={() => setPending("x")}
              disabled={busy !== null}
            >
              X に投稿
            </button>
            <button
              type="button"
              className="btn line"
              onClick={() => setPending("line")}
              disabled={busy !== null}
            >
              LINE で送る
            </button>
          </div>
          {pending && (
            <div className="card stack" role="dialog" aria-label="付けるリンク">
              <p>
                結果のカードを見られるページ（公開リンク）を付けて送りますか？
              </p>
              <p className="muted small">
                見られるのは、呼び名・タイプ・4
                軸の割合・人数だけです。公開はいつでもやめられます。
              </p>
              <button
                type="button"
                className="btn"
                onClick={() => sendWithLink(pending)}
                disabled={busy !== null}
              >
                公開リンクで送る
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={() => send(pending, origin)}
              >
                トップのリンクで送る
              </button>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setPending(null)}
              >
                やめる
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
