import type { NextRequest } from "next/server";
import { json } from "@/lib/http";
import { handleStripeEvent, verifyStripeSignature } from "@/lib/stripe";

// Stripe からの知らせ（支払いが済んだなど）。署名を確かめてから特典を開く（仕様書 §4.11）
export async function POST(req: NextRequest) {
  const payload = await req.text();
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
