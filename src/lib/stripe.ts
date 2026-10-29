// 特典つきの応援の支払い（Stripe）。仕様書 §4.11。
// - 支払いのページ（Checkout）は Stripe が出す。カードの番号などは、たこ診を通らない
// - Stripe に渡すのは、どの診断の特典かを示す診断の ID だけ（管理用の鍵は渡さない）
// - 支払いが済んだことは、Stripe からの知らせ（Webhook）の署名を確かめてから信じる
// 使うには STRIPE_SECRET_KEY・STRIPE_WEBHOOK_SECRET・SUPPORT_PRICE_YEN と、販売者の表示（src/data/seller.ts）がいる
// - 金額は 3 つから選べる（SUPPORT_PRICE_YEN がいちばん安い金額）。特典はどの金額でも同じ

import { createHmac, timingSafeEqual } from "node:crypto";
import { recordSupport } from "./supportStats";
import { getDb } from "./db";
import { SELLER, sellerReady } from "../data/seller";
import { newFortuneCode } from "./fortune";

export interface PremiumOffer {
  price: number; // いちばん安い金額
  tiers: number[]; // 選べる金額（安い順）
  initial: number; // はじめに選んでおく金額（真ん中）
}

// 選べる金額。SUPPORT_TIERS_YEN（「300,500,1000」の形）があればそれ、なければ
// いちばん安い金額と、それより高い 500 円・1,000 円（3 つまで）
const DEFAULT_STEPS = [500, 1000];
const validYen = (n: number) => Number.isInteger(n) && n >= 50 && n <= 10000;

export function supportTiers(price: number, raw: string | undefined): number[] {
  const given = (raw ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => validYen(n) && n >= price);
  const list =
    given.length > 0 ? given : DEFAULT_STEPS.filter((n) => n > price);
  return [...new Set([price, ...list])].sort((a, b) => a - b).slice(0, 3);
}

// 特典つきの応援を出せるか。出せるなら、選べる金額を返す
export function premiumOffer(
  env: Record<string, string | undefined> = process.env,
  seller = SELLER,
): PremiumOffer | null {
  const price = Number(env.SUPPORT_PRICE_YEN);
  if (
    !env.STRIPE_SECRET_KEY ||
    !env.STRIPE_WEBHOOK_SECRET ||
    !validYen(price) ||
    !sellerReady(seller)
  )
    return null;
  const tiers = supportTiers(price, env.SUPPORT_TIERS_YEN);
  return { price, tiers, initial: tiers[Math.floor(tiers.length / 2)] };
}

// Stripe の支払いのページを作り、そのアドレスと ID を返す
export async function createCheckoutSession(
  surveyId: string,
  origin: string,
  price: number,
  secretKey = process.env.STRIPE_SECRET_KEY ?? "",
  fetchImpl: typeof fetch = fetch,
): Promise<{ url: string; id: string } | null> {
  const body = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "jpy",
    "line_items[0][price_data][unit_amount]": String(price),
    "line_items[0][price_data][product_data][name]":
      "たこ診 特典つきの応援（くわしい分析・タコ占いの合言葉）",
    // 支払いのボタンのそばに、大事な条件をもう一度出す（特定商取引法の最終確認の表示）
    "custom_text[submit][message]":
      "デジタルの特典のため、提供したあとの返金・取り消しはできません（特典が見られないときは返金します）。特典は結果が出てから 180 日まで見られ、診断を消すと見られなくなります。",
    client_reference_id: surveyId,
    "metadata[survey_id]": surveyId,
    // 戻り先には管理用の鍵を入れない。戻ったあと、端末に覚えた行き先へ移る
    success_url: `${origin}/h/thanks`,
    cancel_url: `${origin}/h/thanks?canceled=1`,
  });
  const res = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { url?: unknown; id?: unknown };
  return typeof data.url === "string" &&
    data.url.startsWith("https://") &&
    typeof data.id === "string"
    ? { url: data.url, id: data.id }
    : null;
}

export async function createCheckout(
  surveyId: string,
  origin: string,
  price: number,
  secretKey = process.env.STRIPE_SECRET_KEY ?? "",
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  return (
    (await createCheckoutSession(surveyId, origin, price, secretKey, fetchImpl))
      ?.url ?? null
  );
}

// 前に作った支払いのページを閉じる（2 つのタブで開いた支払いのページの両方で払われないように）。
// もう払われた・閉じたページは Stripe が断るので、失敗しても気にしない
export async function expireCheckout(
  id: string,
  secretKey = process.env.STRIPE_SECRET_KEY ?? "",
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return;
  await fetchImpl(`https://api.stripe.com/v1/checkout/sessions/${id}/expire`, {
    method: "POST",
    headers: { authorization: `Bearer ${secretKey}` },
  }).catch(() => null);
}

