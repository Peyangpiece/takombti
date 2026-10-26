"use client";
// 結果の画面の最後に出す、応援のお願い（仕様書 §4.11）。返報性を 2 段で使う：
// 1. 結果という価値を受け取ってもらったあとで、まず特典なしで応援をお願いする（「応援する」「今回は閉じる」）
// 2. 「応援する」を押した人には、その場でお礼のスペシャルなシェア画像を贈り（無料）、
//    さらに支払ってくれたら、お礼に「くわしい分析」を開くと案内する（値段と内容は払う前に見せる）
// 押しつけないための決まり：受け取ったものと使い道を正直に書く・これまでの結果は応援しなくても見られると書く・
// 罪悪感をあおる言い方や急がせる言い方はしない・「今回は閉じる」で 30 日出さない。
// 2 段目は結果の画面の中に出すだけ（画面をふさがない）なので、そのまま下へ読み進められる。
// 支払いの行き先：特典つき（Stripe。offer があるとき）・特典なし（NEXT_PUBLIC_SUPPORT_URL）。どちらもなければ出さない
import { useState } from "react";
import { getType, type TypeCode } from "@/data/framework";
import {
  hostApi,
  safeGet,
  safeSet,
  saveResultImage,
  useClientValue,
} from "@/lib/client";
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
  gifted,
  onChange,
}: {
  code: TypeCode;
  n: number;
  hostKey: string;
  offer: PremiumOffer | null;
  premium: boolean;
  gifted: boolean;
  onChange: () => void;
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
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (premium || (!url && !offer) || closed) return null;
  // 「応援する」を押したあと（贈り物を受け取った診断）は、閉じた記録があっても 2 段目を出す
  if (!gifted && recentlyClosed) return null;

  const typeName = getType(code).name;

  async function support() {
    setBusy("gift");
    setError(null);
    const r = await hostApi("/gift", hostKey, { method: "POST" }).catch(
      () => null,
    );
    setBusy(null);
    if (!r?.ok)
      return setError("うまくいきませんでした。もう一度試してください");
    onChange();
  }

  async function checkout() {
    setBusy("checkout");
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
    setBusy(null);
    setError("支払いのページを開けませんでした。もう一度試してください");
  }

  async function image(size: "story" | "wide") {
    setBusy(size);
    setError(null);
    if (!(await saveResultImage(hostKey, code, size, true)))
      setError("画像を作れませんでした。もう一度試してください");
    setBusy(null);
  }

  const header = (title: string) => (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Octopus code={code} size={64} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <b>{title}</b>
        <span className="muted small">{typeName}のタコより</span>
      </div>
    </div>
  );

  if (!gifted) {
    return (
      <section className="card stack support-card">
        {header("結果、楽しんでもらえた？")}
        <p>
          友達 {n}{" "}
          人の答えをまとめたこの結果は、無料・広告なし・登録なしでお届けしています。たこ診は、ひとりの運営者がサーバー代を出して続けています。
        </p>
        <p>
          もし楽しんでもらえたら、少しだけ応援してもらえるとうれしいです。いただいた応援は、サーバー代と新しい機能づくりに使います。
        </p>
        <button
          type="button"
          className="btn"
          onClick={() => void support()}
          disabled={busy !== null}
        >
          応援する
        </button>
        {error && (
          <p className="error small" role="alert">
            {error}
          </p>
        )}
        <p className="muted small">
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

  return (
    <section className="card stack support-card">
      {header("応援しようとしてくれた、やさしいタコさんへ")}
      <p>
        ありがとう！お礼に、<b>スペシャルなシェア画像</b>
        をプレゼントするね。金の枠のついた特別なデザインだよ。
      </p>
      <div className="btn-row">
        <button
          type="button"
          className="btn"
          style={{ background: "#C9A23F" }}
          onClick={() => void image("story")}
          disabled={busy !== null}
        >
          {busy === "story" ? "作成中…" : "スペシャル（縦）"}
        </button>
        <button
          type="button"
          className="btn secondary"
          onClick={() => void image("wide")}
          disabled={busy !== null}
        >
          {busy === "wide" ? "作成中…" : "スペシャル（横）"}
        </button>
      </div>
      {offer && (
        <>
          <p>
            さらに、応援（{offer.price.toLocaleString("ja-JP")}{" "}
            円）が済んだら、お礼に<b>「くわしい分析」</b>
            も開くね。問いごとの答えの分かれ方や、意見がそろった問い・分かれた問いが見られるよ。
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => void checkout()}
            disabled={busy !== null}
          >
            {busy === "checkout"
              ? "支払いのページを開いています…"
              : `${offer.price.toLocaleString("ja-JP")} 円で応援する`}
          </button>
          <p className="muted small">
            支払いは Stripe
            のページで行います（カードの情報は、たこ診には届きません）。くわしくは
            <a href="/legal">特定商取引法に基づく表記</a>をご覧ください。
          </p>
        </>
      )}
      {url && (
        <a
          className={offer ? "btn secondary" : "btn"}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {offer
            ? "特典なしで応援する（好きな金額）"
            : "応援する（好きな金額）"}
        </a>
      )}
      {url && (
        <p className="muted small">
          {offer ? "「特典なしで応援する」" : "「応援する」"}
          は外部のサイトへ移ります。
        </p>
      )}
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
