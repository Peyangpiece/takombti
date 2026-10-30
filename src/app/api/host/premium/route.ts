import type { NextRequest } from "next/server";
import { getHost } from "@/lib/surveys";
import { hostKeyOf, json, readJson } from "@/lib/http";
import { relyingPartyOf } from "@/lib/passkeys";
import { premiumOffer, startCheckout, type CheckoutStart } from "@/lib/stripe";
import { premiumSellable } from "@/lib/premiumTerms";
import { getDb } from "@/lib/db";
import { recordSupport } from "@/lib/supportStats";

// 特典つきの応援：Stripe の支払いのページを作って、そのアドレスを返す（仕様書 §4.11）
export async function POST(req: NextRequest) {
  const key = hostKeyOf(req);
  const host = key ? await getHost(key) : null;
  if (!host) return json({ status: "not_found" }, 404);
  const offer = premiumOffer();
  if (!offer) return json({ status: "unavailable" }, 409);
  if (host.status !== "completed") return json({ status: "not_open" }, 409);
  if (host.premium) return json({ status: "already" }, 409);
  // 保存期限まで 7 日に満たない診断では売らない（支払ってすぐ見られなくなるため）
  if (!premiumSellable(host.daysLeft)) return json({ status: "too_late" }, 409);
  // 金額は、選べる金額のどれか（送られてこなければ、いちばん安い金額）
  const body = await readJson(req);
  const amount = body?.amount === undefined ? offer.price : body.amount;
  if (typeof amount !== "number" || !offer.tiers.includes(amount))
    return json({ status: "invalid" }, 400);
  const origin = relyingPartyOf(req.headers.get("host"))?.origin;
  if (!origin) return json({ status: "invalid" }, 400);
  let started: CheckoutStart;
  try {
    started = await startCheckout(host.surveyId, origin, amount);
  } catch {
    // データベースや Stripe が応えないとき
    return json({ status: "stripe_error" }, 502);
  }
  // 前に開いた支払いのページで、もう払われている（知らせが届くのを待つ）
  if (started && "processing" in started)
    return json({ status: "processing" }, 409);
  if (!started) return json({ status: "stripe_error" }, 502);
  await recordSupport(await getDb(), host.surveyId, "checkout").catch(
    () => null,
  );
  return json({ url: started.url });
}
