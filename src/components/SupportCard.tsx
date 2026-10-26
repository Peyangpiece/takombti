"use client";
// 結果の画面の最後に出す、応援のお願い（仕様書 §4.11）。
// 先に結果という価値を受け取ってもらい、そのお返しとしてお願いする（返報性）。ただし押しつけない：
// - 受け取ったもの（友達 N 人の答え・無料・広告なし・登録なし）と、お金の使い道を正直に書く
// - これまでの結果は、応援しなくてもすべて見られると書く
// - 「今回は閉じる」で 30 日出さない。罪悪感をあおる言い方・急がせる言い方はしない
// 出し方は 2 つ：
// - 特典つきの応援（offer があるとき）：Stripe で払うと、この診断の「くわしい分析」と「スペシャルなシェア画像」が開く
// - 特典なしの応援：NEXT_PUBLIC_SUPPORT_URL（外部の応援サービス）へのリンク
// どちらもなければ出さない。特典を開いた診断には出さない
import { useState } from "react";
import { getType, type TypeCode } from "@/data/framework";
import { hostApi, safeGet, safeSet, useClientValue } from "@/lib/client";
import type { PremiumOffer } from "@/lib/stripe";
import { Octopus } from "./Octopus";

const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL ?? "";
const DISMISS_KEY = "takoshin:support-dismissed";
// Stripe から戻ったときに、どの結果の画面へ戻るか（管理用の鍵を Stripe に渡さないため、端末に覚えておく）
export const RETURN_KEY = "takoshin:premium-return";
const HIDE_DAYS = 30;

export function supportUrl(url = SUPPORT_URL): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function SupportCard({
  code,
  n,
  hostKey,
  offer,
  premium,
}: {
  code: TypeCode;
  n: number;
  hostKey: string;
  offer: PremiumOffer | null;
  premium: boolean;
}) {
  const url = supportUrl();
  // 「今回は閉じる」から 30 日のあいだは出さない（サーバーで描くときは出さない）
  const recentlyClosed = useClientValue(
    () =>
      Date.now() - (Number(safeGet<number>(DISMISS_KEY, 0)) || 0) <
      HIDE_DAYS * 24 * 60 * 60 * 1000,
    true,
  );
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (premium || (!url && !offer) || closed || recentlyClosed) return null;

  async function checkout() {
    setBusy(true);
    setError(null);
    const r = await hostApi<{ url?: string }>("/premium", hostKey, {
      method: "POST",
    }).catch(() => null);
    if (r?.ok && r.data.url) {
      try {
        window.sessionStorage.setItem(RETURN_KEY, window.location.href);
      } catch {
        // 覚えられなくても、支払いのあとで結果の画面を開き直せば特典は開いている
      }
      window.location.href = r.data.url;
      return;
    }
    setBusy(false);
    setError("支払いのページを開けませんでした。もう一度試してください");
  }

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
      {offer && (
        <>
          <p>
            応援してくれた方には、お礼に<b>「くわしい分析」</b>
            （問いごとの答えの分かれ方・意見がそろった問いと分かれた問い）と
            <b>「スペシャルなシェア画像」</b>を、この診断にお届けします。
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => void checkout()}
            disabled={busy}
          >
            {busy
              ? "支払いのページを開いています…"
              : `応援して特典を受け取る（${offer.price.toLocaleString("ja-JP")} 円）`}
          </button>
          <p className="muted small">
            支払いは Stripe
            のページで行います（カードの情報は、たこ診には届きません）。くわしくは
            <a href="/legal">特定商取引法に基づく表記</a>をご覧ください。
          </p>
          {error && (
            <p className="error small" role="alert">
              {error}
            </p>
          )}
        </>
      )}
      {url && (
        <a
          className={offer ? "btn secondary" : "btn"}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {offer ? "特典なしで応援する" : "応援する"}
        </a>
      )}
      <p className="muted small">
        {url ? "「応援する」は外部のサイトへ移ります。" : ""}
        これまでの結果は、応援しなくてもすべて見られます。
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
