import type { NextRequest } from "next/server";
import { hostKeyOf, json, readJson } from "@/lib/http";
import { addSubscription, removeSubscription } from "@/lib/push";

const HTTP = {
  ok: 200,
  not_found: 404,
  not_open: 409,
  invalid: 400,
  full: 409,
} as const;

// 「全員そろった」の通知を、この端末で受け取る（仕様書 §4.6・§11.10）
export async function POST(req: NextRequest) {
  const key = hostKeyOf(req);
  if (!key) return json({ status: "not_found" }, 404);
  const body = await readJson(req);
  const status = await addSubscription(key, body?.subscription);
  return json({ status }, HTTP[status]);
}

// 通知をやめる
export async function DELETE(req: NextRequest) {
  const key = hostKeyOf(req);
  if (!key) return json({ status: "not_found" }, 404);
  const body = await readJson(req);
  const status = await removeSubscription(key, body?.endpoint);
  return json({ status }, HTTP[status]);
}
