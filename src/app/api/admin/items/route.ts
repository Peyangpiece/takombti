import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { json } from "@/lib/http";
import { summarizeItems } from "@/lib/itemStats";

// 問ごとの質（仕様書 §11.12）。最近 90 日の、テストを除いた回答をまとめた数字だけを返す
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  return json(await summarizeItems(90));
}
