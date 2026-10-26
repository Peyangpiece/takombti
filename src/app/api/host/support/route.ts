import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { getHost } from "@/lib/surveys";
import { hostKeyOf, json, readJson } from "@/lib/http";
import { recordSupport } from "@/lib/supportStats";

// 応援のお願いを見た・「今回は閉じる」を押した、を記録する（/admin の集計に使う。仕様書 §4.11）
export async function POST(req: NextRequest) {
  const key = hostKeyOf(req);
  const host = key ? await getHost(key) : null;
  if (!host) return json({ status: "not_found" }, 404);
  const body = await readJson(req);
  const event = body?.event;
  if (event !== "seen" && event !== "closed")
    return json({ status: "invalid" }, 400);
  if (host.status !== "completed") return json({ status: "not_open" }, 409);
  await recordSupport(await getDb(), host.surveyId, event);
  return json({ status: "ok" });
}
