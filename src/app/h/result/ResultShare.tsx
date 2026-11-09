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
import { SharePreviews } from "@/components/SharePreviews";
import { track } from "@/lib/track";

type Kind = "x" | "line" | "copy";

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
  // 公開リンクがないまま「X に投稿」「LINE で送る」「リンクをコピー」を押したときに、
  // どちらのリンクを付けるかを聞いている送り先（§4.12）
  const [pending, setPending] = useState<Kind | null>(null);

  // 送る。win は、パソコンで X を開くために押した時点で開いておいた窓
  function send(kind: Kind, url: string, win: Window | null = null) {
    setPending(null);
    track("result_share", kind);
    const u = withFrom(url, kind);
    if (kind === "copy") {
      copyText(u).then((ok) =>
        setMsg(ok ? "リンクをコピーしました。" : "コピーできませんでした。"),
      );
      return;
    }
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
    // パソコン版 LINE は文つきで開く方法がないので、文とリンクをコピーして貼ってもらう
    copyText(`${text} ${u}`).then((ok) =>
      setMsg(
        ok
          ? "コピーしました。PC 版 LINE のトークに貼り付けて送ってください。"
          : "コピーできませんでした。",
      ),
    );
  }

  function press(kind: Kind) {
    setMsg(null);
    if (publicUrl) send(kind, publicUrl);
    else setPending(kind);
  }

  async function sendWithLink(kind: Kind) {
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

  async function stopPublic() {
    setBusy("link");
    await hostApi("/share", hostKey, { method: "DELETE" }).catch(() => null);
    onShareChange();
    setBusy(null);
    setMsg("公開をやめました。リンクを開いても、カードは見られなくなります。");
  }

  return (
    <div className="stack">
      {/* 画像の見本を見せ、長押しで保存・共有する。スペシャルな画像は、応援した人の欄にだけ出す */}
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
      {/* 送るボタン。公開リンクがあればそれを付け、なければ押したときにどちらを付けるか聞く（§4.12） */}
      <div className="btn-row narrow-stack">
        <button
          type="button"
          className="btn x"
          onClick={() => press("x")}
          disabled={busy !== null}
        >
          X に投稿
        </button>
        <button
          type="button"
          className="btn line"
          onClick={() => press("line")}
          disabled={busy !== null}
        >
          LINE で送る
        </button>
      </div>
      <button
        type="button"
        className="btn secondary"
        onClick={() => press("copy")}
        disabled={busy !== null}
      >
        リンクをコピー
      </button>
      {pending && (
        <div className="card stack" role="dialog" aria-label="付けるリンク">
          <p>結果のカードを見られるページ（公開リンク）を付けますか？</p>
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
            {pending === "copy" ? "公開リンクをコピー" : "公開リンクで送る"}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => send(pending, origin)}
          >
            {pending === "copy"
              ? "トップのリンクをコピー"
              : "トップのリンクで送る"}
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
      {msg && (
        <p className="small" role="status">
          {msg}
        </p>
      )}
      {/* 公開中のときだけ、リンクと取り消しの入口を小さく出す */}
      {publicUrl && (
        <p className="muted small" style={{ overflowWrap: "anywhere" }}>
          公開中：{publicUrl}
          <br />
          <button
            type="button"
            className="link-btn"
            style={{ textDecoration: "underline", font: "inherit" }}
            onClick={stopPublic}
            disabled={busy !== null}
          >
            公開をやめる
          </button>
        </p>
      )}
    </div>
  );
}
