import type { NextRequest } from "next/server";
import { json, readTextLimited } from "@/lib/http";
import { handleStripeEvent, verifyStripeSignature } from "@/lib/stripe";

// Stripe からの知らせ（支払いが済んだなど）。署名を確かめてから特典を開く（仕様書 §4.11）
// Stripe の知らせは数 KB。上限をこえる本文は、署名を確かめる前に断る（§8.4）
const WEBHOOK_MAX_BYTES = 64 * 1024;

export async function POST(req: NextRequest) {
  const payload = await readTextLimited(req, WEBHOOK_MAX_BYTES);
  if (payload === null) return json({ error: "too_large" }, 413);
  if (
    !verifyStripeSignature(
      payload,
      req.headers.get("stripe-signature"),
      process.env.STRIPE_WEBHOOK_SECRET,
    )
  )
    return json({ error: "bad_signature" }, 400);
  let event: Parameters<typeof handleStripeEvent>[0];
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const result = await handleStripeEvent(event);
  return json({ ok: true, result });
}
