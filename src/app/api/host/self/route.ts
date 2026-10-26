import type { NextRequest } from "next/server";
import { saveSelf } from "@/lib/surveys";
import { hostKeyOf, json, readJson } from "@/lib/http";

const HTTP = {
  ok: 200,
  not_found: 404,
  not_open: 409,
  invalid: 400,
  already: 409,
} as const;

export async function PUT(req: NextRequest) {
  const key = hostKeyOf(req);
  const body = await readJson(req);
  if (!key) return json({ status: "not_found" }, 404);
  if (!body) return json({ status: "invalid" }, 400);
  const status = await saveSelf(key, body.answers);
  return json({ status }, HTTP[status]);
}