// 支払いのページを開く。同じ診断で前に作ったページがあれば先に閉じ、新しいページの ID を覚える
export async function startCheckout(
  surveyId: string,
  origin: string,
  price: number,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const db = await getDb();
  // 2 つのタブでほぼ同時に押されても、前のページを閉じてから作る順に並ぶよう、診断の行を押さえて進める
  return db.transaction(async (tx) => {
    const { rows } = await tx.query<{ checkout_session_id: string | null }>(
      `select checkout_session_id from surveys where id = $1 for update`,
      [surveyId],
    );
    const prev = rows[0]?.checkout_session_id;
    if (prev) await expireCheckout(prev, undefined, fetchImpl);
    const s = await createCheckoutSession(
      surveyId,
      origin,
      price,
      undefined,
      fetchImpl,
    );
    if (!s) return null;
    await tx.query(
      `update surveys set checkout_session_id = $2 where id = $1`,
      [surveyId, s.id],
    );
    return s.url;
  });
}

// Stripe-Signature 見出し（t=時刻,v1=署名）を確かめる。5 分より古い知らせは受け付けない
export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string | undefined,
  now = Date.now(),
): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.split("="));
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(t) || sigs.length === 0) return false;
  if (Math.abs(now / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret)
    .update(`${t}.${payload}`)
    .digest();
  return sigs.some((s) => {
    const got = Buffer.from(s ?? "", "hex");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

interface CheckoutSession {
  id?: unknown;
  payment_intent?: unknown;
  // 返金（charge）・支払いの取り消し（dispute）の知らせで使う
  refunded?: unknown;
  payment_status?: unknown;
  amount_total?: unknown;
  client_reference_id?: unknown;
  metadata?: { survey_id?: unknown };
}

// 支払いが済んだ知らせを受けて、その診断の特典を開く。同じ知らせが何度来ても 1 回だけ数える。
// 全額の返金（charge.refunded）と、カード会社による支払いの取り消し（charge.dispute.created）の知らせでは、
// その支払いに返金の印を付け、ほかに有効な支払いがなければ特典を閉じる
export async function handleStripeEvent(event: {
  type?: unknown;
  data?: { object?: CheckoutSession };
}): Promise<"opened" | "revoked" | "ignored"> {
  if (
    event.type === "charge.refunded" ||
    event.type === "charge.dispute.created"
  )
    return revokeByIntent(event.type, event.data?.object);
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  )
    return "ignored";
  const s = event.data?.object;
  const surveyId = s?.metadata?.survey_id ?? s?.client_reference_id;
  if (
    !s ||
    s.payment_status !== "paid" ||
    typeof s.id !== "string" ||
    typeof surveyId !== "string"
  )
    return "ignored";
  const db = await getDb();
  const amount = Number.isInteger(s.amount_total) ? Number(s.amount_total) : 0;
  return db.transaction(async (tx) => {
    const exists = await tx.query(`select 1 from surveys where id = $1`, [
      surveyId,
    ]);
    await tx.query(
      `insert into payments (session_id, survey_id, amount, payment_intent) values ($1, $2, $3, $4)
       on conflict (session_id) do update set payment_intent = coalesce(payments.payment_intent, excluded.payment_intent)`,
      [
        s.id,
        exists.rows.length > 0 ? surveyId : null,
        amount,
        typeof s.payment_intent === "string" ? s.payment_intent : null,
      ],
    );
    if (exists.rows.length === 0) return "ignored" as const;
    // 特典を開き、タコ占いの合言葉を作る（もうあれば、そのまま）
    await tx.query(
      `update surveys set premium_at = coalesce(premium_at, now()),
              fortune_code = coalesce(fortune_code, $2)
        where id = $1`,
      [surveyId, newFortuneCode()],
    );
    await recordSupport(tx, surveyId, "paid");
    return "opened" as const;
  });
}

async function revokeByIntent(
  type: string,
  obj: CheckoutSession | undefined,
): Promise<"revoked" | "ignored"> {
  const intent = obj?.payment_intent;
  if (typeof intent !== "string") return "ignored";
  // 一部だけの返金では特典を閉じない
  if (type === "charge.refunded" && obj?.refunded !== true) return "ignored";
  const db = await getDb();
  return db.transaction(async (tx) => {
    const { rows } = await tx.query<{ survey_id: string | null }>(
      `update payments set refunded_at = coalesce(refunded_at, now())
        where payment_intent = $1 returning survey_id`,
      [intent],
    );
    const surveyId = rows[0]?.survey_id;
    if (!surveyId) return "ignored" as const;
    await tx.query(
      `update surveys set premium_at = null, fortune_code = null
        where id = $1 and not exists (
          select 1 from payments where survey_id = $1 and refunded_at is null)`,
      [surveyId],
    );
    return "revoked" as const;
  });
}
