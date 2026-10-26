import type { NextRequest } from "next/server";
import { extendSurvey } from "@/lib/surveys";
import { hostKeyOf, json } from "@/lib/http";

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
  const status = await extendSurvey(key);
  return json({ status }, HTTP[status]);
}
