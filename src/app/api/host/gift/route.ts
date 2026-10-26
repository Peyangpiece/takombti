import type { NextRequest } from "next/server";
import { giveGift } from "@/lib/surveys";
import { hostKeyOf, json } from "@/lib/http";

const HTTP = {
  ok: 200,
  not_found: 404,
  not_open: 409,
  invalid: 400,
  already: 409,
} as const;

// 応援のお願いで「応援する」を押した：先にスペシャルなシェア画像を贈る（仕様書 §4.11）
export async function POST(req: NextRequest) {
  const key = hostKeyOf(req);
  if (!key) return json({ status: "not_found" }, 404);
  const status = await giveGift(key);
  return json({ status }, HTTP[status]);
}
