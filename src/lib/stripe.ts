// 特典つきの応援の支払い（Stripe）。仕様書 §4.11。
// - 支払いのページ（Checkout）は Stripe が出す。カードの番号などは、たこ診を通らない
// - Stripe に渡すのは、どの診断の特典かを示す診断の ID だけ（管理用の鍵は渡さない）
// - 支払いが済んだことは、Stripe からの知らせ（Webhook）の署名を確かめてから信じる
// 使うには STRIPE_SECRET_KEY・STRIPE_WEBHOOK_SECRET・SUPPORT_PRICE_YEN と、販売者の表示（src/data/seller.ts）がいる

import { createHmac, timingSafeEqual } from "node:crypto";
import { getDb } from "./db";
import { SELLER, sellerReady } from "../data/seller";
import { newFortuneCode } from "./fortune";

export interface PremiumOffer {
  price: number;
}

// 特典つきの応援を出せるか。出せるなら値段を返す
export function premiumOffer(
  env: Record<string, string | undefined> = process.env,
  seller = SELLER,
): PremiumOffer | null {
  const price = Number(env.SUPPORT_PRICE_YEN);
  if (
    !env.STRIPE_SECRET_KEY ||
    !env.STRIPE_WEBHOOK_SECRET ||
    !Number.isInteger(price) ||
    price < 50 ||
    price > 10000 ||
    !sellerReady(seller)
  )
    return null;
  return { price };
}

// Stripe の支払いのページを作り、そのアドレスを返す
export async function createCheckout(
  surveyId: string,
  origin: string,
  price: number,
  secretKey = process.env.STRIPE_SECRET_KEY ?? "",
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const body = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "jpy",
    "line_items[0][price_data][unit_amount]": String(price),
    "line_items[0][price_data][product_data][name]":
      "たこ診 特典つきの応援（くわしい分析・裏の占いの合言葉）",
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
  const data = (await res.json()) as { url?: unknown };
  return typeof data.url === "string" && data.url.startsWith("https://")
    ? data.url
    : null;
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
  payment_status?: unknown;
  amount_total?: unknown;
  client_reference_id?: unknown;
  metadata?: { survey_id?: unknown };
}

// 支払いが済んだ知らせを受けて、その診断の特典を開く。同じ知らせが何度来ても 1 回だけ数える
export async function handleStripeEvent(event: {
  type?: unknown;
  data?: { object?: CheckoutSession };
}): Promise<"opened" | "ignored"> {
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
      `insert into payments (session_id, survey_id, amount) values ($1, $2, $3)
       on conflict (session_id) do nothing`,
      [s.id, exists.rows.length > 0 ? surveyId : null, amount],
    );
    if (exists.rows.length === 0) return "ignored" as const;
    // 特典を開き、裏の占いの合言葉を作る（もうあれば、そのまま）
    await tx.query(
      `update surveys set premium_at = coalesce(premium_at, now()),
              fortune_code = coalesce(fortune_code, $2)
        where id = $1`,
      [surveyId, newFortuneCode()],
    );
    return "opened" as const;
  });
}
