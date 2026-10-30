"use client";
// 結果の画面の最後に出す、応援のお願い（仕様書 §4.11）。2 段に分ける：
// 1. 結果を見たあとで、応援をお願いする（「応援する」「今回は閉じる」）
// 2. 「応援する」を押した人には、その場でお礼のスペシャルなシェア画像を贈り（無料）、
//    有料の「特典つきの応援」（くわしい分析・タコ占い）を、値段・内容・見られる期間・返金できないこととあわせて案内する
// お礼を先に渡すのは、受け取ったものにお返しをしたくなる気持ち（返報性）を、相手をだまさない形で生かすため。
// そのぶん、売っていることと条件ははっきり書く
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
  saveMessage,
  saveResultImage,
  type SaveOutcome,
  canShareImage,
  useClientValue,
  useHostImage,
} from "@/lib/client";
import type { PremiumOffer } from "@/lib/stripe";
import {
  MIN_PREMIUM_DAYS,
  PAYMENT_TERMS,
  jstMonthDay,
  premiumSellable,
} from "@/lib/premiumTerms";
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
  onContinue,
}: {
  code: TypeCode;
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
        <b>裏は「あなたのタコ占い」</b>
        <p className="small">
          {getType(code).name}
          のあなたへの占いと、毎日かわる今日の運勢。応援で続きが見られます。
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

// 金額を選ぶ。はじめは真ん中の金額を選んでおく（運営者が決めた初期値）。選んでいる金額を少し大きく見せる（特定の金額を大きくするのではない）。「おすすめ」などの言葉は使わない。
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
        // WAI-ARIA のラジオのまとまり：Tab で入るのは選んでいる 1 つだけ（選んでいなければ先頭）。
        // 中では ←→↑↓ で隣を選び（端から反対の端へ回る）、Home・End で先頭・最後を選ぶ
        const selected = offer.tiers.includes(value) ? value === n : i === 0;
        const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
          const last = offer.tiers.length - 1;
          const next =
            e.key === "ArrowRight" || e.key === "ArrowDown"
              ? i === last
                ? 0
                : i + 1
              : e.key === "ArrowLeft" || e.key === "ArrowUp"
                ? i === 0
                  ? last
                  : i - 1
                : e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? last
                    : null;
          if (next === null) return;
          e.preventDefault();
          onChange(offer.tiers[next]);
          pickerRef.current
            ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
            [next]?.focus();
        };
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            tabIndex={selected ? 0 : -1}
            className={`amount-option${value === n ? " selected" : ""}`}
            onClick={() => onChange(n)}
            onKeyDown={onKeyDown}
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

