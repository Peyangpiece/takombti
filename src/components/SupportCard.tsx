"use client";
// 結果の画面の最後に出す、応援のお願い（仕様書 §4.11）。返報性を 2 段で使う：
// 1. 結果という価値を受け取ってもらったあとで、まず特典なしで応援をお願いする（「応援する」「今回は閉じる」）
// 2. 「応援する」を押した人には、その場でお礼のスペシャルなシェア画像を贈り（無料）、
//    さらに支払ってくれたら、お礼に「くわしい分析」を開くと案内する（値段と内容は払う前に見せる）
// 押しつけないための決まり：受け取ったものと使い道を正直に書く・これまでの結果は応援しなくても見られると書く・
// 罪悪感をあおる言い方や急がせる言い方はしない・「今回は閉じる」で 30 日出さない。
// 2 段目は結果の画面の中に出すだけ（画面をふさがない）なので、そのまま下へ読み進められる。
// 支払いの行き先：特典つき（Stripe。offer があるとき）・特典なし（NEXT_PUBLIC_SUPPORT_URL）。どちらもなければ出さない
import { useEffect, useRef, useState } from "react";
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
import { FortuneBody } from "./FortuneBody";
import type { Fortune } from "@/lib/fortune";

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

// 2 枚目（カードの裏のタコ占い）の見本。支払いの前は、本当の占いの文を送らない（ぼかしは外せるため）。
// 形だけ同じ、仮の文をぼかしとモザイクの下に置く
function teaserFortune(code: TypeCode): Fortune {
  const d = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const blank = (n: number) => "〇".repeat(n);
  return {
    type: code,
    typeName: getType(code).name,
    date: d,
    core: `${blank(14)}。${blank(12)}。`,
    aru: blank(18),
    advice: `${blank(16)}。${blank(8)}`,
    today: { overall: 4, love: 3, friends: 5, study: 3 },
    message: blank(15),
    drink: blank(7),
    color: blank(5),
  };
}

// 2 枚目：カードの裏のタコ占い。ぼかしとモザイクをかけ、応援で続きが見られると案内する。
// ボタンは金額を選ぶところへ移るだけ（選んでいない金額で支払いのページを開かない）
function FortuneTeaser({
  code,
  price,
  onContinue,
}: {
  code: TypeCode;
  price: number;
  onContinue: () => void;
}) {
  return (
    <div className="fortune-teaser card">
      <div className="fortune-teaser-body stack" aria-hidden="true">
        <FortuneBody fortune={teaserFortune(code)} />
      </div>
      <div className="fortune-teaser-mosaic" aria-hidden="true" />
      <div className="fortune-teaser-lock stack center">
        <span style={{ fontSize: 32, display: "block" }} aria-hidden="true">
          🔒
        </span>
        <b>カードの裏には「あなたのタコ占い」があります。</b>
        <p className="small">
          {getType(code).name}
          のあなたに刺さる占いと、毎日かわる今日の運勢・ラッキードリンク。
          {price.toLocaleString("ja-JP")} 円からの応援で、続きが見られます。
        </p>
        <button type="button" className="btn" onClick={onContinue}>
          応援して続きを見る
        </button>
      </div>
    </div>
  );
}

// 金額の呼び名（安い順）
function tierName(i: number, count: number): string {
  if (count === 1) return "応援";
  if (i === 0) return "ちょっと応援";
  if (i === count - 1) return "たっぷり応援";
  return "しっかり応援";
}

