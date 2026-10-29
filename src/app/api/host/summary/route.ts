import type { NextRequest } from "next/server";
import { getHostSummary } from "@/lib/surveys";
import { hostKeyOf, json } from "@/lib/http";

// 「つくった診断」の一覧の状態の札だけ（仕様書 §4.2）。結果や分析を作らないので軽い
export async function GET(req: NextRequest) {
  const key = hostKeyOf(req);
  const view = key ? await getHostSummary(key) : null;
  if (!view) return json({ error: "not_found" }, 404);
  return json(view);
}
