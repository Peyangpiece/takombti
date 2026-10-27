"use client";
// スペシャルなシェア画像（支払いが済んだ人。仕様書 §4.11）。
// 「応援する」を押しただけの人は、応援の欄の 2 段目で見られる。支払いが済むと応援の欄は出ないので、ここに出す
import { useState } from "react";
import { SharePreviews } from "./SharePreviews";

export function SpecialShare({
  hostKey,
  code,
}: {
  hostKey: string;
  code: string;
}) {
  const [seal, setSeal] = useState(true);
  return (
    <section className="card stack">
      <h2 className="section-title">スペシャルなシェア画像</h2>
      <p className="small">
        応援してくれたお礼の、金の枠のついた特別な画像です。
      </p>
      <SharePreviews
        hostKey={hostKey}
        code={code}
        special
        supporter={seal}
        label="スペシャルなシェア画像"
      />
      <label className="small" style={{ display: "flex", gap: 8 }}>
        <input
          type="checkbox"
          checked={seal}
          onChange={(e) => setSeal(e.target.checked)}
        />
        「サポーター」のシールを入れる（金額は入りません）
      </label>
    </section>
  );
}
