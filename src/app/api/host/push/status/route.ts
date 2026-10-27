import type { NextRequest } from "next/server";
import { hostKeyOf, json, readJson } from "@/lib/http";
import { hasSubscription } from "@/lib/push";

// この端末の送り先が、その診断に登録されているか（仕様書 §4.6・§11.10）。本文 { endpoint }
export async function POST(req: NextRequest) {
  const key = hostKeyOf(req);
  if (!key) return json({ status: "not_found" }, 404);
  const body = await readJson(req);
  const registered = await hasSubscription(key, body?.endpoint);
  if (registered === null) return json({ status: "invalid" }, 400);
  return json({ status: "ok", registered });
}
