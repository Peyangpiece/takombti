"use client";
// 結果の画面の最後に出す、応援（寄付）のお願い（仕様書 §4.11）。
// 先に結果という価値を受け取ってもらい、そのお返しとしてお願いする（返報性）。ただし押しつけない：
// - 受け取ったもの（友達 N 人の答え・無料・広告なし・登録なし）と、お金の使い道を正直に書く
// - 応援しなくても、すべての機能はこれまでどおり使えると書く
// - 「今回は閉じる」で 30 日出さない。罪悪感をあおる言い方・急がせる言い方はしない
// 行き先は NEXT_PUBLIC_SUPPORT_URL（外部の応援サービス）。設定がなければ出さない
import { useState } from "react";
import { getType, type TypeCode } from "@/data/framework";
import { safeGet, safeSet, useClientValue } from "@/lib/client";
import { Octopus } from "./Octopus";

const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL ?? "";
const DISMISS_KEY = "takoshin:support-dismissed";
const HIDE_DAYS = 30;

export function supportUrl(url = SUPPORT_URL): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function SupportCard({ code, n }: { code: TypeCode; n: number }) {
  const url = supportUrl();
  // 「今回は閉じる」から 30 日のあいだは出さない（サーバーで描くときは出さない）
  const recentlyClosed = useClientValue(
    () =>
      Date.now() - (Number(safeGet<number>(DISMISS_KEY, 0)) || 0) <
      HIDE_DAYS * 24 * 60 * 60 * 1000,
    true,
  );
  const [closed, setClosed] = useState(false);
  if (!url || closed || recentlyClosed) return null;
  return (
    <section className="card stack support-card">
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Octopus code={code} size={64} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <b>結果、楽しんでもらえた？</b>
          <span className="muted small">{getType(code).name}のタコより</span>
        </div>
      </div>
      <p>
        友達 {n}{" "}
        人の答えをまとめたこの結果は、無料・広告なし・登録なしでお届けしています。たこ診は、ひとりの運営者がサーバー代を出して続けています。
      </p>
      <p>
        もし楽しんでもらえたら、少しだけ応援してもらえるとうれしいです。いただいた応援は、サーバー代と新しい機能づくりに使います。
      </p>
      <a className="btn" href={url} target="_blank" rel="noopener noreferrer">
        応援する
      </a>
      <p className="muted small">
        外部のサイトへ移ります。応援してもしなくても、たこ診はこれまでどおりすべて使えます。
      </p>
      <button
        type="button"
        className="btn ghost small"
        onClick={() => {
          safeSet(DISMISS_KEY, Date.now());
          setClosed(true);
        }}
      >
        今回は閉じる
      </button>
    </section>
  );
}
