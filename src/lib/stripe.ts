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
import { PAYMENT_TERMS } from "./premiumTerms";

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

// Stripe への問い合わせは 10 秒で打ち切る（応えないまま、診断の行の鍵を持ち続けないように）
export const STRIPE_TIMEOUT_MS = 10_000;

function stripeFetch(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<Response | null> {
  return fetchImpl(url, {
    ...init,
    signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS),
  }).catch(() => null);
}

// Stripe に断られたときの理由を記録に残す（Workers Logs）。鍵や利用者の情報は入れず、Stripe の返す種類・コード・項目名・文だけ
async function logStripeFailure(
  what: string,
  res: Response | null,
): Promise<void> {
  if (!res) {
    console.error(`stripe: ${what} failed: no response (timeout or network)`);
    return;
  }
  const body = (await res.json().catch(() => null)) as {
    error?: {
      type?: unknown;
      code?: unknown;
      param?: unknown;
      message?: unknown;
    };
  } | null;
  const e = body?.error;
  console.error(
    `stripe: ${what} failed: ${res.status} ${String(e?.type ?? "")} ${String(e?.code ?? "")} ${String(e?.param ?? "")} ${String(e?.message ?? "").slice(0, 300)}`,
  );
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
    // カードだけにする（コンビニ払いなどの、あとで払う方法は、支払いが済む前に開き直されて二重に払われやすいため）
    "payment_method_types[0]": "card",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "jpy",
    "line_items[0][price_data][unit_amount]": String(price),
    "line_items[0][price_data][product_data][name]":
      "たこ診 特典つきの応援（くわしい分析・タコ占いの合言葉）",
    // 支払いのボタンのそばに、大事な条件をもう一度出す（特定商取引法の最終確認の表示）
    "custom_text[submit][message]": `支払い：${PAYMENT_TERMS}。デジタルの特典のため、提供したあとの返金・取り消しはできません（特典が見られないときは返金します）。特典は結果が出てから 180 日まで見られ、診断を消すと見られなくなります。`,
    client_reference_id: surveyId,
    "metadata[survey_id]": surveyId,
    // 選んだ金額を覚えておく。知らせを受けたとき、いまの設定ではなく、この金額と払われた金額をくらべる
    // （あとで金額の設定を変えても、払われた支払いを見落とさないため）
    "metadata[amount_yen]": String(price),
    // 戻り先には管理用の鍵を入れない。戻ったあと、端末に覚えた行き先へ移る
    success_url: `${origin}/h/thanks`,
    cancel_url: `${origin}/h/thanks?canceled=1`,
  });
  const res = await stripeFetch(
    fetchImpl,
    "https://api.stripe.com/v1/checkout/sessions",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${secretKey}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  if (!res?.ok) {
    await logStripeFailure("create checkout", res);
    return null;
  }
  const data = (await res.json().catch(() => null)) as {
    url?: unknown;
    id?: unknown;
  } | null;
  return typeof data?.url === "string" &&
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
// closed：閉じた（もう閉じていた・Stripe にない）／paid：もう払われている（知らせが届く前のことがある）／
// unknown：確かめられなかった（Stripe が応えないなど）
export async function closeCheckout(
  id: string,
  secretKey = process.env.STRIPE_SECRET_KEY ?? "",
  fetchImpl: typeof fetch = fetch,
): Promise<"closed" | "paid" | "unknown"> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return "closed";
  const base = `https://api.stripe.com/v1/checkout/sessions/${id}`;
  const headers = { authorization: `Bearer ${secretKey}` };
  const expired = await stripeFetch(fetchImpl, `${base}/expire`, {
    method: "POST",
    headers,
  });
  if (expired?.ok) return "closed";
  // 閉じられなかった：もう払われたか、もう閉じていたか。ページの状態を確かめる
  const got = await stripeFetch(fetchImpl, base, { method: "GET", headers });
  // 鍵を替えたなどで、Stripe にそのページがない
  if (got?.status === 404) return "closed";
  if (!got?.ok) {
    await logStripeFailure("retrieve checkout", got);
    return "unknown";
  }
  const s = (await got.json().catch(() => null)) as {
    status?: unknown;
    payment_status?: unknown;
  } | null;
  if (s?.status === "complete" || s?.payment_status === "paid") return "paid";
  if (s?.status === "expired") return "closed";
  console.error(
    `stripe: previous checkout still open after expire: ${String(s?.status)} ${String(s?.payment_status)}`,
  );
  return "unknown";
}

// 支払いのページを開いた結果。processing：前のページで払われていて、知らせを待っている
export type CheckoutStart = { url: string } | { processing: true } | null;

