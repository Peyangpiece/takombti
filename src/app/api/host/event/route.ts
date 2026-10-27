import type { NextRequest } from "next/server";
import { hostKeyOf, json, readJson } from "@/lib/http";
import { markResultView } from "@/lib/surveys";

// 結果を表示した（仕様書 §11.11）。診断ごとに最初の 1 回だけ数える（再読み込みで二重に数えない）
export async function POST(req: NextRequest) {
  const key = hostKeyOf(req);
  if (!key) return json({ status: "not_found" }, 404);
  const body = await readJson(req);
  if (body?.event !== "result_view") return json({ status: "invalid" }, 400);
  const counted = await markResultView(key).catch(() => false);
  return json({ status: "ok", counted });
}
