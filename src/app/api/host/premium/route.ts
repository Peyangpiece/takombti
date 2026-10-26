import type { NextRequest } from "next/server";
import { getHost } from "@/lib/surveys";
import { hostKeyOf, json } from "@/lib/http";
import { relyingPartyOf } from "@/lib/passkeys";
import { createCheckout, premiumOffer } from "@/lib/stripe";

// 特典つきの応援：Stripe の支払いのページを作って、そのアドレスを返す（仕様書 §4.11）
export async function POST(req: NextRequest) {
  const key = hostKeyOf(req);
  const host = key ? await getHost(key) : null;
  if (!host) return json({ status: "not_found" }, 404);
  const offer = premiumOffer();
  if (!offer) return json({ status: "unavailable" }, 409);
  if (host.status !== "completed") return json({ status: "not_open" }, 409);
  if (host.premium) return json({ status: "already" }, 409);
  const origin = relyingPartyOf(req.headers.get("host"))?.origin;
  if (!origin) return json({ status: "invalid" }, 400);
  const url = await createCheckout(host.surveyId, origin, offer.price);
  return url ? json({ url }) : json({ status: "stripe_error" }, 502);
}
