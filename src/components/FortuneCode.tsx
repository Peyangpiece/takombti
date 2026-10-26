"use client";
// 結果の画面に出す、タコ占いの合言葉（特典つきの応援のお礼。仕様書 §4.11）。この診断のホストだけが見られる
import { useState } from "react";
import { copyText } from "@/lib/client";

export function FortuneCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <section
      className="card stack"
      style={{ boxShadow: "inset 0 0 0 3px #e9c46a" }}
    >
      <h2 className="section-title">タコ占いの合言葉</h2>
      <p className="small">
        スペシャルなシェア画像の裏にかくれた「あなたのタコ占い」を、この合言葉で見られます。今日の運勢やラッキードリンクは毎日かわります。
      </p>
      <div className="linkbox" style={{ fontWeight: 900, letterSpacing: 2 }}>
        {code}
      </div>
      <div className="btn-row">
        <a className="btn" href={`/uranai#${encodeURIComponent(code)}`}>
          占いを見る
        </a>
        <button
          type="button"
          className="btn secondary"
          onClick={async () => {
            setCopied(await copyText(code));
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "コピーした！" : "コピー"}
        </button>
      </div>
      <p className="muted small">
        合言葉は、応援してくれたあなただけのものです。人に教えないでね。
      </p>
    </section>
  );
}