// これまでに応援してくれた人数（支払いの記録の本当の数。20 人に届くまでは出さない）
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
  const src = useHostImage(hostKey, "size=story&special=1");
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
  daysLeft = null,
  deleteAt = null,
  onChange,
}: {
  code: TypeCode;
  n: number;
  hostKey: string;
  offer: PremiumOffer | null;
  supporters?: number | null;
  premium: boolean;
  gifted: boolean;
  // 保存期限までの残り日数（切り上げ）と、その日時（HostView の値）。特典を見られる期間として出す
  daysLeft?: number | null;
  deleteAt?: string | null;
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
  const [saved, setSaved] = useState<SaveOutcome | null>(null);
  // 保存のボタンの名前は、シェアの欄と同じく実際の動きに合わせる（共有の画面が開く端末か、ダウンロードか）
  const share = useClientValue(canShareImage, false);
  // 選んだ金額。はじめは真ん中
  const [picked, setPicked] = useState<number | null>(null);
  const amount = picked ?? offer?.initial ?? 0;
  // 18 歳以上か、保護者の同意を得ているか（未成年の支払いの取り消しを防ぐため、支払いの前に確かめる）
  const [adult, setAdult] = useState(false);
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
  // 特典を見られる期間（保存期限まで）。残りが少ない診断では売らない
  const sellable = premiumSellable(daysLeft);
  const until = deleteAt ? jstMonthDay(deleteAt) : null;
  const remain =
    daysLeft !== null && until
      ? `あと ${daysLeft} 日（${until}まで）見られます`
      : null;

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
    const r = await hostApi<{ url?: string; status?: string }>(
      "/premium",
      hostKey,
      {
        method: "POST",
        body: JSON.stringify({ amount }),
      },
    ).catch(() => null);
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
    // 前に開いた支払いのページで払われていて、知らせを待っている（新しいページは作らない）
    if (r?.data.status === "processing")
      return setError(
        "支払いを確かめています。少し待ってから開き直してください",
      );
    if (r?.data.status === "too_late") {
      onChange();
      return setError(
        "保存期限が近いため、この診断では特典つきの応援を受け付けていません",
      );
    }
    setError("支払いのページを開けませんでした。もう一度試してください");
  }

  async function image(size: "story" | "wide") {
    setBusy(size);
    setError(null);
    setSaved(null);
    const o = await saveResultImage(hostKey, code, size, true);
    if (o === "failed") setError(saveMessage(o));
    else setSaved(o);
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
        ありがとう！お礼に、金の枠の<b>スペシャルなシェア画像</b>
        をプレゼントするね。
      </p>
      {offer && (
        <div className="card-pair" aria-label="カードの表と裏">
          <figure className="card-pair-item">
            <figcaption className="muted small">
              表：スペシャルなシェア画像
            </figcaption>
            <SpecialPreview hostKey={hostKey} />
          </figure>
          <figure className="card-pair-item">
            <figcaption className="muted small">
              裏：あなたのタコ占い
            </figcaption>
            <FortuneTeaser
              code={code}
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
          style={{ background: "#C9A23F", color: "#3B2626" }}
          onClick={() => void image("story")}
          disabled={busy !== null}
        >
          {busy === "story"
            ? "作成中…"
            : share
              ? "縦を保存・共有"
              : "縦をダウンロード"}
        </button>
        <button
          type="button"
          className="btn secondary tight"
          onClick={() => void image("wide")}
          disabled={busy !== null}
        >
          {busy === "wide"
            ? "作成中…"
            : share
              ? "横を保存・共有"
              : "横をダウンロード"}
        </button>
      </div>
      {saved && (
        <p className="muted small" role="status">
          {saveMessage(saved)}
        </p>
      )}
      {offer && !sellable && (
        <p className="muted small">
          この診断は保存期限{until ? `（${until}）` : ""}まで
          {daysLeft !== null ? `あと ${daysLeft} 日` : "の残りが少ない"}
          のため、特典つきの応援は受け付けていません（特典を見られる期間が{" "}
          {MIN_PREMIUM_DAYS} 日に満たないため）。
        </p>
      )}
      {offer && sellable && (
        <>
          <p>
            さらに<b>特典つきの応援（有料）</b>
            をしてくれたら、お礼にこの 2 つも届けるね。
          </p>
          <ul className="small" style={{ margin: 0, paddingLeft: 20 }}>
            <li>
              <b>くわしい分析</b>：{typeName}
              タイプに共通の読み物（強み・人間関係・学び方など）と、あなたの友達の答えから組み立てた読み解き・くわしいデータ
            </li>
            <li>
              <b>タコ占いの合言葉</b>：カードの裏の占い（運勢は毎日かわる）
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
          {/* 申し込みの前に、大事な条件をまとめて見せる（特定商取引法の最終確認の表示） */}
          <dl className="purchase-terms small">
            <dt>代金</dt>
            <dd>{amount.toLocaleString("ja-JP")} 円（税込）・1 回だけ</dd>
            <dt>支払いの時期と方法</dt>
            <dd>{PAYMENT_TERMS}</dd>
            <dt>見られる時期</dt>
            <dd>支払いが済みしだい、この結果の画面で</dd>
            <dt>見られる期間</dt>
            <dd>
              {remain ? `${remain}。` : ""}結果が出てから 180
              日まで（この診断を消すと、特典も見られなくなります）
            </dd>
            <dt>返金</dt>
            <dd>
              内容の性質上、提供したあとの返金・取り消しはできません（特典が見られないときは返金します）
            </dd>
          </dl>
          <label className="check small">
            <input
              type="checkbox"
              checked={adult}
              onChange={(e) => setAdult(e.target.checked)}
            />
            18 歳以上です（18 歳未満の方は、保護者の同意を得ています）
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => void checkout()}
            disabled={busy !== null || !adult}
          >
            {busy === "checkout"
              ? "支払いのページを開いています…"
              : `${amount.toLocaleString("ja-JP")} 円で特典つきの応援をする`}
          </button>
          <p className="muted small">
            支払いは Stripe
            のページで行います（カードの情報はたこ診に届きません）。
            <a href="/legal">特定商取引法に基づく表記</a>・
            <a href="/terms">利用規約</a>
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