// 支払いのページを開く。同じ診断で前に作ったページがあれば先に閉じ、新しいページの ID を覚える
export async function startCheckout(
  surveyId: string,
  origin: string,
  price: number,
  fetchImpl: typeof fetch = fetch,
): Promise<CheckoutStart> {
  const db = await getDb();
  // 2 つのタブでほぼ同時に押されても、前のページを閉じてから作る順に並ぶよう、診断の行を押さえて進める。
  // Stripe への問い合わせは 1 つ 10 秒で打ち切るので、鍵を長く持ち続けることはない
  return db.transaction(async (tx): Promise<CheckoutStart> => {
    const { rows } = await tx.query<{ checkout_session_id: string | null }>(
      `select checkout_session_id from surveys where id = $1 for update`,
      [surveyId],
    );
    const prev = rows[0]?.checkout_session_id;
    if (prev) {
      const closed = await closeCheckout(prev, undefined, fetchImpl);
      // 前のページで払われていたら、新しいページは作らない（二重に払われないように）
      if (closed === "paid") return { processing: true };
      // 前のページを閉じられたか分からないうちは、新しいページを作らない
      if (closed === "unknown") return null;
    }
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
    return { url: s.url };
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
  currency?: unknown;
  // 返金（charge）・支払いの取り消し（dispute）の知らせで使う
  refunded?: unknown;
  payment_status?: unknown;
  amount_total?: unknown;
  client_reference_id?: unknown;
  metadata?: { survey_id?: unknown; amount_yen?: unknown };
}

// 本番の鍵（sk_live_。権限をしぼった鍵 rk_live_ も）か
export function isLiveKey(secretKey: string): boolean {
  return /^(sk|rk)_live_/.test(secretKey);
}

// 払われた金額が、たこ診が作った支払いのページの金額と合うか。
// 支払いのページを作るときに入れた metadata.amount_yen（たこ診のサーバーが入れたもの）とくらべ、いまの設定にはよらない。
// amount_yen のない、前に作ったページは、いまの選べる金額のどれかであることを確かめる
export function amountMatches(
  s: CheckoutSession,
  offer: PremiumOffer | null,
): boolean {
  const amount = s.amount_total;
  if (s.currency !== "jpy" || typeof amount !== "number" || !validYen(amount))
    return false;
  const chosen = s.metadata?.amount_yen;
  if (chosen !== undefined && chosen !== null)
    return typeof chosen === "string" && chosen === String(amount);
  return Boolean(offer?.tiers.includes(amount));
}

// 支払いが済んだ知らせを受けて、その診断の特典を開く。同じ知らせが何度来ても 1 回だけ数える。
// 署名の正しい知らせで払われていれば、金額が合わなくても支払いは payments に残す（お金の記録をなくさないため）。
// そのときは特典を開かず、運営者が確かめて返金する。返金した支払いの知らせが送り直されても、特典は開かない。
// 全額の返金（charge.refunded）と、カード会社による支払いの取り消し（charge.dispute.created）の知らせでは、
// その支払いに返金の印を付け、ほかに有効な支払いがなければ特典を閉じる
export async function handleStripeEvent(
  event: {
    type?: unknown;
    livemode?: unknown;
    data?: { object?: CheckoutSession };
  },
  offer: PremiumOffer | null = premiumOffer(),
  secretKey = process.env.STRIPE_SECRET_KEY ?? "",
): Promise<"opened" | "revoked" | "ignored"> {
  // 本番の鍵のときはテストの知らせを、テストの鍵のときは本番の知らせを信じない
  if (
    typeof event.livemode === "boolean" &&
    event.livemode !== isLiveKey(secretKey)
  )
    return "ignored";
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
  // 診断の ID は、たこ診が支払いのページを作るときに入れた metadata だけを信じる。
  // client_reference_id は Payment Link などで訪問者が URL に付けられるため使わない
  const surveyId = s?.metadata?.survey_id;
  if (
    !s ||
    s.payment_status !== "paid" ||
    typeof s.id !== "string" ||
    typeof surveyId !== "string"
  )
    return "ignored";
  const sessionId = s.id;
  const amount = Number.isInteger(s.amount_total) ? Number(s.amount_total) : 0;
  const intent = typeof s.payment_intent === "string" ? s.payment_intent : null;
  const matches = amountMatches(s, offer);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const exists = await tx.query(`select 1 from surveys where id = $1`, [
      surveyId,
    ]);
    const saved = await tx.query<{ refunded_at: Date | string | null }>(
      `insert into payments (session_id, survey_id, amount, payment_intent) values ($1, $2, $3, $4)
       on conflict (session_id) do update set payment_intent = coalesce(payments.payment_intent, excluded.payment_intent)
       returning refunded_at`,
      [sessionId, exists.rows.length > 0 ? surveyId : null, amount, intent],
    );
    if (exists.rows.length === 0) return "ignored" as const;
    if (!matches) {
      // 金額か通貨が合わない：特典は開かず、運営者が確かめられるよう決済の ID だけを記録に出す
      console.error(`stripe: amount mismatch, not opened: ${sessionId}`);
      return "ignored" as const;
    }
    // 返金・取り消しの済んだ支払いの知らせが送り直されたときは、特典を開き直さない
    const refunded =
      saved.rows[0]?.refunded_at != null ||
      (intent !== null &&
        (
          await tx.query(
            `select 1 from payments where payment_intent = $1 and refunded_at is not null`,
            [intent],
          )
        ).rows.length > 0);
    if (refunded) return "ignored" as const;
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
