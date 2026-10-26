import type { NextRequest } from "next/server";
import { setShare } from "@/lib/surveys";
import { hostKeyOf, json } from "@/lib/http";

const HTTP = {
  ok: 200,
  not_found: 404,
  not_open: 409,
  invalid: 400,
  already: 409,
} as const;

async function handle(req: NextRequest, on: boolean) {
  const key = hostKeyOf(req);
  if (!key) return json({ status: "not_found" }, 404);
  const r = await setShare(key, on);
  return json(r, HTTP[r.status]);
}

export async function POST(req: NextRequest) {
  return handle(req, true);
}

export async function DELETE(req: NextRequest) {
  return handle(req, false);
}
