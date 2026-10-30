import type { NextRequest } from "next/server";
import { raiseTarget, type RaiseStatus } from "@/lib/surveys";
import { hostKeyOf, json, readJson } from "@/lib/http";

// 人数をふやす（仕様書 §5.4）。特典を開いた診断は、結果が出たあとはふやせない（premium）
const HTTP: Record<RaiseStatus, number> = {
  ok: 200,
  not_found: 404,
  not_open: 409,
  invalid: 400,
  already: 409,
  premium: 409,
  paying: 409,
};

export async function POST(req: NextRequest) {
  const key = hostKeyOf(req);
  if (!key) return json({ status: "not_found" }, 404);
  const body = await readJson(req);
  const from =
    body?.from === "open" || body?.from === "completed" ? body.from : undefined;
  const status = await raiseTarget(key, body?.targetCount, new Date(), from);
  return json({ status }, HTTP[status]);
}