// 金額を選ぶ。真ん中をはじめから選んだ状態にし、少しだけ大きく見せる（「おすすめ」などの言葉は使わない）。
// どの金額でも特典は同じと、すぐ下に書く（高い金額のほうが特典がよいと誤解させない）
function AmountPicker({
  offer,
  value,
  onChange,
  pickerRef,
}: {
  offer: PremiumOffer;
  value: number;
  onChange: (n: number) => void;
  pickerRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={pickerRef}
      className="amount-picker"
      role="radiogroup"
      aria-label="応援する金額"
      tabIndex={-1}
    >
      {offer.tiers.map((n, i) => {
        const middle = offer.tiers.length > 2 && n === offer.initial;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            className={`amount-option${middle ? " middle" : ""}${value === n ? " selected" : ""}`}
            onClick={() => onChange(n)}
          >
            <span className="amount-yen">
              {n.toLocaleString("ja-JP")}
              <small> 円</small>
            </span>
            <span className="amount-name">
              {tierName(i, offer.tiers.length)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// これまでに応援してくれた人数（支払いの記録の本当の数。20 人に届くまでは出さない）。
// 小さなタコを 3 匹並べ、「応援するのは普通のこと」とさりげなく伝える
function Supporters({ n }: { n: number }) {
  return (
    <div className="supporters small">
      <span className="supporters-faces" aria-hidden="true">
        {(["ENFJ", "ISFJ", "ESFP"] as const).map((c) => (
          <Octopus key={c} code={c} size={28} />
        ))}
      </span>
      <span>
        これまでに <b>{n.toLocaleString("ja-JP")}</b>{" "}
        人のタコさんが応援してくれました
      </span>
    </div>
  );
}

// 1 枚目：贈ったスペシャルなシェア画像の見本
function SpecialPreview({ hostKey }: { hostKey: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    fetch("/api/host/image?size=story&special=1", {
      headers: { "x-host-key": hostKey },
    })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (!b || !alive) return;
        url = URL.createObjectURL(b);
        setSrc(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [hostKey]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="スペシャルなシェア画像" className="card-pair-image" />
  ) : (
    <div className="card-pair-image card center muted small">作成中…</div>
  );
}

export function SupportCard({
  code,
  n,
  hostKey,
  offer,
  supporters = null,
  premium,
  gifted,
  onChange,
}: {
  code: TypeCode;
  n: number;
  hostKey: string;
  offer: PremiumOffer | null;
  supporters?: number | null;
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
  // 選んだ金額。はじめは真ん中
  const [picked, setPicked] = useState<number | null>(null);
  const amount = picked ?? offer?.initial ?? 0;
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const hidden =
    premium || (!url && !offer) || closed || (!gifted && recentlyClosed);
  // 応援のお願いを見たことを記録する（/admin の集計用。同じ診断は 1 回だけ数える）
  useEffect(() => {
    if (hidden) return;
    void hostApi("/support", hostKey, {
      method: "POST",
      body: JSON.stringify({ event: "seen" }),
    }).catch(() => null);
  }, [hidden, hostKey]);
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
      body: JSON.stringify({ amount }),
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
          この結果は、応援しなくてもすべて見られます。
        </p>
        <button
          type="button"
          className="btn ghost small"
          onClick={() => {
            safeSet(DISMISS_KEY, Date.now());
            setClosed(true);
            void hostApi("/support", hostKey, {
              method: "POST",
              body: JSON.stringify({ event: "closed" }),
            }).catch(() => null);
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
      {offer && (
        <div className="card-pair" aria-label="カードの表と裏">
          <figure className="card-pair-item">
            <figcaption className="muted small">
              1 枚目：表（スペシャルなシェア画像）
            </figcaption>
            <SpecialPreview hostKey={hostKey} />
          </figure>
          <figure className="card-pair-item">
            <figcaption className="muted small">
              2 枚目：裏（あなたのタコ占い）
            </figcaption>
            <FortuneTeaser
              code={code}
              price={offer.price}
              onContinue={() => {
                pickerRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
                pickerRef.current?.focus({ preventScroll: true });
              }}
            />
          </figure>
        </div>
      )}
      <div className="btn-row">
        <button
          type="button"
          className="btn tight"
          style={{ background: "#C9A23F" }}
          onClick={() => void image("story")}
          disabled={busy !== null}
        >
          {busy === "story" ? "作成中…" : "スペシャル（縦）"}
        </button>
        <button
          type="button"
          className="btn secondary tight"
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
            円から）が済んだら、お礼にこの 2 つもお届けするね。
          </p>
          <ul className="small" style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              <b>くわしい分析</b>
              ：あなたのタイプを、強み・人間関係・学び方などの章に分けて深く読み解いた読み物と、友達の答えのくわしいデータが見られるよ
            </li>
            <li>
              <b>タコ占いの合言葉</b>
              ：カードの裏の「あなたのタコ占い」が見られるよ。今日の運勢やラッキードリンクは毎日かわるよ
            </li>
          </ul>
          {supporters !== null && <Supporters n={supporters} />}
          <AmountPicker
            offer={offer}
            value={amount}
            onChange={setPicked}
            pickerRef={pickerRef}
          />
          <p className="muted small center" style={{ marginTop: 8 }}>
            特典はどの金額でも同じです。
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => void checkout()}
            disabled={busy !== null}
          >
            {busy === "checkout"
              ? "支払いのページを開いています…"
              : `${amount.toLocaleString("ja-JP")} 円で応援する`}
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
