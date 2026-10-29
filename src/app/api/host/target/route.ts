import type { NextRequest } from "next/server";
import { raiseTarget } from "@/lib/surveys";
import { hostKeyOf, json, readJson } from "@/lib/http";

// 人数をふやす（仕様書 §5.4）
const HTTP = {
  ok: 200,
  not_found: 404,
  not_open: 409,
  invalid: 400,
  already: 409,
} as const;

export async function POST(req: NextRequest) {
  const key = hostKeyOf(req);
  if (!key) return json({ status: "not_found" }, 404);
  const body = await readJson(req);
  const from =
    body?.from === "open" || body?.from === "completed" ? body.from : undefined;
  const status = await raiseTarget(key, body?.targetCount, new Date(), from);
  return json({ status }, HTTP[status]);
}
